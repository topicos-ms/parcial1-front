import { buildApiPath } from '../api-path.util';

type Identifier = string | number;

export const PROGRAMS_MS_ENDPOINTS = {
  DEGREE_PROGRAMS: {
    ROOT: buildApiPath('degree-programs'),
    BY_ID: (id: Identifier) => buildApiPath('degree-programs', String(id))
  },
  STUDY_PLANS: {
    ROOT: buildApiPath('study-plans'),
    BY_ID: (id: Identifier) => buildApiPath('study-plans', String(id))
  },
  LEVELS: {
    ROOT: buildApiPath('levels'),
    BY_ID: (id: Identifier) => buildApiPath('levels', String(id))
  },
  COURSES: {
    ROOT: buildApiPath('courses'),
    BY_ID: (id: Identifier) => buildApiPath('courses', String(id))
  },
  PREREQUISITES: {
    ROOT: buildApiPath('prerequisites'),
    BY_ID: (id: Identifier) => buildApiPath('prerequisites', String(id))
  }
} as const;
