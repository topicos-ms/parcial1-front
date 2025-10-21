import { buildApiPath } from '../api-path.util';

type Identifier = string | number;

export const ASSESSMENTS_MS_ENDPOINTS = {
  GRADES: {
    ROOT: buildApiPath('grades'),
    BY_ID: (id: Identifier) => buildApiPath('grades', String(id))
  }
} as const;
