import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, ReplaySubject } from 'rxjs';
import { JobUpdate } from './job.models';

@Injectable({
  providedIn: 'root'
})
export class JobSocketService implements OnDestroy {
  private socket?: Socket;
  private readonly namespace = '/jobs';
  private readonly updates$ = new ReplaySubject<JobUpdate>(1);
  private currentBaseUrl?: string;

  connect(baseUrl: string): void {
    const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');

    if (this.socket?.connected && this.currentBaseUrl === normalizedBaseUrl) {
      return;
    }

    if (this.socket) {
      this.socket.disconnect();
    }

    this.currentBaseUrl = normalizedBaseUrl;
    this.socket = io(`${normalizedBaseUrl}${this.namespace}`, {
      transports: ['websocket'],
      withCredentials: true
    });

    this.socket.on('job-update', (update: JobUpdate) => {
      this.updates$.next(update);
    });

    this.socket.on('job-status-response', (payload: { jobId: string; status: JobUpdate | null }) => {
      if (payload.status) {
        this.updates$.next(payload.status);
      }
    });

    this.socket.on('statistics-response', () => {
      // Placeholder para manejar metricas globales si se requieren mas adelante.
    });
  }

  jobUpdates(): Observable<JobUpdate> {
    return this.updates$.asObservable();
  }

  subscribeToJob(jobId: string): void {
    this.socket?.emit('subscribe', { jobId });
  }

  unsubscribeFromJob(jobId: string): void {
    this.socket?.emit('unsubscribe', { jobId });
  }

  requestJobStatus(jobId: string): void {
    this.socket?.emit('status', { jobId });
  }

  requestStats(): void {
    this.socket?.emit('stats');
  }

  ngOnDestroy(): void {
    this.socket?.disconnect();
    this.updates$.complete();
  }
}
