import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';

@Component({
  selector: 'app-enrollment-confirmation-modal',
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './enrollment-confirmation-modal.html',
  styleUrl: './enrollment-confirmation-modal.scss',
})
export class EnrollmentConfirmationModal {
  private readonly dialogRef = inject(MatDialogRef<EnrollmentConfirmationModal>);
  private readonly router = inject(Router);

  close(): void {
    this.dialogRef.close();
  }

  navigateToStatus(): void {
    this.dialogRef.close();
    this.router.navigate(['/dashboard/enrollment/status']);
  }
}
