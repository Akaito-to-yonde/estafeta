import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  AsyncValidatorFn,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { from, map, Observable, of, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';

import { ProfileService } from '../../core/profile/profile.service';
import { UserCategoria } from '../../core/models/profile.model';
import { emailFormatValidator } from '../../shared/validators/email-format.validator';
import { ES } from '../../shared/i18n/es';

interface CategoriaOption {
  label: string;
  value: UserCategoria;
}

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    InputTextModule,
    SelectModule,
    TextareaModule,
  ],
})
export class RegisterComponent {
  private readonly profileService = inject(ProfileService);

  protected readonly ES = ES;

  protected readonly isLoading = signal(false);
  protected readonly success = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly categoriaOptions: CategoriaOption[] = [
    { label: ES.register.categorias.producer, value: 'producer' },
    { label: ES.register.categorias.provider, value: 'provider' },
    { label: ES.register.categorias.services, value: 'services' },
    { label: ES.register.categorias.client, value: 'client' },
  ];

  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, emailFormatValidator()],
      asyncValidators: [this.emailExistsValidator()],
      updateOn: 'blur',
    }),
    categoria: new FormControl<UserCategoria | null>(null, {
      validators: [Validators.required],
    }),
    nombre_empresa: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(255)],
    }),
    direccion_legal: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(500)],
    }),
    contacto: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(255)],
    }),
    num_fijo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(20)],
    }),
    num_movil: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(20)],
    }),
    actividad: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
    oferta_busqueda: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(1000)],
    }),
  });

  private emailExistsValidator(): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      const email: string = control.value;
      if (!email) return of(null);
      return timer(400).pipe(
        switchMap(() => from(this.profileService.emailExists(email))),
        map((exists) => (exists ? { emailExists: true } : null)),
      );
    };
  }

  protected async onSubmit(): Promise<void> {
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();
    const dto = {
      email: raw.email,
      categoria: raw.categoria as UserCategoria,
      nombre_empresa: raw.nombre_empresa,
      direccion_legal: raw.direccion_legal,
      contacto: raw.contacto,
      ...(raw.num_fijo ? { num_fijo: raw.num_fijo } : {}),
      ...(raw.num_movil ? { num_movil: raw.num_movil } : {}),
      ...(raw.actividad ? { actividad: raw.actividad } : {}),
      ...(raw.oferta_busqueda ? { oferta_busqueda: raw.oferta_busqueda } : {}),
    };

    const { error } = await this.profileService.createProfile(dto);

    if (error) {
      console.error('[RegisterComponent] createProfile error:', error);
      this.errorMessage.set(ES.common.error);
    } else {
      this.success.set(true);
    }

    this.isLoading.set(false);
  }
}
