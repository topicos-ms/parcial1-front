import { Routes } from '@angular/router';
import { publicGuard } from './guards/auth.guard';

export const authRoutes: Routes = [
  {
    path: '',
    canActivate: [publicGuard],
    loadComponent: () =>
      import('./launcher/launcher').then((m) => m.Launcher)
  }
];
