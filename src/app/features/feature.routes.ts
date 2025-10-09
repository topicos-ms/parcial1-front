import { Routes } from '@angular/router';

export const featureRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./dashboard/dashboard').then((m) => m.Dashboard)
  }
];
