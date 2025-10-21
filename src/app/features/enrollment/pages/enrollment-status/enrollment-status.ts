import { CommonModule } from '@angular/common';
import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  OnInit,
  inject,
  signal,
  computed,
  effect,
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
import { catchError, filter, map, switchMap, take } from 'rxjs/operators';
import { EnrollmentStateService } from '../../enrollment-state.service';
import { EnrollmentDataService } from '../../enrollment-data.service';
import { EnrollmentDetailDto, EnrollmentScheduleItem, ScheduleDto } from '../../enrollment.models';
import { JobAck, JobStatus, JobUpdate } from '../../../../core/jobs/job.models';
import { JobSocketService } from '../../../../core/jobs/job-socket.service';
import { API_BASE_URL } from '@constants';

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
  private readonly jobSocket = inject(JobSocketService);

  readonly enrollmentStatus = this.stateService.enrollmentStatus;
  readonly isLoading = signal(false);
  readonly scheduleItems = signal<EnrollmentScheduleItem[]>([]);
  readonly scheduleError = signal<string | null>(null);
  readonly processingAck = signal<JobAck | null>(null);
  readonly queueUpdate = signal<JobUpdate | null>(null);
  readonly isWaitingForResult = computed(() => {
    const update = this.queueUpdate();
    if (!update) return true;
    return !(update.status === 'completed' || update.status === 'failed');
  });
  readonly queueStatusLabel = computed(() => this.translateStatus(this.queueUpdate()?.status));
  private readonly statusEffect = effect(() => {
    const status = this.enrollmentStatus();
    if (status?.success) {
      this.loadEnrolledSchedule();
    } else if (status && !status.success) {
      this.scheduleItems.set([]);
      this.scheduleError.set(null);
    }
  });

  ngOnInit(): void {
    const current = this.enrollmentStatus();
    if (current) {
      if (current.success) {
        this.loadEnrolledSchedule();
      } else {
        this.scheduleItems.set([]);
        this.scheduleError.set(null);
      }
      return;
    }

    // No hay estado final aún: seguir el progreso del job si existe ACK
    this.initQueueTracking();
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

  private initQueueTracking(): void {
    // Conectar socket para actualizaciones de job y escuchar cambios de ACK
    this.jobSocket.connect(API_BASE_URL);

    this.dataService
      .getCurrentJobAck()
      .pipe(takeUntilDestroyed(this.destroyRef), filter((ack): ack is JobAck => !!ack))
      .pipe(
        switchMap((ack) => {
          this.startListeningForJob(ack);
          return this.jobSocket
            .jobUpdates()
            .pipe(filter((update) => update.jobId === ack.jobId));
        }),
      )
      .subscribe((update) => {
        this.queueUpdate.set(update);

        if (update.status === 'failed') {
          const parsed = this.parseErrorObject(update.error);
          this.stateService.setEnrollmentStatus({
            success: false,
            message: parsed.message,
            errorCode: parsed.code,
            details: parsed.details,
          });
          return;
        }

        if (update.status === 'completed') {
          const result: any = update.result ?? null;
          const hasExplicitSuccessFlag = !!(result && typeof result === 'object' && 'success' in result);

          if (hasExplicitSuccessFlag) {
            if (result.success === false) {
              const message: string = result?.message || result?.error?.message || 'Error al procesar la inscripción';
              this.stateService.setEnrollmentStatus({
                success: false,
                message,
                errorCode: result?.error?.code,
                details: result?.error?.details,
              });
            } else {
              const message: string = (typeof result.message === 'string' && result.message) ? result.message : 'Inscripción realizada exitosamente';
              this.stateService.setEnrollmentStatus({ success: true, message });
            }
          }
          // Si no trae bandera 'success', ignorar (p.ej., resultados de GET previos)
        }
      });
  }

  private startListeningForJob(ack: JobAck): void {
    this.processingAck.set(ack);
    this.jobSocket.subscribeToJob(ack.jobId);
    this.jobSocket.requestJobStatus(ack.jobId);
  }

  private translateStatus(status?: JobStatus | null): string {
    switch (status) {
      case 'queued':
        return 'En cola';
      case 'processing':
        return 'Procesando';
      case 'progress':
        return 'En progreso';
      case 'delayed':
        return 'En espera (delayed)';
      case 'completed':
        return 'Completado';
      case 'failed':
        return 'Fallido';
      default:
        return 'Sin información';
    }
  }

  private extractJobError(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && 'message' in error) {
      const msg = (error as { message?: unknown }).message;
      if (typeof msg === 'string') return msg;
    }
    return 'El procesamiento de la solicitud falló.';
  }

  private parseErrorObject(error: unknown): { message: string; code?: string; details?: unknown } {
    if (!error) return { message: 'El procesamiento de la solicitud falló.' };
    if (typeof error === 'string') return { message: error };
    if (error instanceof Error) return { message: error.message };
    if (typeof error === 'object') {
      const anyErr = error as any;
      const message: string = anyErr?.message || 'El procesamiento de la solicitud falló.';
      const code: string | undefined = anyErr?.code;
      const details = anyErr?.details;
      return { message, code, details };
    }
    return { message: 'El procesamiento de la solicitud falló.' };
  }
}
