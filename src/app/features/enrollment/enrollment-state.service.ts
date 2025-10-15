import { Injectable, signal, computed } from '@angular/core';
import { RecommendedCourseDto } from './enrollment.models';

export interface EnrollmentStatusInfo {
  success: boolean;
  message: string;
  errorCode?: string;
  details?: any;
}

@Injectable({
  providedIn: 'root'
})
export class EnrollmentStateService {
  private readonly _studentId = signal<string | null>(null);
  private readonly _courses = signal<RecommendedCourseDto[]>([]);
  private readonly _selectedCourses = signal<RecommendedCourseDto[]>([]);
  private readonly _enrollmentStatus = signal<EnrollmentStatusInfo | null>(null);

  readonly studentId = this._studentId.asReadonly();
  readonly courses = this._courses.asReadonly();
  readonly selectedCourses = this._selectedCourses.asReadonly();
  readonly enrollmentStatus = this._enrollmentStatus.asReadonly();

  setStudentId(id: string): void {
    this._studentId.set(id);
  }

  setCourses(courses: RecommendedCourseDto[]): void {
    this._courses.set(courses);
  }

  setSelectedCourses(courses: RecommendedCourseDto[]): void {
    this._selectedCourses.set(courses);
  }

  setEnrollmentStatus(status: EnrollmentStatusInfo): void {
    this._enrollmentStatus.set(status);
  }

  clearEnrollmentStatus(): void {
    this._enrollmentStatus.set(null);
  }

  clear(): void {
    this._selectedCourses.set([]);
  }
}
