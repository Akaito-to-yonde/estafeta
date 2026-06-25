import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

export const publicOnlyGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.session() !== null) {
    const categoria = auth.profile()?.categoria;
    const home = categoria === 'admin' ? '/admin/users' : '/calendar';
    return router.createUrlTree([home]);
  }

  return true;
};
