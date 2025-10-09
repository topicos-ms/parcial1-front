import { environment } from '../../environments/environment';

const trimSlashes = (value: string): string => value.replace(/\/+$/, '');

const normalizeSegment = (segment: string): string => segment.replace(/^\/+|\/+$/g, '');

export const API_BASE_URL = trimSlashes(environment.baseUrl);

export const buildApiPath = (...segments: string[]): string => {
  const path = segments.filter(Boolean).map(normalizeSegment).join('/');
  return `${API_BASE_URL}/${path}`;
};
