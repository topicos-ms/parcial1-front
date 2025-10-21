import { buildApiPath } from '../api-path.util';

type Identifier = string | number;

export const TEACHING_MS_ENDPOINTS = {
  COURSE_SECTIONS: {
    ROOT: buildApiPath('course-sections'),
    BY_ID: (id: Identifier) => buildApiPath('course-sections', String(id))
  },
  SCHEDULES: {
    ROOT: buildApiPath('schedules'),
    BY_ID: (id: Identifier) => buildApiPath('schedules', String(id))
  }
} as const;
