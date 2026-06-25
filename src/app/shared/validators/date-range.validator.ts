import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function dateRangeValidator(startKey: string, endKey: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const startControl = control.get(startKey);
    const endControl = control.get(endKey);

    const startValue = startControl?.value;
    const endValue = endControl?.value;

    if (!startValue || !endValue) {
      return null;
    }

    const start = startValue instanceof Date ? startValue : new Date(startValue as string);
    const end = endValue instanceof Date ? endValue : new Date(endValue as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return null;
    }

    return end <= start ? { dateRange: true } : null;
  };
}
