import { inject } from '@angular/core';
import { Router, type CanActivateFn, type CanActivateChildFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

const ensureAuthenticated = (): boolean => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  router.navigate(['/auth']);
  return false;
};

export const authGuard: CanActivateFn = () => ensureAuthenticated();

export const authChildGuard: CanActivateChildFn = () => ensureAuthenticated();

export const publicGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return true;
  }

  router.navigate(['/dashboard']);
  return false;
};
