import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { EnrollmentDataService } from '../../enrollment-data.service';
import { EnrollmentStateService } from '../../enrollment-state.service';
import { JobStatus } from '../../../../core/jobs/job.models';

@Component({
  selector: 'app-enrollment-confirmation-modal',
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './enrollment-confirmation-modal.html',
  styleUrl: './enrollment-confirmation-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnrollmentConfirmationModal {
  private readonly dialogRef = inject(MatDialogRef<EnrollmentConfirmationModal>);
  private readonly router = inject(Router);
  private readonly dataService = inject(EnrollmentDataService);
  private readonly stateService = inject(EnrollmentStateService);

  private readonly queueDetailsVisible = signal(false);

  readonly enrollmentStatus = this.stateService.enrollmentStatus;
  readonly jobAck = toSignal(this.dataService.getCurrentJobAck(), { initialValue: null });
  readonly jobStatus = toSignal(this.dataService.getJobStatusUpdates(), { initialValue: null });

  readonly dialogIcon = computed(() => {
    const finalStatus = this.enrollmentStatus();
    if (finalStatus) {
      return finalStatus.success ? 'check_circle' : 'error';
    }

    const status = this.jobStatus();
    if (status?.status === 'failed') {
      return 'error';
    }

    return 'info';
  });

  readonly iconClass = computed(() => {
    const finalStatus = this.enrollmentStatus();
    if (finalStatus) {
      return finalStatus.success ? 'success-icon' : 'error-icon';
    }

    const status = this.jobStatus();
    if (status?.status === 'failed') {
      return 'error-icon';
    }

    return 'info-icon';
  });

  readonly dialogTitle = computed(() => {
    const finalStatus = this.enrollmentStatus();
    if (finalStatus) {
      return finalStatus.success ? 'Inscripción completada' : 'Inscripción con errores';
    }
    return 'Procesando inscripción';
  });

  readonly primaryMessage = computed(() => {
    const finalStatus = this.enrollmentStatus();
    if (finalStatus) {
      return finalStatus.message || (finalStatus.success
        ? 'La inscripción se realizó correctamente.'
        : 'Ocurrió un error durante la inscripción.');
    }

    const status = this.jobStatus();
    if (!status) {
      return 'Tu solicitud de inscripción está en proceso.';
    }

    switch (status.status) {
      case 'queued':
        return 'Tu solicitud está en cola esperando un worker disponible.';
      case 'processing':
        return 'Un worker está procesando tu inscripción.';
      case 'progress':
        return typeof status.progress === 'number'
          ? `Procesando inscripción (${Math.round(status.progress)}%)`
          : 'La inscripción está siendo procesada.';
      case 'delayed':
        return 'La solicitud está en estado "delayed": los workers están pausados o no disponibles.';
      case 'failed':
        return typeof status.error === 'string' && status.error.length
          ? status.error
          : 'La cola reportó un error al procesar la inscripción.';
      case 'completed':
        return 'La cola terminó de procesar la solicitud. Actualizando estado...';
      default:
        return 'Tu solicitud de inscripción está siendo procesada.';
    }
  });

  readonly secondaryMessage = computed(() => {
    const finalStatus = this.enrollmentStatus();
    if (finalStatus) {
      return finalStatus.success
        ? 'Puedes revisar el detalle de tus materias inscritas.'
        : 'Consulta los detalles para conocer el motivo del error.';
    }

    const status = this.jobStatus();
    if (!status) {
      return 'Esperando confirmación de la cola...';
    }

    if (this.isTerminalStatus(status.status)) {
      return 'La cola ya devolvió un resultado. Espera un momento mientras se actualiza el estado.';
    }

    if (!this.queueDetailsVisible()) {
      return 'Pulsa "Ver estado" para consultar el progreso en la cola.';
    }

    return 'Mantén esta ventana abierta mientras la cola procesa tu solicitud.';
  });

  readonly queueStatusLabel = computed(() => this.translateStatus(this.jobStatus()?.status));

  readonly showQueueDetails = computed(() => this.queueDetailsVisible());

  readonly isWaitingForResult = computed(() => {
    const status = this.jobStatus();
    if (!status) {
      return true;
    }
    return !this.isTerminalStatus(status.status);
  });

  readonly primaryButtonLabel = computed(() => {
    if (!this.queueDetailsVisible()) {
      return 'Ver estado';
    }

    return this.canNavigateToStatus() ? 'Ver detalle' : 'Actualizando...';
  });

  readonly isPrimaryButtonDisabled = computed(() => {
    if (!this.queueDetailsVisible()) {
      return false;
    }
    return !this.canNavigateToStatus();
  });

  private readonly canNavigateToStatus = computed(() => {
    const finalStatus = this.enrollmentStatus();
    const status = this.jobStatus();
    if (!finalStatus) {
      return false;
    }
    if (!status) {
      return false;
    }
    return this.isTerminalStatus(status.status);
  });

  readonly queueMeta = computed(() => {
    const status = this.jobStatus();
    const ack = this.jobAck();
    return {
      jobId: status?.jobId ?? ack?.jobId ?? 'Desconocido',
      queueName: status?.queueName ?? ack?.queueType ?? 'No disponible',
      estimated: ack?.estimatedTime ?? null,
      error: typeof status?.error === 'string' ? status?.error : null,
    };
  });

  close(): void {
    this.queueDetailsVisible.set(false);
    this.dialogRef.close();
  }

  navigateToStatus(): void {
    console.log('[EnrollmentStatus] Boton "Ver estado" presionado');
    if (!this.queueDetailsVisible()) {
      this.queueDetailsVisible.set(true);
      return;
    }

    if (this.isPrimaryButtonDisabled()) {
      return;
    }

    this.queueDetailsVisible.set(false);
    this.dialogRef.close();
    this.router.navigate(['/dashboard/enrollment/status']);
  }

  isTerminalStatus(status?: JobStatus | null): boolean {
    return status === 'completed' || status === 'failed';
  }

  private translateStatus(status?: JobStatus | null): string {
    switch (status) {
      case 'queued':
        return 'En cola';
      case 'processing':
        return 'Procesando';
      case 'progress':
        return 'Progreso reportado';
      case 'completed':
        return 'Completado';
      case 'failed':
        return 'Fallido';
      case 'delayed':
        return 'En espera (delayed)';
      default:
        return 'Sin información';
    }
  }
}
