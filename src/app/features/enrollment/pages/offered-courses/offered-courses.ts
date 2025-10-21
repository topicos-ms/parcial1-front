import { CommonModule } from '@angular/common';
import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal
} from '@angular/core';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { SelectionModel } from '@angular/cdk/collections';

import { RecommendedCourseDto } from '../../enrollment.models';
import { EnrollmentStateService } from '../../enrollment-state.service';

@Component({
  selector: 'app-offered-courses',
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatCheckboxModule,
    MatChipsModule
  ],
  templateUrl: './offered-courses.html',
  styleUrl: './offered-courses.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OfferedCoursesPage {
  private readonly stateService = inject(EnrollmentStateService);
  private readonly router = inject(Router);

  readonly courses = this.stateService.courses;
  readonly selection = new SelectionModel<RecommendedCourseDto>(true, []);

  readonly displayedColumns = ['select', 'code', 'name', 'credits', 'level', 'prerequisites'];

  isAllSelected(): boolean {
    const numSelected = this.selection.selected.length;
    const numRows = this.courses().length;
    return numSelected === numRows;
  }

  toggleAllRows(): void {
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      this.selection.select(...this.courses());
    }
  }

  getPrerequisites(course: RecommendedCourseDto): string {
    if (!course?.prerequisites || course.prerequisites.length === 0) {
      return 'Ninguno';
    }
    return course.prerequisites.map((p) => p.code || p.name).join(', ');
  }

  viewSchedules(): void {
    const selected = this.selection.selected;
    if (selected.length === 0) {
      return;
    }
    
    this.stateService.setSelectedCourses(selected);
    this.router.navigate(['/dashboard/enrollment/schedules']);
  }

  hasSelection(): boolean {
    return this.selection.selected.length > 0;
  }
}
