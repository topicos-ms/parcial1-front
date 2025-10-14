import { Injectable } from '@angular/core';

interface DecodedToken {
  sub?: string;
  id?: string;
  email?: string;
  role?: string;
  iat?: number;
  exp?: number;
}

interface CurrentUser {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TokenDecoderService {
  getStudentId(): string | null {
    try {
      // Primero intenta desde current_user en localStorage
      const userStr = localStorage.getItem('current_user');
      if (userStr && userStr !== 'undefined') {
        const user: CurrentUser = JSON.parse(userStr);
        if (user?.id) {
          return user.id;
        }
      }

      // Si no, intenta desde el token
      const token = localStorage.getItem('auth_token');
      if (!token) {
        return null;
      }

      const decoded = this.decodeJwt(token);
      return decoded?.id ?? decoded?.sub ?? null;
    } catch (error) {
      console.error('[TokenDecoderService] Error al decodificar token:', error);
      return null;
    }
  }

  private decodeJwt(token: string): DecodedToken | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const payload = parts[1];
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded);
    } catch (error) {
      return null;
    }
  }
}
