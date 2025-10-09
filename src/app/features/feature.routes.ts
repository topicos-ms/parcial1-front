import { Routes } from '@angular/router';
import { authGuard, authChildGuard } from '../auth/guards/auth.guard';

export const featureRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layout/layout').then((m) => m.Layout),
    canActivate: [authGuard],
    canActivateChild: [authChildGuard],
    children: [
      {
        path: '',
        redirectTo: 'enrollment',
        pathMatch: 'full'
      },
      {
        path: 'enrollment',
        loadComponent: () =>
          import('./enrollment/enrollment').then((m) => m.EnrollmentPage)
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./dashboard/dashboard').then((m) => m.Dashboard)
      }
    ]
  }
];
