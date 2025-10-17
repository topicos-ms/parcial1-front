import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of, switchMap, throwError } from 'rxjs';
import { filter, finalize, map, take, tap } from 'rxjs/operators';
import {
  ENROLLMENTS_MS_ENDPOINTS,
  TEACHING_MS_ENDPOINTS,
  API_BASE_URL,
  GATEWAY_ENDPOINTS,
} from '@constants';
import { JobSocketService } from '../../core/jobs/job-socket.service';
import { JobAck, JobUpdate } from '../../core/jobs/job.models';
import {
  EnrollmentBatchRequest,
  EnrollmentBatchResponse,
  EnrollmentDetailDto,
  EnrollmentDto,
  PaginatedResponse,
  RecommendedCoursesResponse,
  ScheduleDto,
} from './enrollment.models';

@Injectable({ providedIn: 'root' })
export class EnrollmentDataService {
  private readonly http = inject(HttpClient);
  private readonly jobSocket = inject(JobSocketService);

  private readonly activeJobs = new Set<string>();
  private socketReady = false;
  private readonly currentJobAckSubject = new BehaviorSubject<JobAck | null>(null);
  private readonly jobStatusSubject = new BehaviorSubject<JobUpdate | null>(null);

  /**
   * Obtiene la inscripcion activa de un estudiante
   */
  getRecommendedCourses(studentId: string): Observable<RecommendedCoursesResponse> {
    if (!studentId) {
      return throwError(() => new Error('El identificador del estudiante es obligatorio para obtener recomendaciones.'));
    }

    const params = this.createParams({ studentId });
    const url = GATEWAY_ENDPOINTS.STUDENTS.RECOMMENDED_COURSES;

    return this.executeQueueJob<RecommendedCoursesResponse>(
      this.http.get<RecommendedCoursesResponse>(url, { params })
    ).pipe(
      map((response) => ({
        student: response?.student ?? { id: studentId, code: '', studyPlanId: '' },
        studyPlan: response?.studyPlan ?? { id: '', version: '', degreeProgramId: '' },
        targetLevel: response?.targetLevel ?? { id: null, name: null, order: null },
        courses: Array.isArray(response?.courses) ? response.courses : []
      }))
    );
  }

  getCourseSections(courseId: string): Observable<any> {
    const params = this.createParams({
      course_id: courseId,
      status: 'Active',
      limit: 50,
      page: 1
    });

    return this.executeQueueJob<any>(
      this.http.get<any>(TEACHING_MS_ENDPOINTS.COURSE_SECTIONS.ROOT, { params })
    );
  }

  /**
   * Obtiene la inscripcion activa de un estudiante
   */
  getActiveEnrollment(studentId: string): Observable<PaginatedResponse<EnrollmentDto>> {
    const params = this.createParams({
      student_id: studentId,
      state: 'Active'
    });

    console.log('[EnrollmentDataService] (Inscripcion) GET /enrollments', params);

    return this.executeQueueJob<PaginatedResponse<EnrollmentDto>>(
      this.http.get<PaginatedResponse<EnrollmentDto>>(ENROLLMENTS_MS_ENDPOINTS.ENROLLMENTS.ROOT, { params })
    ).pipe(
      tap((response) => {
        console.log('[EnrollmentDataService] (Inscripcion) Respuesta /enrollments', response);
      })
    );
  }

  /**
   * Inscribe multiples materias en lote
   */
  enrollBatch(request: EnrollmentBatchRequest): Observable<EnrollmentBatchResponse> {
    const headers = new HttpHeaders({ 'X-Idempotency-Key': this.generateIdempotencyKey() });

    return this.executeQueueJob<EnrollmentBatchResponse>(
      this.http.post<EnrollmentBatchResponse>(ENROLLMENTS_MS_ENDPOINTS.ATOMIC_ENROLLMENT.ENROLL_BATCH, request, { headers })
    );
  }

  /**
   * Limpia cualquier informacion previa del job en curso.
   */
  resetJobTracking(): void {
    this.currentJobAckSubject.next(null);
    this.jobStatusSubject.next(null);
  }

  /**
   * Devuelve el ACK actual del job (si existe).
   */
  getCurrentJobAck(): Observable<JobAck | null> {
    return this.currentJobAckSubject.asObservable();
  }

  getCurrentJobAckSnapshot(): JobAck | null {
    return this.currentJobAckSubject.value;
  }

  /**
   * Devuelve los updates de estado de la cola para el job actual.
   */
  getJobStatusUpdates(): Observable<JobUpdate | null> {
    return this.jobStatusSubject.asObservable();
  }

  getCurrentJobStatusSnapshot(): JobUpdate | null {
    return this.jobStatusSubject.value;
  }

