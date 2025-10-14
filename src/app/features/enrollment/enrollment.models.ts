export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export interface TermDto {
  id: string;
  name: string;
  status: string;
  start_date: string;
  end_date: string;
  academic_year_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface StudentSummaryDto {
  id: string;
  code?: string;
  first_name?: string;
  last_name?: string;
}

export interface ScheduleDto {
  id?: string;
  course_section_id?: string;
  weekday: string;
  time_start: string;
  time_end: string;
  classroom_id?: string | null;
}

export interface CourseSectionDto {
  id: string;
  course_id: string;
  term_id: string;
  teacher_id: string | null;
  group_label: string;
  modality: string;
  shift: string;
  quota_max: number;
  quota_available: number;
  status: string;
  schedules?: ScheduleDto[];
}

export interface EnrollmentDetailDto {
  id: string;
  enrollment_id?: string;
  course_section_id: string;
  status?: string;
  final_grade?: number | null;
  remark?: string | null;
  course_section?: CourseSectionDto;
}

export interface EnrollmentDto {
  id: string;
  student_id: string;
  term_id: string;
  state: string;
  enrolled_on: string;
  origin?: string | null;
  note?: string | null;
  student?: StudentSummaryDto;
  term?: TermDto;
  enrollment_details?: EnrollmentDetailDto[];
}

export interface CourseDto {
  id: string;
  study_plan_id?: string;
  level_id?: string;
  code: string;
  name: string;
  credits: number;
  hours_theory?: number;
  hours_practice?: number;
  status: string;
}

export interface EnrollmentBatchItem {
  enrollment_id: string;
  course_section_id: string;
}

export interface EnrollmentBatchRequest {
  items: EnrollmentBatchItem[];
}

export interface EnrollmentResultDto {
  enrollmentDetail: EnrollmentDetailDto;
  remainingQuota: number;
  wasCreated: boolean;
}

export interface EnrollmentBatchResponse {
  success?: boolean;
  message?: string;
  data?: {
    enrollments: EnrollmentResultDto[];
    totals: {
      requested: number;
      processed: number;
    };
    isNewOperation: boolean;
  };
  idempotency?: {
    key: string;
    isNew: boolean;
  };
}

export interface CourseSectionViewModel {
  section: CourseSectionDto;
  course: CourseDto | null;
  isAlreadyEnrolled: boolean;
  hasQuota: boolean;
  scheduleLabel: string;
  recommended?: RecommendedCourseDto | null;
}

export interface RecommendedCoursePrerequisite {
  courseId: string;
  code: string | null;
  name: string | null;
}

export interface RecommendedCourseDto {
  courseId: string;
  code: string;
  name: string;
  credits: number;
  levelId: string | null;
  levelName: string | null;
  levelOrder: number | null;
  prerequisites: RecommendedCoursePrerequisite[];
}

export interface RecommendedCoursesResponse {
  student: {
    id: string;
    code: string;
    studyPlanId: string;
  };
  studyPlan: {
    id: string;
    version: string;
    degreeProgramId: string;
  };
  targetLevel: {
    id: string | null;
    name: string | null;
    order: number | null;
  };
  courses: RecommendedCourseDto[];
}






