import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap, throwError } from 'rxjs';
import { catchError, filter, finalize, take, tap } from 'rxjs/operators';
import { ENROLLMENTS_MS_ENDPOINTS, PROGRAMS_MS_ENDPOINTS, TEACHING_MS_ENDPOINTS, API_BASE_URL, GATEWAY_ENDPOINTS } from '@constants';
import { JobSocketService } from '../../core/jobs/job-socket.service';
import { JobAck } from '../../core/jobs/job.models';
import { CourseSectionViewModel, RecommendedCourseDto, RecommendedCoursesResponse } from './enrollment.models';

@Injectable({ providedIn: 'root' })
export class EnrollmentDataService {
  private readonly http = inject(HttpClient);
  private readonly jobSocket = inject(JobSocketService);

  private readonly courseCache = new Map<string, any>();
  private readonly activeJobs = new Set<string>();
  private socketReady = false;

  getEnrollment(studentId: string, termId?: string): Observable<any | null> {
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

  getRecommendedCourses(studentId: string): Observable<RecommendedCoursesResponse> {
    if (!studentId) {
      return throwError(() => new Error('El identificador del estudiante es obligatorio para obtener recomendaciones.'));
    }

    const params = this.createParams({ studentId });
    const url = GATEWAY_ENDPOINTS.STUDENTS.RECOMMENDED_COURSES;
    console.log('[EnrollmentDataService] GET Recommended Courses');
    console.log('[EnrollmentDataService] URL:', url);
    console.log('[EnrollmentDataService] Params:', params.toString());
    console.log('[EnrollmentDataService] StudentId:', studentId);

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

  getActiveEnrollment(studentId: string): Observable<any> {
    const params = this.createParams({
      student_id: studentId,
      state: 'Active'
    });

    return this.executeQueueJob<any>(
      this.http.get<any>(ENROLLMENTS_MS_ENDPOINTS.ENROLLMENTS.ROOT, { params })
    );
  }

  enrollBatch(request: { items: Array<{ enrollment_id: string; course_section_id: string }> }): Observable<any> {
    const headers = new HttpHeaders({ 'X-Idempotency-Key': this.generateIdempotencyKey() });

    return this.executeQueueJob<any>(
      this.http.post<any>(ENROLLMENTS_MS_ENDPOINTS.ATOMIC_ENROLLMENT.ENROLL_BATCH, request, { headers })
    );
  }

  loadEnrollmentContext(studentId: string): Observable<{
    enrollment: any | null;
    recommendations: RecommendedCoursesResponse | null;
    sections: CourseSectionViewModel[];
  }> {
    return this.getEnrollment(studentId).pipe(
      switchMap((enrollment) => {
        const termId = enrollment?.term_id ?? enrollment?.term?.id ?? undefined;
        const enrolledIds = new Set(
          Array.isArray(enrollment?.enrollment_details)
            ? enrollment.enrollment_details
                .map((detail: any) => detail?.course_section_id ?? detail?.courseSectionId ?? detail?.course_section?.id ?? null)
                .filter((id: unknown): id is string => typeof id === 'string')
            : []
        );

        return this.getRecommendedCourses(studentId).pipe(
          switchMap((recommendations) => {
            const courses = Array.isArray(recommendations?.courses) ? recommendations.courses : [];

            if (!courses.length) {
              return of({
                enrollment,
                recommendations,
                sections: [] as CourseSectionViewModel[]
              });
            }

            const courseMap = this.buildCourseMapFromRecommendations(courses);
            const courseIds = Array.from(courseMap.keys());

            return this.getSectionsForCourses(courseIds, termId).pipe(
              map((rawSections) => {
                const uniqueSections = this.deduplicateSections(rawSections);
                const baseViewModels = this.toViewModels(uniqueSections, courseMap);

                const viewModels: CourseSectionViewModel[] = baseViewModels.map((view) => {
                  const sectionId = view?.section?.id ?? null;
                  const courseId = view?.section?.course_id ?? view?.section?.courseId ?? null;
                  const courseEntry = courseId ? courseMap.get(courseId) : undefined;
                  const recommended = courseEntry?.recommended ?? null;

                  return {
                    ...view,
                    course: courseEntry
                      ? {
                          id: courseEntry.id,
                          code: courseEntry.code,
                          name: courseEntry.name,
                          credits: courseEntry.credits
                        }
                      : view.course,
                    recommended,
                    isAlreadyEnrolled: sectionId ? enrolledIds.has(sectionId) : false,
                    hasQuota: Number(view.section?.quota_available ?? 0) > 0
                  };
                });

                return {
                  enrollment,
                  recommendations,
                  sections: viewModels
                };
              })
            );
          })
        );
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

  private getSectionsForCourses(courseIds: readonly string[], termId?: string, limit = 50): Observable<any[]> {
    const uniqueIds = Array.from(
      new Set(courseIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0))
    );
    if (!uniqueIds.length) {
      return of([]);
    }

    const requests = uniqueIds.map((courseId) => {
      const params = this.createParams({
        course_id: courseId,
        term_id: termId,
        status: 'Active',
        limit,
        page: 1,
        sortBy: 'group_label',
        sortOrder: 'ASC'
      });

      return this.executeQueueJob<any>(
        this.http.get<any>(TEACHING_MS_ENDPOINTS.COURSE_SECTIONS.ROOT, { params })
      ).pipe(map((response) => this.unwrapArray(response)));
    });

    return forkJoin(requests).pipe(map((resultSets) => resultSets.flat()));
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

  private buildCourseMapFromRecommendations(courses: RecommendedCourseDto[]): Map<string, any> {
    const courseMap = new Map<string, any>();
    courses.forEach((course) => {
      if (!course?.courseId) {
        return;
      }
      courseMap.set(course.courseId, {
        id: course.courseId,
        code: course.code,
        name: course.name,
        credits: course.credits,
        recommended: course
      });
    });
    return courseMap;
  }

  private deduplicateSections(sections: any[]): any[] {
    if (!Array.isArray(sections) || !sections.length) {
      return [];
    }
    const byId = new Map<string, any>();
    sections.forEach((section) => {
      const id =
        section?.id ??
        section?.course_section_id ??
        section?.courseSectionId ??
        section?.section?.id ??
        null;
      if (typeof id !== 'string' || byId.has(id)) {
        return;
      }
      byId.set(id, section);
    });
    return Array.from(byId.values());
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
