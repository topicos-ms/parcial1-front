import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';

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

  readonly dialogIcon = 'info';
  readonly iconClass = 'info-icon';
  readonly dialogTitle = 'Solicitud de inscripción enviada';
  readonly primaryMessage = 'Hemos recibido tu solicitud de inscripción.';
  readonly secondaryMessage =
    'Puedes ver el estado y el resultado en la página de Estado de inscripción.';

  close(): void {
    this.dialogRef.close();
  }

  navigateToStatus(): void {
    this.dialogRef.close();
    this.router.navigate(['/dashboard/enrollment/status']);
  }
}

