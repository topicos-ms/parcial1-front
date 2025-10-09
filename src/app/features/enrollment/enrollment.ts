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
import { combineLatest } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule, MatSelectChange } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';

import { AuthService } from '../../auth/services/auth.service';
import { EnrollmentDataService } from './enrollment-data.service';

@Component({
  selector: 'app-enrollment',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatOptionModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatCheckboxModule,
    MatChipsModule,
    MatTooltipModule,
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
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly terms = signal<any[]>([]);
  readonly selectedTermId = signal<string | null>(null);
  readonly enrollment = signal<any | null>(null);
  readonly sections = signal<any[]>([]);

  readonly loadingTerms = signal(false);
  readonly loadingData = signal(false);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  private readonly selectedSectionIds = signal<Set<string>>(new Set());

  readonly user = computed(() => this.authService.currentUser());
  readonly currentTerm = computed(() => {
    const id = this.selectedTermId();
    return id ? this.terms().find((term) => term?.id === id) ?? null : null;
  });
  readonly selectedCount = computed(() => this.selectedSectionIds().size);
  readonly canSubmit = computed(
    () => this.selectedSectionIds().size > 0 && !!this.enrollment() && !this.submitting()
  );

  readonly displayedColumns: string[] = ['select', 'course', 'group', 'schedule', 'quota', 'status'];

  constructor() {
    this.loadTerms();

    effect(() => {
      const termId = this.selectedTermId();
      const currentUser = this.user();
      if (!termId || !currentUser?.id) {
        return;
      }
      this.fetchEnrollmentData(currentUser.id, termId);
    });
  }

  onTermChange(eventOrId: MatSelectChange | string): void {
    const termId = typeof eventOrId === 'string' ? eventOrId : (eventOrId.value as string);
    this.selectedTermId.set(termId);
  }

  refresh(): void {
    const termId = this.selectedTermId();
    const user = this.user();
    if (termId && user?.id) {
      this.fetchEnrollmentData(user.id, termId);
    }
  }

  isSelectable(view: any): boolean {
    return !!this.enrollment() && this.isSelectableView(view);
  }

  isSelected(id: string): boolean {
    return this.selectedSectionIds().has(id);
  }

  toggleSection(view: any): void {
    if (!this.isSelectable(view)) {
      return;
    }

    const sectionId = view?.section?.id;
    if (!sectionId) {
      return;
    }

    this.selectedSectionIds.update((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }

  clearSelection(): void {
    this.selectedSectionIds.set(new Set());
  }

  submitSelection(): void {
    const enrollment = this.enrollment();
    const termId = this.selectedTermId();
    const user = this.user();

    if (!enrollment?.id || !termId || !user?.id) {
      this.showMessage('No se encontro una inscripcion activa para procesar.');
      return;
    }

    const sectionIds = Array.from(this.selectedSectionIds());
    if (!sectionIds.length) {
      return;
    }

    this.submitting.set(true);
    this.dataService
      .submitEnrollmentBatch(enrollment.id, sectionIds)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.submitting.set(false);
          const message = response?.message ?? 'Inscripcion enviada correctamente.';
          this.showMessage(message);
          this.selectedSectionIds.set(new Set());
          this.fetchEnrollmentData(user.id, termId);
        },
        error: (error) => {
          this.submitting.set(false);
          this.handleError(error, 'No se pudo completar la inscripcion. Intenta nuevamente.');
        }
      });
  }

  enrolledCount(): number {
    return this.enrollment()?.enrollment_details?.length ?? 0;
  }

  private loadTerms(): void {
    this.loadingTerms.set(true);
    this.dataService
      .getActiveTerms()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (terms) => {
          this.terms.set(Array.isArray(terms) ? terms : []);
          if (!this.selectedTermId() && Array.isArray(terms) && terms.length) {
            const firstTerm = terms[0];
            this.selectedTermId.set(firstTerm?.id ?? null);
          }
          this.loadingTerms.set(false);
        },
        error: (error) => {
          this.loadingTerms.set(false);
          this.handleError(error, 'No se pudieron cargar los periodos academicos.');
        }
      });
  }

  private fetchEnrollmentData(studentId: string, termId: string): void {
    this.loadingData.set(true);
    this.errorMessage.set(null);

    combineLatest({
      enrollment: this.dataService.getEnrollment(studentId, termId),
      sections: this.dataService.getCourseSectionsByTerm(termId)
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ enrollment, sections }) => {
          this.enrollment.set(enrollment ?? null);
          const enrolledIds = new Set(
            Array.isArray(enrollment?.enrollment_details)
              ? enrollment.enrollment_details.map((detail: any) => detail?.course_section_id).filter(Boolean)
              : []
          );
          const viewModels = (sections ?? []).map((view: any) => ({
            ...view,
            isAlreadyEnrolled: enrolledIds.has(view?.section?.id),
            hasQuota: Number(view?.section?.quota_available ?? view?.section?.quotaAvailable ?? 0) > 0
          }));
          this.sections.set(viewModels);
          this.pruneSelections(viewModels, Boolean(enrollment));
          this.loadingData.set(false);
        },
        error: (error) => {
          this.loadingData.set(false);
          this.sections.set([]);
          this.enrollment.set(null);
          this.pruneSelections([], false);
          this.handleError(error, 'No se pudo cargar la informacion de inscripcion.');
        }
      });
  }

  private pruneSelections(viewModels: any[], hasEnrollment: boolean): void {
    if (!hasEnrollment) {
      this.selectedSectionIds.set(new Set());
      return;
    }

    const allowedIds = new Set(
      viewModels
        .filter((view) => this.isSelectableView(view))
        .map((view) => view?.section?.id)
        .filter(Boolean) as string[]
    );

    this.selectedSectionIds.update((current) => {
      const next = new Set<string>();
      current.forEach((id) => {
        if (allowedIds.has(id)) {
          next.add(id);
        }
      });
      return next;
    });
  }

  private isSelectableView(view: any): boolean {
    return !view?.isAlreadyEnrolled && Number(view?.section?.quota_available ?? view?.section?.quotaAvailable ?? 0) > 0;
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
