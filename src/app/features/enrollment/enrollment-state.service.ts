import { Injectable, signal, computed } from '@angular/core';
import { RecommendedCourseDto } from './enrollment.models';

@Injectable({
  providedIn: 'root'
})
export class EnrollmentStateService {
  private readonly _studentId = signal<string | null>(null);
  private readonly _courses = signal<RecommendedCourseDto[]>([]);
  private readonly _selectedCourses = signal<RecommendedCourseDto[]>([]);

  readonly studentId = this._studentId.asReadonly();
  readonly courses = this._courses.asReadonly();
  readonly selectedCourses = this._selectedCourses.asReadonly();

  setStudentId(id: string): void {
    this._studentId.set(id);
  }

  setCourses(courses: RecommendedCourseDto[]): void {
    this._courses.set(courses);
  }

  setSelectedCourses(courses: RecommendedCourseDto[]): void {
    this._selectedCourses.set(courses);
  }

  clear(): void {
    this._selectedCourses.set([]);
  }
}
