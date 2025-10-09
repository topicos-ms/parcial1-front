import { Routes } from '@angular/router';
import { authGuard, authChildGuard } from '../auth/guards/auth.guard';

export const featureRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./layout/layout').then((m) => m.Layout),
    canActivate: [authGuard],
    canActivateChild: [authChildGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./dashboard/dashboard').then((m) => m.Dashboard)
      }
    ]
  }
];
