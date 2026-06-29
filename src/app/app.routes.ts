import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { publicOnlyGuard } from './core/guards/public-only.guard';
import { magicLinkGuard } from './core/guards/magic-link.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  // Auth pages — minimal centered layout, no app nav
  {
    path: 'auth',
    loadComponent: () => import('./auth/auth-shell.component').then((m) => m.AuthShellComponent),
    children: [
      {
        path: 'login',
        canActivate: [publicOnlyGuard],
        loadComponent: () => import('./auth/login/login.component').then((m) => m.LoginComponent),
      },
      {
        path: 'register',
        canActivate: [publicOnlyGuard],
        loadComponent: () =>
          import('./auth/register/register.component').then((m) => m.RegisterComponent),
      },
      {
        path: 'set-password',
        canActivate: [magicLinkGuard],
        loadComponent: () =>
          import('./auth/set-password/set-password.component').then((m) => m.SetPasswordComponent),
      },
    ],
  },
  // Admin — dedicated sidebar shell
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard(['admin'])],
    loadComponent: () => import('./admin/admin-shell.component').then((m) => m.AdminShellComponent),
    children: [
      {
        path: 'users',
        loadComponent: () =>
          import('./admin/users/admin-user-list.component').then((m) => m.AdminUserListComponent),
      },
      {
        path: 'users/:id',
        loadComponent: () =>
          import('./admin/users/admin-user-detail.component').then(
            (m) => m.AdminUserDetailComponent,
          ),
      },
    ],
  },
  // Main app — persistent header shell
  {
    path: '',
    loadComponent: () => import('./shell/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./landing/landing.component').then((m) => m.LandingComponent),
      },
      {
        path: 'conferences',
        loadComponent: () =>
          import('./conferences/list/conference-list.component').then(
            (m) => m.ConferenceListComponent,
          ),
      },
      {
        path: 'conferences/new',
        canActivate: [authGuard, roleGuard(['producer', 'provider', 'services', 'admin'])],
        loadComponent: () =>
          import('./conferences/form/conference-form.component').then(
            (m) => m.ConferenceFormComponent,
          ),
      },
      {
        path: 'conferences/:id',
        loadComponent: () =>
          import('./conferences/detail/conference-detail.component').then(
            (m) => m.ConferenceDetailComponent,
          ),
      },
      {
        path: 'conferences/:id/edit',
        canActivate: [authGuard, roleGuard(['producer', 'provider', 'services', 'admin'])],
        loadComponent: () =>
          import('./conferences/form/conference-form.component').then(
            (m) => m.ConferenceFormComponent,
          ),
      },
      {
        path: 'meetings',
        canActivate: [
          authGuard,
          roleGuard(['producer', 'provider', 'services', 'client', 'admin']),
        ],
        loadComponent: () =>
          import('./meetings/list/meeting-list.component').then((m) => m.MeetingListComponent),
      },
      {
        path: 'meetings/new',
        canActivate: [authGuard, roleGuard(['client'])],
        loadComponent: () =>
          import('./meetings/form/meeting-form.component').then((m) => m.MeetingFormComponent),
      },
      {
        path: 'meetings/:id',
        canActivate: [
          authGuard,
          roleGuard(['producer', 'provider', 'services', 'client', 'admin']),
        ],
        loadComponent: () =>
          import('./meetings/detail/meeting-detail.component').then(
            (m) => m.MeetingDetailComponent,
          ),
      },
      {
        path: 'calendar',
        canActivate: [authGuard, roleGuard(['producer', 'provider', 'services', 'client'])],
        loadComponent: () =>
          import('./calendar/calendar.component').then((m) => m.CalendarComponent),
      },
    ],
  },
];
