import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, switchMap, throwError } from 'rxjs';
import { filter, finalize, map, take } from 'rxjs/operators';
import { ENROLLMENTS_MS_ENDPOINTS, TEACHING_MS_ENDPOINTS, API_BASE_URL, GATEWAY_ENDPOINTS } from '@constants';
import { JobSocketService } from '../../core/jobs/job-socket.service';
import { JobAck } from '../../core/jobs/job.models';
import { RecommendedCoursesResponse } from './enrollment.models';

@Injectable({ providedIn: 'root' })
export class EnrollmentDataService {
  private readonly http = inject(HttpClient);
  private readonly jobSocket = inject(JobSocketService);

  private readonly activeJobs = new Set<string>();
  private socketReady = false;

  /**
   * Obtiene las materias recomendadas para un estudiante
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
   * Obtiene la inscripción activa de un estudiante
   */
  getActiveEnrollment(studentId: string): Observable<any> {
    const params = this.createParams({
      student_id: studentId,
      state: 'Active'
    });

    return this.executeQueueJob<any>(
      this.http.get<any>(ENROLLMENTS_MS_ENDPOINTS.ENROLLMENTS.ROOT, { params })
    );
  }

  /**
   * Inscribe múltiples materias en lote
   */
  enrollBatch(request: { items: Array<{ enrollment_id: string; course_section_id: string }> }): Observable<any> {
    const headers = new HttpHeaders({ 'X-Idempotency-Key': this.generateIdempotencyKey() });

    return this.executeQueueJob<any>(
      this.http.post<any>(ENROLLMENTS_MS_ENDPOINTS.ATOMIC_ENROLLMENT.ENROLL_BATCH, request, { headers })
    );
  }

  private executeQueueJob<T>(request$: Observable<any>): Observable<T> {
    return request$.pipe(
      switchMap((response) => {
        if (response && typeof response === 'object' && 'jobId' in response) {
          const ack = response as JobAck;
          if (!ack.jobId) {
            return throwError(() => new Error('Respuesta de cola invalida: falta jobId.'));
          }
          return this.waitForJobResult<T>(ack.jobId);
        }
        return of(response as T);
      })
    );
  }

  private waitForJobResult<T>(jobId: string): Observable<T> {
    console.log('[EnrollmentDataService] Esperando resultado del job:', jobId);
    this.ensureSocket();
    this.jobSocket.subscribeToJob(jobId);
    this.jobSocket.requestJobStatus(jobId);
    this.activeJobs.add(jobId);

    return this.jobSocket.jobUpdates().pipe(
      filter((update) => {
        console.log('[EnrollmentDataService] Job update recibido:', update);
        return update.jobId === jobId;
      }),
      filter((update) => {
        console.log('[EnrollmentDataService] Job estado:', update.status);
        return update.status === 'completed' || update.status === 'failed';
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

  private ensureSocket(): void {
    if (!this.socketReady) {
      console.log('[EnrollmentDataService] Conectando WebSocket a:', API_BASE_URL);
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
