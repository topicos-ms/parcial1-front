import { CommonModule } from '@angular/common';
import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';

import { AuthService } from '../../auth/services/auth.service';
import { EnrollmentDataService } from './enrollment-data.service';
import { EnrollmentStateService } from './enrollment-state.service';
import { RecommendedCoursesResponse } from './enrollment.models';

@Component({
  selector: 'app-enrollment',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDividerModule
  ],
  templateUrl: './enrollment.html',
  styleUrl: './enrollment.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EnrollmentPage {
  private readonly dataService = inject(EnrollmentDataService);
  private readonly authService = inject(AuthService);
  private readonly stateService = inject(EnrollmentStateService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly recommendations = signal<RecommendedCoursesResponse | null>(null);
  readonly loadingData = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly user = computed(() => this.authService.currentUser());

  constructor() {
    effect(() => {
      const currentUser = this.user();
      if (!currentUser?.id) {
        return;
      }
      this.stateService.setStudentId(currentUser.id);
      this.fetchEnrollmentData(currentUser.id);
    });
  }

  refresh(): void {
    const user = this.user();
    if (user?.id) {
      this.fetchEnrollmentData(user.id);
    }
  }

  private fetchEnrollmentData(studentId: string): void {
    this.loadingData.set(true);
    this.errorMessage.set(null);

    this.dataService
      .getRecommendedCourses(studentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (recommendations) => {
          this.recommendations.set(recommendations);
          this.stateService.setCourses(recommendations.courses || []);
          this.loadingData.set(false);
        },
        error: (error) => {
          this.loadingData.set(false);
          this.stateService.setCourses([]);
          this.recommendations.set(null);
          this.handleError(error, 'No se pudo cargar las materias ofertadas.');
        }
      });
  }

  private handleError(error: unknown, fallback: string): void {
    const message = this.extractMessage(error, fallback);
    this.errorMessage.set(message);
    this.showMessage(message);
  }

  private extractMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      return error.error?.message ?? fallback;
    }
    if (error && typeof error === 'object' && 'message' in error) {
      const customMessage = (error as { message?: unknown }).message;
      if (typeof customMessage === 'string') {
        return customMessage;
      }
    }
    if (typeof error === 'string') {
      return error;
    }
    return fallback;
  }

  private showMessage(message: string): void {
    this.snackBar.open(message, 'Cerrar', { duration: 4000 });
  }
}
