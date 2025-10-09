import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap, throwError } from 'rxjs';
import { catchError, filter, finalize, take, tap } from 'rxjs/operators';
import {
  CALENDAR_MS_ENDPOINTS,
  ENROLLMENTS_MS_ENDPOINTS,
  PROGRAMS_MS_ENDPOINTS,
  TEACHING_MS_ENDPOINTS,
  API_BASE_URL
} from '@constants';
import { JobSocketService } from '../../core/jobs/job-socket.service';
import { JobAck } from '../../core/jobs/job.models';

@Injectable({ providedIn: 'root' })
export class EnrollmentDataService {
  private readonly http = inject(HttpClient);
  private readonly jobSocket = inject(JobSocketService);

  private readonly courseCache = new Map<string, any>();
  private readonly activeJobs = new Set<string>();
  private socketReady = false;

  getActiveTerms(limit = 10): Observable<any[]> {
    const params = this.createParams({
      status: 'Active',
      limit,
      page: 1,
      sortBy: 'start_date',
      sortOrder: 'ASC'
    });

    return this.executeQueueJob<any>(this.http.get<any>(CALENDAR_MS_ENDPOINTS.PERIODS.ROOT, { params })).pipe(
      map((response) => this.unwrapArray(response))
    );
  }

  getEnrollment(studentId: string, termId: string): Observable<any | null> {
    const params = this.createParams({
      student_id: studentId,
      term_id: termId,
      state: 'Active',
      limit: 1,
      page: 1
    });

    return this.executeQueueJob<any>(this.http.get<any>(ENROLLMENTS_MS_ENDPOINTS.ENROLLMENTS.ROOT, { params })).pipe(
      map((response) => this.unwrapArray(response)?.[0] ?? null),
      catchError((error) => {
        if (error.status === 404) {
          return of(null);
        }
        return throwError(() => error);
      })
    );
  }

  getCourseSectionsByTerm(termId: string, limit = 50): Observable<any[]> {
    const params = this.createParams({
      term_id: termId,
      status: 'Active',
      limit,
      page: 1,
      sortBy: 'group_label',
      sortOrder: 'ASC'
    });

    return this.executeQueueJob<any>(
      this.http.get<any>(TEACHING_MS_ENDPOINTS.COURSE_SECTIONS.ROOT, { params })
    ).pipe(
      switchMap((response) => {
        const sections = this.unwrapArray(response);
        if (!sections.length) {
          return of<any[]>([]);
        }

        const uniqueCourseIds = Array.from(
          new Set(sections.map((section: any) => section?.course_id).filter(Boolean))
        );

        if (!uniqueCourseIds.length) {
          return of(this.toViewModels(sections, new Map()));
        }

        return forkJoin(uniqueCourseIds.map((id) => this.getCourseById(id))).pipe(
          map((courses) => {
            const courseMap = new Map<string, any>();
            courses.forEach((course: any) => {
              if (course?.id) {
                courseMap.set(course.id, course);
              }
            });
            return this.toViewModels(sections, courseMap);
          })
        );
      })
    );
  }

  submitEnrollmentBatch(enrollmentId: string, sectionIds: readonly string[]): Observable<any> {
    const uniqueIds = Array.from(new Set(sectionIds));
    if (!uniqueIds.length) {
      return throwError(() => new Error('No se seleccionaron materias para inscribir.'));
    }

    const payload = {
      items: uniqueIds.map((sectionId) => ({
        enrollment_id: enrollmentId,
        course_section_id: sectionId
      }))
    };

    const headers = new HttpHeaders({ 'X-Idempotency-Key': this.generateIdempotencyKey() });

    return this.executeQueueJob<any>(
      this.http.post<any>(ENROLLMENTS_MS_ENDPOINTS.ATOMIC_ENROLLMENT.ENROLL_BATCH, payload, { headers })
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
    this.ensureSocket();
    this.jobSocket.subscribeToJob(jobId);
    this.jobSocket.requestJobStatus(jobId);
    this.activeJobs.add(jobId);

    return this.jobSocket.jobUpdates().pipe(
      filter((update) => update.jobId === jobId),
      filter((update) => update.status === 'completed' || update.status === 'failed'),
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
      this.jobSocket.connect(API_BASE_URL);
      this.socketReady = true;
    }
  }

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

  private getCourseById(id: string): Observable<any> {
    const cached = this.courseCache.get(id);
    if (cached) {
      return of(cached);
    }

    return this.executeQueueJob<any>(this.http.get<any>(PROGRAMS_MS_ENDPOINTS.COURSES.BY_ID(id))).pipe(
      tap((course) => {
        if (course?.id) {
          this.courseCache.set(course.id, course);
        }
      })
    );
  }

  private toViewModels(sections: any[], courses: Map<string, any>): any[] {
    return sections.map((section) => {
      const course =
        section?.course ||
        courses.get(section?.course_id || section?.courseId) ||
        null;

      const schedules = section?.schedules ?? section?.Schedules ?? [];
      const quotaAvailable = section?.quota_available ?? section?.quotaAvailable ?? 0;
      const quotaMax = section?.quota_max ?? section?.quotaMax ?? quotaAvailable;

      return {
        section: {
          ...section,
          quota_available: quotaAvailable,
          quota_max: quotaMax,
          schedules
        },
        course,
        isAlreadyEnrolled: false,
        hasQuota: Number(quotaAvailable) > 0,
        scheduleLabel: this.formatSchedules(schedules)
      };
    });
  }

  private formatSchedules(schedules: any[]): string {
    if (!Array.isArray(schedules) || !schedules.length) {
      return 'Sin horario';
    }

    return schedules
      .map((schedule) => {
        const start = String(schedule?.time_start ?? schedule?.start ?? schedule?.from)?.slice(0, 5) || '--:--';
        const end = String(schedule?.time_end ?? schedule?.end ?? schedule?.to)?.slice(0, 5) || '--:--';
        const weekday = schedule?.weekday ?? schedule?.day ?? 'Dia';
        return `${weekday} ${start} - ${end}`;
      })
      .join(', ');
  }

  private unwrapArray(payload: any): any[] {
    if (!payload) {
      return [];
    }

    if (Array.isArray(payload)) {
      return payload;
    }

    if (Array.isArray(payload?.data)) {
      return payload.data;
    }

    if (Array.isArray(payload?.data?.data)) {
      return payload.data.data;
    }

    if (Array.isArray(payload?.result?.data)) {
      return payload.result.data;
    }

    if (payload?.data?.data?.items && Array.isArray(payload.data.data.items)) {
      return payload.data.data.items;
    }

    return [];
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
