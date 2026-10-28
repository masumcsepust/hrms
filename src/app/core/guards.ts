import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth';
import { ToastService } from './toast.service';

/** NFR-1 — role based access to the HR administration screens. */
export const hrGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);
  if (auth.can('hr.manage')) return true;
  toast.show('This area is restricted to HR / payroll authorised users.', 'warn');
  return router.createUrlTree(['/self/profile']);
};
