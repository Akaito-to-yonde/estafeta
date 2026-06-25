import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';

import { AuthService } from '../../core/auth/auth.service';
import { RedirectService } from '../../core/guards/redirect.service';
import { emailFormatValidator } from '../../shared/validators/email-format.validator';
import { ES } from '../../shared/i18n/es';

const LOCKOUT_MAX_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputTextModule, MessageModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly redirectService = inject(RedirectService);
  private readonly router = inject(Router);

  readonly es = ES;

  readonly step = signal<1 | 2>(1);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  private failedAttempts: { count: number; firstAt: number } = { count: 0, firstAt: 0 };

  readonly emailForm = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, emailFormatValidator()],
    }),
  });

  readonly passwordForm = new FormGroup({
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  get emailValue(): string {
    return this.emailForm.controls.email.value;
  }

  async onEmailSubmit(): Promise<void> {
    if (this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      const { exists, estado } = await this.authService.checkEmail(this.emailValue);

      if (!exists) {
        this.errorMessage.set(ES.auth.notRegisteredError);
        return;
      }

      if (estado === 'pending') {
        this.errorMessage.set(ES.auth.pendingMessage);
        return;
      }

      this.step.set(2);
    } finally {
      this.isLoading.set(false);
    }
  }

  async onPasswordSubmit(): Promise<void> {
    if (this.isLockedOut()) {
      this.errorMessage.set(ES.auth.accountLocked);
      return;
    }

    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      const { error } = await this.authService.signIn(
        this.emailValue,
        this.passwordForm.controls.password.value,
      );

      if (error) {
        this.recordFailedAttempt();

        if (this.isLockedOut()) {
          this.errorMessage.set(ES.auth.accountLocked);
        } else {
          this.errorMessage.set(ES.auth.invalidCredentials);
        }
        return;
      }

      const redirectUrl = this.redirectService.consumeUrl();
      if (redirectUrl) {
        this.router.navigateByUrl(redirectUrl);
        return;
      }

      const profile = this.authService.profile();
      const destination = profile?.categoria === 'admin' ? '/admin/users' : '/calendar';
      this.router.navigateByUrl(destination);
    } finally {
      this.isLoading.set(false);
    }
  }

  private isLockedOut(): boolean {
    if (this.failedAttempts.count < LOCKOUT_MAX_ATTEMPTS) {
      return false;
    }
    return Date.now() - this.failedAttempts.firstAt < LOCKOUT_WINDOW_MS;
  }

  private recordFailedAttempt(): void {
    const now = Date.now();
    if (
      this.failedAttempts.count === 0 ||
      now - this.failedAttempts.firstAt >= LOCKOUT_WINDOW_MS
    ) {
      this.failedAttempts = { count: 1, firstAt: now };
    } else {
      this.failedAttempts.count += 1;
    }
  }
}
