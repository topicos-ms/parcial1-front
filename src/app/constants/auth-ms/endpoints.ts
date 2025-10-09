import { buildApiPath } from '../api-path.util';

const AUTH_BASE = buildApiPath('auth');

export const AUTH_MS_ENDPOINTS = {
  REGISTER: `${AUTH_BASE}/register`,
  LOGIN: `${AUTH_BASE}/login`,
  USERS: `${AUTH_BASE}/users`,
  CHECK_STATUS: `${AUTH_BASE}/check-status`,
  UPDATE_USER: `${AUTH_BASE}/update-user`,
  CHANGE_PASSWORD: `${AUTH_BASE}/change-password`,
  LOGOUT: `${AUTH_BASE}/logout`,
  LOGOUT_ALL: `${AUTH_BASE}/logout-all`
} as const;
