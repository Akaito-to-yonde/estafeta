import { Pipe, PipeTransform } from '@angular/core';
import { format, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

@Pipe({ name: 'dateFormat' })
export class DateFormatPipe implements PipeTransform {
  transform(value: string | Date | null | undefined, fmt: string): string {
    if (value == null) return '';

    const date = typeof value === 'string' ? parseISO(value) : value;

    if (!isValid(date)) return '';

    return format(date, fmt, { locale: es });
  }
}
