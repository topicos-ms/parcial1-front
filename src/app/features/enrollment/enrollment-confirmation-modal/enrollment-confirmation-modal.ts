import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';

/**
 * Modal que se muestra al iniciar el proceso de inscripción.
 * Informa al usuario que puede consultar el estado de su inscripción.
 */
@Component({
  selector: 'app-enrollment-confirmation-modal',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <div class="modal-container">
      <div class="modal-header">
        <mat-icon class="info-icon">info</mat-icon>
        <h2 mat-dialog-title>Procesando Inscripción</h2>
      </div>
      
      <mat-dialog-content>
        <p class="message">
          Tu solicitud de inscripción está siendo procesada.
        </p>
        <p class="submessage">
          Consulta el estado de tu inscripción 
          <a class="link" (click)="navigateToStatus()">aquí</a>
        </p>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button (click)="close()">Cerrar</button>
        <button mat-raised-button color="primary" (click)="navigateToStatus()">
          Ver Estado
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .modal-container {
      padding: 1rem;
    }

    .modal-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1rem;

      .info-icon {
        font-size: 2rem;
        width: 2rem;
        height: 2rem;
        color: #2196f3;
      }

      h2 {
        margin: 0;
      }
    }

    mat-dialog-content {
      .message {
        font-size: 1rem;
        margin-bottom: 0.5rem;
        color: rgba(0, 0, 0, 0.87);
      }

      .submessage {
        font-size: 0.95rem;
        color: rgba(0, 0, 0, 0.6);

        .link {
          color: #2196f3;
          cursor: pointer;
          text-decoration: underline;
          font-weight: 500;

          &:hover {
            color: #1976d2;
          }
        }
      }
    }

    mat-dialog-actions {
      margin-top: 1rem;
      gap: 0.5rem;
    }
  `]
})
export class EnrollmentConfirmationModal {
  private readonly dialogRef = inject(MatDialogRef<EnrollmentConfirmationModal>);
  private readonly router = inject(Router);

  /**
   * Cierra el modal
   */
  close(): void {
    this.dialogRef.close();
  }

  /**
   * Navega a la página de estado de inscripción
   */
  navigateToStatus(): void {
    this.dialogRef.close();
    this.router.navigate(['/dashboard/enrollment/status']);
  }
}
