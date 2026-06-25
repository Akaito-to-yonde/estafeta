import { AbstractControl, ValidatorFn } from '@angular/forms';

export function futureDateValidator(): ValidatorFn {
  return (control: AbstractControl) => {
    const value: unknown = control.value;

    if (value === null || value === undefined || value === '') {
      return null;
    }

    const date = value instanceof Date ? value : new Date(value as string);

    if (isNaN(date.getTime())) {
      return null;
    }

    return date <= new Date() ? { pastDate: true } : null;
  };
}
