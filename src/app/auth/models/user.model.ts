export enum UserRole {
  STUDENT = 'STUDENT',
  TEACHER = 'TEACHER',
  ADMIN = 'ADMIN'
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName?: string;
  role?: UserRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phone: string;
  studentCode: string;
  nationalId: string;
  birthDate: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginResult {
  token: string;
  email: string;
  firstName: string;
  lastName?: string;
  role?: UserRole;
  id: string;
}
