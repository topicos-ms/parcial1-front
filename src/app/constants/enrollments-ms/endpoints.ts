import { buildApiPath } from '../api-path.util';

type Identifier = string | number;

export const ENROLLMENTS_MS_ENDPOINTS = {
  ENROLLMENTS: {
    ROOT: buildApiPath('enrollments'),
    BY_ID: (id: Identifier) => buildApiPath('enrollments', String(id))
  },
  ENROLLMENT_DETAILS: {
    ROOT: buildApiPath('enrollment-details'),
    BY_ID: (id: Identifier) => buildApiPath('enrollment-details', String(id))
  },
  ACADEMIC_VALIDATIONS: {
    PREREQUISITES_CHECK: buildApiPath('academic-validations', 'prerequisites', 'check'),
    ENROLLMENT_VALIDATE: buildApiPath('academic-validations', 'enrollment', 'validate')
  },
  ATOMIC_ENROLLMENT: {
    ENROLL: buildApiPath('atomic-enrollment', 'enroll'),
    ENROLL_BATCH: buildApiPath('atomic-enrollment', 'enroll', 'batch'),
    COURSE_SECTION_QUOTA: (id: Identifier) => buildApiPath('atomic-enrollment', 'course-section', String(id), 'quota-status'),
    IDEMPOTENCY_STATS: buildApiPath('atomic-enrollment', 'idempotency', 'stats')
  },
  DATABASE_PERFORMANCE: {
    PREREQUISITES: buildApiPath('database-performance', 'prerequisites'),
    APPROVED_COURSES: buildApiPath('database-performance', 'approved-courses'),
    SCHEDULES: buildApiPath('database-performance', 'schedules'),
    ENROLLMENT_COUNT: buildApiPath('database-performance', 'enrollment-count'),
    BATCH_PREREQUISITES: buildApiPath('database-performance', 'batch-prerequisites'),
    HAS_PASSED: buildApiPath('database-performance', 'has-passed'),
    STUDENT_ENROLLMENT_DETAILS: buildApiPath('database-performance', 'student-enrollment-details')
  }
} as const;
