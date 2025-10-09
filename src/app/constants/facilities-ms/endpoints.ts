import { buildApiPath } from '../api-path.util';

type Identifier = string | number;

export const FACILITIES_MS_ENDPOINTS = {
  CLASSROOMS: {
    ROOT: buildApiPath('classrooms'),
    BY_ID: (id: Identifier) => buildApiPath('classrooms', String(id))
  }
} as const;
