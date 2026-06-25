import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ES } from '../../shared/i18n/es';
import { passwordMatchValidator } from '../../shared/validators/password-match.validator';

@Component({
  selector: 'app-set-password',
  templateUrl: './set-password.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
})
export class SetPasswordComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly strings = ES;

  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = new FormGroup(
    {
      password: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(8)],
      }),
      passwordConfirmation: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: passwordMatchValidator('password', 'passwordConfirmation') },
  );

  protected get password() {
    return this.form.controls.password;
  }

  protected get passwordConfirmation() {
    return this.form.controls.passwordConfirmation;
  }

  protected async onSubmit(): Promise<void> {
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const { error } = await this.authService.setPassword(this.form.controls.password.value);

    if (!error) {
      const categoria = this.authService.profile()?.categoria;
      const destination = categoria === 'admin' ? '/admin/users' : '/calendar';
      await this.router.navigateByUrl(destination);
    } else {
      const msg = error.message ?? '';
      const isExpired =
        msg.includes('expired') || msg.includes('invalid') || msg.includes('Token');
      this.errorMessage.set(isExpired ? ES.auth.expiredLink : ES.common.error);
    }

    this.isLoading.set(false);
  }
}