  listEnrollmentDetailsByEnrollment(
    enrollmentId: string,
  ): Observable<PaginatedResponse<EnrollmentDetailDto>> {
    const params = this.createParams({
      enrollment_id: enrollmentId,
      limit: 50,
      page: 1,
    });

    console.log('[EnrollmentDataService] (Detalles) GET /enrollment-details', params);

    return this.executeQueueJob<PaginatedResponse<EnrollmentDetailDto>>(
      this.http.get<PaginatedResponse<EnrollmentDetailDto>>(
        ENROLLMENTS_MS_ENDPOINTS.ENROLLMENT_DETAILS.ROOT,
        { params },
      ),
    ).pipe(
      tap((response) => {
        console.log('[EnrollmentDataService] (Detalles) Respuesta /enrollment-details', response);
      }),
    );
  }

  getSchedulesByCourseSection(courseSectionId: string): Observable<PaginatedResponse<ScheduleDto>> {
    const params = this.createParams({
      course_section_id: courseSectionId,
      page: 1,
      limit: 20
    });

    console.log('[EnrollmentDataService] (Horarios) GET /schedules', params);

    return this.executeQueueJob<PaginatedResponse<ScheduleDto>>(
      this.http.get<PaginatedResponse<ScheduleDto>>(TEACHING_MS_ENDPOINTS.SCHEDULES.ROOT, { params })
    ).pipe(
      tap((response) => {
        console.log(
          '[EnrollmentDataService] (Horarios) Respuesta /schedules',
          courseSectionId,
          response
        );
      })
    );
  }

  private executeQueueJob<T>(request$: Observable<any>): Observable<T> {
    return request$.pipe(
      tap((initialResponse) => {
        if (initialResponse && typeof initialResponse === 'object' && 'jobId' in initialResponse) {
          console.log('[EnrollmentDataService] (Job) ACK recibido', initialResponse);
        }
      }),
      switchMap((response) => {
        if (response && typeof response === 'object' && 'jobId' in response) {
          const ack = response as JobAck;
          if (!ack.jobId) {
            return throwError(() => new Error('Respuesta de cola invalida: falta jobId.'));
          }
          this.registerJobAck(ack);
          return this.waitForJobResult<T>(ack.jobId);
        }
        return of(response as T);
      })
    );
  }

  private waitForJobResult<T>(jobId: string): Observable<T> {
    this.ensureSocket();
    this.jobSocket.subscribeToJob(jobId);
    this.jobSocket.requestJobStatus(jobId);
    this.activeJobs.add(jobId);
    console.log('[EnrollmentDataService] (Job) Esperando resultado', jobId);

    return this.jobSocket.jobUpdates().pipe(
      filter((update) => {
        const matches = update.jobId === jobId;
        if (!matches) {
          console.log('[EnrollmentDataService] (Job) Ignorando update de otro job', update);
        }
        return matches;
      }),
      tap((update) => {
        this.jobStatusSubject.next(update);
      }),
      filter((update) => {
        const isTerminal = update.status === 'completed' || update.status === 'failed';
        console.log('[EnrollmentDataService] (Job) Update recibido', update);
        return isTerminal;
      }),
      take(1),
      switchMap((update) => {
        if (update.status === 'failed') {
          return throwError(() => new Error(this.extractJobError(update.error)));
        }
        return of((update.result as T) ?? (null as T));
      }),
      finalize(() => {
        this.jobSocket.unsubscribeFromJob(jobId);
        this.activeJobs.delete(jobId);
      })
    );
  }

  private registerJobAck(ack: JobAck): void {
    this.currentJobAckSubject.next(ack);

    const initialUpdate: JobUpdate = {
      jobId: ack.jobId,
      status: ack.status ?? 'queued',
      queueName: ack.queueType,
      timestamp: Date.now(),
      estimatedTimeRemaining: undefined,
    };
    this.jobStatusSubject.next(initialUpdate);
  }

  private ensureSocket(): void {
    if (!this.socketReady) {
      this.jobSocket.connect(API_BASE_URL);
      this.socketReady = true;
    }
  }

  /**
   * Extrae el mensaje de error de un job fallido
   */
  private extractJobError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (error && typeof error === 'object' && 'message' in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === 'string') {
        return message;
      }
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'El procesamiento de la solicitud fallo.';
  }

  private createParams(params: Record<string, string | number | undefined>): HttpParams {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') {
        continue;
      }
      httpParams = httpParams.set(key, String(value));
    }
    return httpParams;
  }

  private generateIdempotencyKey(): string {
    if (typeof globalThis.crypto !== 'undefined' && 'randomUUID' in globalThis.crypto) {
      return globalThis.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
