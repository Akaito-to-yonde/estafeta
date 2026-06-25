import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const magicLinkGuard: CanActivateFn = () => {
  const hash = window.location.hash;

  if (hash && hash.includes('access_token=')) {
    return true;
  }

  return inject(Router).createUrlTree(['/auth/login']);
};
