import { AbstractControl, ValidatorFn } from '@angular/forms';

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

export function emailFormatValidator(): ValidatorFn {
  return (control: AbstractControl) => {
    const value: unknown = control.value;

    if (value === null || value === undefined || value === '') {
      return null;
    }

    if (typeof value !== 'string') {
      return { emailFormat: true };
    }

    if (value.includes('..') || value.startsWith('.') || value.includes(' ')) {
      return { emailFormat: true };
    }

    return EMAIL_REGEX.test(value) ? null : { emailFormat: true };
  };
}
