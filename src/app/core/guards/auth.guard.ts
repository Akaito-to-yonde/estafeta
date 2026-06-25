import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { RedirectService } from './redirect.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const redirect = inject(RedirectService);
  const router = inject(Router);

  if (auth.session() === null) {
    redirect.setUrl(state.url);
    return router.createUrlTree(['/auth/login']);
  }

  return true;
};
