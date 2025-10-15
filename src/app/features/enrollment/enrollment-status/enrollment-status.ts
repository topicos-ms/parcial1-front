import { CommonModule } from '@angular/common';
import { Component, ChangeDetectionStrategy, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { EnrollmentStateService } from '../enrollment-state.service';

/**
 * Componente que muestra el estado de la inscripción.
 * Muestra si fue exitosa o si hubo errores.
 */
@Component({
  selector: 'app-enrollment-status',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDividerModule
  ],
  templateUrl: './enrollment-status.html',
  styleUrl: './enrollment-status.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EnrollmentStatusPage implements OnInit {
  private readonly stateService = inject(EnrollmentStateService);
  private readonly router = inject(Router);

  readonly enrollmentStatus = this.stateService.enrollmentStatus;
  readonly isLoading = signal(false);

  ngOnInit(): void {
    // Si no hay estado de inscripción, redirigir a la página principal
    if (!this.enrollmentStatus()) {
      this.router.navigate(['/dashboard/enrollment']);
    }
  }

  /**
   * Vuelve a la página principal de inscripción
   */
  goBack(): void {
    this.stateService.clearEnrollmentStatus();
    this.router.navigate(['/dashboard/enrollment']);
  }

  /**
   * Retorna el ícono según el estado
   */
  getStatusIcon(): string {
    const status = this.enrollmentStatus();
    if (status?.success) {
      return 'check_circle';
    }
    return 'error';
  }

  /**
   * Retorna el color según el estado
   */
  getStatusColor(): string {
    const status = this.enrollmentStatus();
    if (status?.success) {
      return 'success';
    }
    return 'error';
  }
}
