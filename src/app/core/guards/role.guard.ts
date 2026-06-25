import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { UserCategoria } from '../models/profile.model';

function getRoleHome(auth: AuthService): string[] {
  const profile = auth.profile();
  if (profile?.categoria === 'admin') {
    return ['/admin/users'];
  }
  if (auth.session()) {
    return ['/calendar'];
  }
  return ['/conferences'];
}

export function roleGuard(allowedRoles: UserCategoria[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    const categoria = auth.profile()?.categoria;

    if (categoria && allowedRoles.includes(categoria)) {
      return true;
    }

    return router.createUrlTree(getRoleHome(auth));
  };
}
