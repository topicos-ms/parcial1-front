import { CommonModule } from '@angular/common';
import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
  DestroyRef
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { EnrollmentDataService } from '../enrollment-data.service';
import { CourseSectionDto, RecommendedCourseDto } from '../enrollment.models';
import { EnrollmentStateService } from '../enrollment-state.service';
import { EnrollmentConfirmationModal } from '../enrollment-confirmation-modal/enrollment-confirmation-modal';

interface CourseWithSections {
  course: RecommendedCourseDto;
  sections: CourseSectionDto[];
  selectedSectionId: string | null;
  loading: boolean;
  error: string | null;
}

@Component({
  selector: 'app-schedules',
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    MatChipsModule,
    MatSnackBarModule,
    MatDividerModule,
    MatDialogModule
  ],
  templateUrl: './schedules.html',
  styleUrl: './schedules.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SchedulesPage implements OnInit {
  private readonly stateService = inject(EnrollmentStateService);
  private readonly dataService = inject(EnrollmentDataService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);

  readonly selectedCourses = this.stateService.selectedCourses;
  readonly coursesWithSections = signal<CourseWithSections[]>([]);
  readonly enrolling = signal(false);

  readonly canEnroll = computed(() => {
    const courses = this.coursesWithSections();
    if (courses.length === 0) return false;
    
    // Solo validar materias que tienen grupos disponibles
    const coursesWithAvailableSections = courses.filter(c => 
      !c.loading && !c.error && c.sections.length > 0
    );
    
    if (coursesWithAvailableSections.length === 0) return false;
    
    // Todas las materias con grupos deben tener una selección
    return coursesWithAvailableSections.every(c => c.selectedSectionId !== null);
  });

  ngOnInit(): void {
    const courses = this.selectedCourses();
    if (courses.length === 0) {
      this.router.navigate(['/dashboard/enrollment/courses']);
      return;
    }

    this.loadCourseSections(courses);
  }

  private loadCourseSections(courses: RecommendedCourseDto[]): void {
    const initial: CourseWithSections[] = courses.map(course => ({
      course,
      sections: [],
      selectedSectionId: null,
      loading: true,
      error: null
    }));

    this.coursesWithSections.set(initial);

    courses.forEach((course, index) => {
      this.dataService
        .getCourseSections(course.courseId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response) => {
            const current = this.coursesWithSections();
            current[index] = {
              ...current[index],
              sections: response.data || [],
              loading: false
            };
            this.coursesWithSections.set([...current]);
          },
          error: (error) => {
            const current = this.coursesWithSections();
            current[index] = {
              ...current[index],
              loading: false,
              error: 'Error al cargar grupos'
            };
            this.coursesWithSections.set([...current]);
          }
        });
    });
  }

  selectSection(courseIndex: number, sectionId: string): void {
    const current = this.coursesWithSections();
    current[courseIndex] = {
      ...current[courseIndex],
      selectedSectionId: sectionId
    };
    this.coursesWithSections.set([...current]);
  }

  formatSchedule(section: CourseSectionDto): string {
    if (!section.schedules || section.schedules.length === 0) {
      return 'Sin horario';
    }
    return section.schedules
      .map(s => `${s.weekday} ${s.time_start}-${s.time_end}`)
      .join(', ');
  }

  goBack(): void {
    this.router.navigate(['/dashboard/enrollment/courses']);
  }

  enroll(): void {
    if (!this.canEnroll()) {
      return;
    }

    const studentId = this.stateService.studentId();
    if (!studentId) {
      this.showMessage('No se pudo obtener el ID del estudiante');
      return;
    }

    this.enrolling.set(true);

    // Primero obtener el enrollment activo
    this.dataService
      .getActiveEnrollment(studentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (enrollments) => {
          if (!enrollments.data || enrollments.data.length === 0) {
            this.enrolling.set(false);
            this.stateService.setEnrollmentStatus({
              success: false,
              message: 'No tienes una inscripción activa',
              errorCode: 'NO_ACTIVE_ENROLLMENT'
            });
            this.openStatusModal();
            return;
          }

          const enrollment = enrollments.data[0];
          
          // Solo enviar los grupos de materias que tienen secciones disponibles y seleccionadas
          const selectedSections = this.coursesWithSections()
            .filter(c => !c.loading && !c.error && c.sections.length > 0 && c.selectedSectionId !== null)
            .map(c => c.selectedSectionId)
            .filter((id): id is string => id !== null);

          if (selectedSections.length === 0) {
            this.enrolling.set(false);
            this.stateService.setEnrollmentStatus({
              success: false,
              message: 'No hay materias con grupos seleccionados',
              errorCode: 'NO_SECTIONS_SELECTED'
            });
            this.openStatusModal();
            return;
          }

          const items = selectedSections.map(sectionId => ({
            enrollment_id: enrollment.id,
            course_section_id: sectionId
          }));

          this.dataService
            .enrollBatch({ items })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (response) => {
                this.enrolling.set(false);
                
                // Verificar si la respuesta indica éxito o error
                if (response && typeof response === 'object') {
                  if ('success' in response && response.success === false) {
                    // Error del backend
                    this.stateService.setEnrollmentStatus({
                      success: false,
                      message: response.message || 'Error al procesar la inscripción',
                      errorCode: response.error?.code,
                      details: response.error?.details
                    });
                  } else {
                    // Éxito
                    this.stateService.setEnrollmentStatus({
                      success: true,
                      message: response.message || 'Inscripción realizada exitosamente'
                    });
                  }
                } else {
                  // Respuesta inesperada, asumir éxito
                  this.stateService.setEnrollmentStatus({
                    success: true,
                    message: 'Inscripción realizada exitosamente'
                  });
                }
                
                // Mostrar modal con el estado
                this.openStatusModal();
              },
              error: (error) => {
                this.enrolling.set(false);
                
                // Extraer mensaje de error
                let errorMessage = 'Error al inscribir las materias';
                let errorCode = 'UNKNOWN_ERROR';
                let errorDetails = null;

                if (error && typeof error === 'object') {
                  if ('message' in error && typeof error.message === 'string') {
                    errorMessage = error.message;
                  }
                  if ('error' in error && error.error) {
                    const err = error.error;
                    if ('code' in err) errorCode = err.code;
                    if ('details' in err) errorDetails = err.details;
                    if ('message' in err && typeof err.message === 'string') {
                      errorMessage = err.message;
                    }
                  }
                }

                this.stateService.setEnrollmentStatus({
                  success: false,
                  message: errorMessage,
                  errorCode,
                  details: errorDetails
                });
                
                // Mostrar modal con el error
                this.openStatusModal();
              }
            });
        },
        error: (error) => {
          this.enrolling.set(false);
          this.stateService.setEnrollmentStatus({
            success: false,
            message: 'Error al obtener la inscripción activa',
            errorCode: 'ENROLLMENT_FETCH_ERROR'
          });
          this.openStatusModal();
        }
      });
  }

  /**
   * Abre el modal para consultar el estado de inscripción
   */
  private openStatusModal(): void {
    this.dialog.open(EnrollmentConfirmationModal, {
      width: '500px',
      disableClose: false
    });
  }

  private showMessage(message: string): void {
    this.snackBar.open(message, 'Cerrar', { duration: 4000 });
  }
}
