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

import { EnrollmentDataService } from '../enrollment-data.service';
import { CourseSectionDto, RecommendedCourseDto } from '../enrollment.models';
import { EnrollmentStateService } from '../enrollment-state.service';

interface CourseWithSections {
  course: RecommendedCourseDto;
  sections: CourseSectionDto[];
  selectedSectionId: string | null;
  loading: boolean;
  error: string | null;
}

@Component({
  selector: 'app-schedules',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    MatChipsModule,
    MatSnackBarModule,
    MatDividerModule
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
            this.showMessage('No tienes una inscripción activa');
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
            this.showMessage('No hay materias con grupos seleccionados');
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
                this.showMessage('Inscripción realizada exitosamente');
                this.router.navigate(['/dashboard/enrollment']);
              },
              error: (error) => {
                this.enrolling.set(false);
                this.showMessage('Error al inscribir las materias');
              }
            });
        },
        error: (error) => {
          this.enrolling.set(false);
          this.showMessage('Error al obtener la inscripción activa');
        }
      });
  }

  private showMessage(message: string): void {
    this.snackBar.open(message, 'Cerrar', { duration: 4000 });
  }
}
