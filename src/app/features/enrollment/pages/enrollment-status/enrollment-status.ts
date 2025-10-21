import { CommonModule } from '@angular/common';
import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { EMPTY, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { EnrollmentStateService } from '../../enrollment-state.service';
import { EnrollmentDataService } from '../../enrollment-data.service';
import { EnrollmentDetailDto, EnrollmentScheduleItem, ScheduleDto } from '../../enrollment.models';

/**
 * Componente que muestra el estado de la inscripcion.
 * Muestra si fue exitosa o si hubo errores.
 */
@Component({
  selector: 'app-enrollment-status',
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatChipsModule,
  ],
  templateUrl: './enrollment-status.html',
  styleUrl: './enrollment-status.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnrollmentStatusPage implements OnInit {
  private readonly stateService = inject(EnrollmentStateService);
  private readonly router = inject(Router);
  private readonly dataService = inject(EnrollmentDataService);
  private readonly destroyRef = inject(DestroyRef);

  readonly enrollmentStatus = this.stateService.enrollmentStatus;
  readonly isLoading = signal(false);
  readonly scheduleItems = signal<EnrollmentScheduleItem[]>([]);
  readonly scheduleError = signal<string | null>(null);

  ngOnInit(): void {
    // Si no hay estado de inscripcion, redirigir a la pagina principal
    if (!this.enrollmentStatus()) {
      this.router.navigate(['/dashboard/enrollment']);
      return;
    }

    if (this.enrollmentStatus()?.success) {
      this.loadEnrolledSchedule();
    } else {
      this.scheduleItems.set([]);
      this.scheduleError.set(null);
    }
  }

  /**
   * Vuelve a la pagina principal de inscripcion
   */
  goBack(): void {
    this.stateService.clearEnrollmentStatus();
    this.scheduleItems.set([]);
    this.scheduleError.set(null);
    this.router.navigate(['/dashboard/enrollment']);
  }

  /**
   * Retorna el icono segun el estado
   */
  getStatusIcon(): string {
    const status = this.enrollmentStatus();
    if (status?.success) {
      return 'check_circle';
    }
    return 'error';
  }

  /**
   * Retorna el color segun el estado
   */
  getStatusColor(): string {
    const status = this.enrollmentStatus();
    if (status?.success) {
      return 'success';
    }
    return 'error';
  }

  private loadEnrolledSchedule(): void {
    const studentId = this.stateService.studentId();
    if (!studentId) {
      this.scheduleItems.set([]);
      this.scheduleError.set('No se pudo obtener el identificador del estudiante.');
      return;
    }

    console.log('[EnrollmentStatus] Iniciando carga de horarios para estudiante:', studentId);

    this.isLoading.set(true);
    this.scheduleError.set(null);

    this.dataService
      .getActiveEnrollment(studentId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((response) => {
          const enrollments = Array.isArray(response?.data) ? response.data : [];
          if (!enrollments.length) {
            this.scheduleItems.set([]);
            this.scheduleError.set('No se encontraron materias inscritas en el periodo actual.');
            this.isLoading.set(false);
            console.log('[EnrollmentStatus] Sin inscripcion activa. Operacion cancelada.');
            return EMPTY;
          }

          const enrollment = enrollments[0];
          console.log('[EnrollmentStatus] Inscripcion activa:', enrollment.id);

          const rawDetails = Array.isArray(enrollment?.enrollment_details)
            ? (enrollment.enrollment_details as EnrollmentDetailDto[])
            : [];

          const mapDetailsToItems = (details: EnrollmentDetailDto[]): EnrollmentScheduleItem[] =>
            details
              .map((detail): EnrollmentScheduleItem | null => {
                const section = (detail as any).courseSection ?? detail.course_section ?? null;
                if (!section) {
                  return null;
                }

                const course = section.course ?? null;

                return {
                  detailId: detail.id,
                  courseSectionId: section.id,
                  courseId: course?.id ?? section.course_id,
                  courseCode: course?.code ?? section.course_id ?? 'S/C',
                  courseName: course?.name ?? 'Materia sin nombre',
                  groupLabel: section.group_label,
                  modality: section.modality,
                  shift: section.shift,
                  schedules: [],
                };
              })
              .filter((item): item is EnrollmentScheduleItem => item !== null);

          const itemsFromEnrollment = mapDetailsToItems(rawDetails);

          const baseItems$ = itemsFromEnrollment.length
            ? of(itemsFromEnrollment)
            : this.dataService.listEnrollmentDetailsByEnrollment(enrollment.id).pipe(
                map((detailsResponse) => {
                  const list = Array.isArray(detailsResponse?.data) ? detailsResponse.data : [];
                  console.log(
                    '[EnrollmentStatus] Detalles obtenidos via /enrollment-details:',
                    list.length,
                  );
                  return mapDetailsToItems(list);
                }),
              );

          return baseItems$.pipe(
            switchMap((baseItems) => {
              if (!baseItems.length) {
                this.scheduleItems.set([]);
                this.scheduleError.set('No se encontraron materias asociadas a la inscripcion.');
                this.isLoading.set(false);
                console.log('[EnrollmentStatus] Inscripcion sin detalles de materias.');
                return EMPTY;
              }

              const courseSectionIds = Array.from(
                new Set(baseItems.map((item) => item.courseSectionId).filter(Boolean)),
              );

              if (!courseSectionIds.length) {
                console.log('[EnrollmentStatus] No hay courseSectionId para consultar horarios.');
                return of(baseItems);
              }

              const scheduleRequests = courseSectionIds.map((sectionId) => {
                console.log('[EnrollmentStatus] Consultando horarios para courseSection:', sectionId);

                return this.dataService.getSchedulesByCourseSection(sectionId).pipe(
                  map((scheduleResponse) => ({
                    courseSectionId: sectionId,
                    schedules: Array.isArray(scheduleResponse?.data)
                      ? scheduleResponse.data
                      : ([] as ScheduleDto[]),
                  })),
                  catchError(() =>
                    of({
                      courseSectionId: sectionId,
                      schedules: [] as ScheduleDto[],
                    }),
                  ),
                );
              });

              return forkJoin(scheduleRequests).pipe(
                map((results) => {
                  const schedulesBySection = new Map<string, ScheduleDto[]>();

                  for (const entry of results) {
                    schedulesBySection.set(entry.courseSectionId, entry.schedules);
                  }

                  return baseItems.map((item) => ({
                    ...item,
                    schedules: schedulesBySection.get(item.courseSectionId) ?? [],
                  }));
                }),
              );
            }),
          );
        }),
      )
      .subscribe({
        next: (items) => {
          this.scheduleItems.set(items);
          items.forEach((item) => {
            console.log(
              '[EnrollmentStatus] Horarios recibidos:',
              item.courseSectionId,
              item.schedules,
            );
          });

          const hasSchedules = items.some((item) => item.schedules.length > 0);
          this.scheduleError.set(
            hasSchedules ? null : 'No se encontraron horarios para las materias inscritas.',
          );

          this.isLoading.set(false);
        },
        error: () => {
          this.scheduleItems.set([]);
          this.scheduleError.set('No se pudieron cargar los horarios inscritos.');
          console.log('[EnrollmentStatus] Error cargando horarios.');
          this.isLoading.set(false);
        },
      });
  }
}
