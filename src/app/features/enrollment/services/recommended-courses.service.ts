import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, switchMap, throwError } from 'rxjs';
import { catchError, filter, finalize, take, map } from 'rxjs/operators';
import { GATEWAY_ENDPOINTS, API_BASE_URL } from '@constants';
import { JobSocketService } from '../../../core/jobs/job-socket.service';
import { JobAck } from '../../../core/jobs/job.models';
import { RecommendedCoursesResponse } from '../enrollment.models';

@Injectable({
  providedIn: 'root'
})
export class RecommendedCoursesService {
  private readonly http = inject(HttpClient);
  private readonly jobSocket = inject(JobSocketService);
  
  private socketInitialized = false;

  fetchRecommendedCourses(studentId: string): Observable<RecommendedCoursesResponse> {
    if (!studentId) {
      return throwError(() => new Error('El ID del estudiante es requerido'));
    }

    this.ensureSocketConnection();

    const params = new HttpParams().set('studentId', studentId);

    return this.http.get<JobAck>(GATEWAY_ENDPOINTS.STUDENTS.RECOMMENDED_COURSES, { params }).pipe(
      switchMap((response) => {
        if (this.isJobAck(response)) {
          return this.waitForJobCompletion<RecommendedCoursesResponse>(response.jobId);
        }
        return of(response as RecommendedCoursesResponse);
      }),
      map((data) => this.normalizeResponse(data)),
      catchError((error) => {
        const message = this.extractErrorMessage(error);
        return throwError(() => new Error(message));
      })
    );
  }

  private waitForJobCompletion<T>(jobId: string): Observable<T> {
    this.jobSocket.subscribeToJob(jobId);
    this.jobSocket.requestJobStatus(jobId);

    return this.jobSocket.jobUpdates().pipe(
      filter((update) => update.jobId === jobId),
      filter((update) => update.status === 'completed' || update.status === 'failed'),
      take(1),
      switchMap((update) => {
        if (update.status === 'failed') {
          const errorMessage = this.extractErrorMessage(update.error);
          return throwError(() => new Error(errorMessage));
        }
        return of(update.result as T);
      }),
      finalize(() => {
        this.jobSocket.unsubscribeFromJob(jobId);
      })
    );
  }

  private ensureSocketConnection(): void {
    if (!this.socketInitialized) {
      this.jobSocket.connect(API_BASE_URL);
      this.socketInitialized = true;
    }
  }

  private isJobAck(response: any): response is JobAck {
    return response && typeof response === 'object' && 'jobId' in response;
  }

  private normalizeResponse(data: any): RecommendedCoursesResponse {
    return {
      student: data?.student ?? { id: '', code: '', studyPlanId: '' },
      studyPlan: data?.studyPlan ?? { id: '', version: '', degreeProgramId: '' },
      targetLevel: data?.targetLevel ?? { id: null, name: null, order: null },
      courses: Array.isArray(data?.courses) ? data.courses : []
    };
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (error && typeof error === 'object') {
      if ('message' in error && typeof (error as any).message === 'string') {
        return (error as any).message;
      }
      if ('error' in error && typeof (error as any).error === 'string') {
        return (error as any).error;
      }
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'Error al obtener las materias recomendadas';
  }
}
