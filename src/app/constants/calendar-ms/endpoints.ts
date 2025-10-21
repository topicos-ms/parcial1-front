import { buildApiPath } from '../api-path.util';

type Identifier = string | number;

const CALENDAR_ROOT = 'calendar';

export const CALENDAR_MS_ENDPOINTS = {
  MANAGEMENTS: {
    ROOT: buildApiPath(CALENDAR_ROOT, 'managements'),
    BY_ID: (id: Identifier) => buildApiPath(CALENDAR_ROOT, 'managements', String(id))
  },
  PERIODS: {
    ROOT: buildApiPath(CALENDAR_ROOT, 'periods'),
    BY_ID: (id: Identifier) => buildApiPath(CALENDAR_ROOT, 'periods', String(id))
  }
} as const;
