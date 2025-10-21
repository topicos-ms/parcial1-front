import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, filter, of, switchMap, take, tap, throwError } from 'rxjs';
import { AUTH_MS_ENDPOINTS, API_BASE_URL } from '@constants';
import { JobAck, JobUpdate } from '../../core/jobs/job.models';
import { JobSocketService } from '../../core/jobs/job-socket.service';
import { LoginRequest, RegisterRequest, AuthResponse, LoginResult, User } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly jobSocket = inject(JobSocketService);

  currentUser = signal<User | null>(null);
  isAuthenticated = signal<boolean>(false);
  currentJobAck = signal<JobAck | null>(null);
  currentJobUpdate = signal<JobUpdate | null>(null);

  private activeJobId: string | null = null;

  constructor() {
    this.loadUserFromStorage();
  }

  login(credentials: LoginRequest): Observable<LoginResult> {
    return this.executeAuthJob<LoginResult>(AUTH_MS_ENDPOINTS.LOGIN, credentials).pipe(
      tap((response) => this.persistSession(response))
    );
  }

  register(userData: RegisterRequest): Observable<AuthResponse> {
    return this.executeAuthJob<AuthResponse>(AUTH_MS_ENDPOINTS.REGISTER, userData).pipe(
      tap((response) => this.persistSession(response))
    );
  }

  logout(): void {
    this.clearSession();
    this.router.navigate(['/auth']);
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  private executeAuthJob<T>(endpoint: string, payload: unknown): Observable<T> {
    return this.http.post<JobAck>(endpoint, payload).pipe(
      tap((ack) => this.beginJobTracking(ack)),
      switchMap((ack) => this.awaitJobResult<T>(ack))
    );
  }

  private beginJobTracking(ack: JobAck): void {
    if (!ack?.jobId) {
      throw new Error('No se recibio un identificador de job.');
    }

    this.currentJobAck.set(ack);
    this.currentJobUpdate.set(null);

    this.ensureSocketConnection();
    this.subscribeToJob(ack.jobId);

  }

  private awaitJobResult<T>(ack: JobAck): Observable<T> {
    if (!ack?.jobId) {
      return throwError(() => new Error('No se recibio un identificador de job.'));
    }

    const jobId = ack.jobId;

    return this.jobSocket.jobUpdates().pipe(
      filter((update) => update.jobId === jobId),
      tap((update) => {
        this.currentJobUpdate.set(update);
      }),
      filter((update) => update.status === 'completed' || update.status === 'failed'),
      take(1),
      switchMap((update) => {
        this.cleanJobSubscription(jobId);

        if (update.status === 'failed') {
          this.clearJobState();
          return throwError(() => this.createJobError(update));
        }

        const mapped = this.mapResult<T>(update.result);
        this.clearJobState();

        if (!mapped) {
          return throwError(() => new Error('El job finalizo sin datos validos.'));
        }

        return of(mapped);
      })
    );
  }

  private ensureSocketConnection(): void {
    this.jobSocket.connect(API_BASE_URL);
  }

  private subscribeToJob(jobId: string): void {
    if (this.activeJobId && this.activeJobId !== jobId) {
      this.jobSocket.unsubscribeFromJob(this.activeJobId);
    }

    this.activeJobId = jobId;
    this.jobSocket.subscribeToJob(jobId);
    this.jobSocket.requestJobStatus(jobId);
  }

  private cleanJobSubscription(jobId: string): void {
    this.jobSocket.unsubscribeFromJob(jobId);
    if (this.activeJobId === jobId) {
      this.activeJobId = null;
    }
  }

  private persistSession(response: AuthResponse | LoginResult): void {
    const authResponse = this.normalizeResponse(response);

    localStorage.setItem('auth_token', authResponse.token);
    localStorage.setItem('current_user', JSON.stringify(authResponse.user));
    this.currentUser.set(authResponse.user);
    this.isAuthenticated.set(true);
  }

  private normalizeResponse(response: AuthResponse | LoginResult): AuthResponse {
    if ('user' in response) {
      return response;
    }

    const { token, ...userData } = response as LoginResult;

    return {
      token,
      user: {
        id: userData.id,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role
      }
    };
  }

  private mapResult<T>(result: unknown): T | null {
    if (!result || typeof result !== 'object') {
      return null;
    }

    return result as T;
  }

  private loadUserFromStorage(): void {
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('current_user');

    if (!token || !userStr || userStr === 'undefined') {
      this.clearSession();
      return;
    }

    try {
      const user = JSON.parse(userStr) as User;
      this.currentUser.set(user);
      this.isAuthenticated.set(true);
    } catch (error) {
      this.clearSession();
    }
  }

  private clearSession(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('current_user');
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
  }

  private clearJobState(): void {
    this.currentJobAck.set(null);
    this.currentJobUpdate.set(null);
  }

  private createJobError(update: JobUpdate): Error {
    const { error } = update;

    if (error instanceof Error) {
      return error;
    }

    if (typeof error === 'string') {
      return new Error(error);
    }

    if (error && typeof error === 'object' && 'message' in error && typeof (error as any).message === 'string') {
      return new Error((error as any).message);
    }

    return new Error('El procesamiento de la tarea fallo.');
  }
}
