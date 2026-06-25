import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function passwordMatchValidator(passwordKey: string, confirmKey: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const passwordControl = control.get(passwordKey);
    const confirmControl = control.get(confirmKey);

    const password = passwordControl?.value;
    const confirm = confirmControl?.value;

    if (!password || !confirm) {
      return null;
    }

    return password !== confirm ? { passwordMismatch: true } : null;
  };
}
