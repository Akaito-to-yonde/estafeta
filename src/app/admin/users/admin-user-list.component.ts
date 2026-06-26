import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';

import { ProfileService } from '../../core/profile/profile.service';
import {
  Profile,
  ProfileEstado,
  ProfileFilters,
  UserCategoria,
} from '../../core/models/profile.model';
import { DateFormatPipe } from '../../shared/pipes/date-format.pipe';
import { ES } from '../../shared/i18n/es';

interface SelectOption<T extends string> {
  label: string;
  value: T | '';
}

@Component({
  selector: 'app-admin-user-list',
  templateUrl: './admin-user-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, InputTextModule, ReactiveFormsModule, SelectModule, TableModule, DateFormatPipe],
})
export class AdminUserListComponent implements OnInit {
  private readonly profileService = inject(ProfileService);
  private readonly router = inject(Router);

  protected readonly labels = {
    pendingTitle: ES.admin.pendingTitle,
    usersTitle: ES.admin.usersTitle,
    approveButton: ES.admin.approveButton,
    rejectButton: ES.admin.rejectButton,
    rejectNoteLabel: ES.admin.rejectNoteLabel,
    alreadyProcessed: ES.admin.alreadyProcessed,
    noResults: ES.admin.noResults,
    filterCategoria: ES.admin.filters.categoria,
    filterEstado: ES.admin.filters.estado,
    filterAll: ES.admin.filters.all,
    loading: ES.common.loading,
    error: ES.common.error,
    cancel: ES.common.cancel,
    confirm: ES.common.confirm,
  };

  // --- View state ---
  readonly viewMode = signal<'pending' | 'all'>('pending');
  readonly filters = signal<ProfileFilters>({ estado: 'pending' });
  readonly currentPage = signal(1);
  readonly totalCount = signal(0);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly inlineMessage = signal<string | null>(null);

  // --- Inline reject flow ---
  readonly rejectingId = signal<string | null>(null);
  readonly rejectNote = signal('');

  // --- Derived display list from live signals ---
  readonly displayedProfiles = computed<Profile[]>(() => {
    if (this.viewMode() === 'pending') {
      return this.profileService.pendingProfiles();
    }
    return this.profileService.allProfiles();
  });

  // --- Filter/view dropdown options ---
  readonly viewModeOptions: SelectOption<'pending' | 'all'>[] = [
    { label: ES.admin.pendingTitle, value: 'pending' },
    { label: ES.admin.usersTitle, value: 'all' },
  ];

  readonly estadoOptions: SelectOption<ProfileEstado>[] = [
    { label: ES.admin.filters.all, value: '' },
    { label: ES.admin.estados.pending, value: 'pending' },
    { label: ES.admin.estados.approved, value: 'approved' },
    { label: ES.admin.estados.rejected, value: 'rejected' },
    { label: ES.admin.estados.registered, value: 'registered' },
  ];

  readonly categoriaOptions: SelectOption<UserCategoria>[] = [
    { label: ES.admin.filters.all, value: '' },
    { label: ES.register.categorias.producer, value: 'producer' },
    { label: ES.register.categorias.provider, value: 'provider' },
    { label: ES.register.categorias.services, value: 'services' },
    { label: ES.register.categorias.client, value: 'client' },
  ];

  // FormControls for the filter selects (reactive binding for p-select)
  readonly viewModeControl = new FormControl<'pending' | 'all'>('pending', { nonNullable: true });
  readonly estadoControl = new FormControl<ProfileEstado | ''>('pending', { nonNullable: true });
  readonly categoriaControl = new FormControl<UserCategoria | ''>('', { nonNullable: true });

  // Label lookup helpers (accept string to avoid strict-template indexing errors)
  protected getCategoriaLabel(categoria: string): string {
    const map: Record<string, string> = {
      admin: 'Admin',
      producer: ES.register.categorias.producer,
      provider: ES.register.categorias.provider,
      services: ES.register.categorias.services,
      client: ES.register.categorias.client,
    };
    return map[categoria] ?? categoria;
  }

  protected getEstadoLabel(estado: string): string {
    const map: Record<string, string> = {
      pending: ES.admin.estados.pending,
      approved: ES.admin.estados.approved,
      rejected: ES.admin.estados.rejected,
      registered: ES.admin.estados.registered,
    };
    return map[estado] ?? estado;
  }

  async ngOnInit(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      const [pendingResult, allResult] = await Promise.all([
        this.profileService.getPendingProfiles(1),
        this.profileService.getAllProfiles(1, {}),
      ]);
      this.totalCount.set(
        this.viewMode() === 'pending' ? pendingResult.count : allResult.count,
      );
    } catch {
      this.errorMessage.set(ES.common.error);
    } finally {
      this.isLoading.set(false);
    }
  }

  protected async onViewModeChange(value: 'pending' | 'all'): Promise<void> {
    this.viewMode.set(value);
    this.viewModeControl.setValue(value, { emitEvent: false });
    this.currentPage.set(1);
    this.inlineMessage.set(null);
    await this.reload();
  }

  protected async onEstadoChange(value: ProfileEstado | ''): Promise<void> {
    this.estadoControl.setValue(value, { emitEvent: false });
    this.filters.update((f) => ({ ...f, estado: value || undefined }));
    this.currentPage.set(1);
    await this.reload();
  }

  protected async onCategoriaChange(value: UserCategoria | ''): Promise<void> {
    this.categoriaControl.setValue(value, { emitEvent: false });
    this.filters.update((f) => ({ ...f, categoria: value || undefined }));
    this.currentPage.set(1);
    await this.reload();
  }

  protected async onPagePrev(): Promise<void> {
    const page = this.currentPage();
    if (page <= 1) return;
    this.currentPage.set(page - 1);
    await this.reload();
  }

  protected async onPageNext(): Promise<void> {
    this.currentPage.set(this.currentPage() + 1);
    await this.reload();
  }

  protected onRowClick(profile: Profile): void {
    this.router.navigate(['/admin/users', profile.id]);
  }

  protected async onApprove(event: Event, profile: Profile): Promise<void> {
    event.stopPropagation();
    this.inlineMessage.set(null);
    const { error } = await this.profileService.approveProfile(profile.id);
    if (error) {
      this.inlineMessage.set(ES.admin.alreadyProcessed);
    }
  }

  protected onRejectStart(event: Event, profile: Profile): void {
    event.stopPropagation();
    this.rejectingId.set(profile.id);
    this.rejectNote.set('');
  }

  protected onRejectCancel(event: Event): void {
    event.stopPropagation();
    this.rejectingId.set(null);
    this.rejectNote.set('');
  }

  protected async onRejectConfirm(event: Event, profile: Profile): Promise<void> {
    event.stopPropagation();
    this.inlineMessage.set(null);
    const { error } = await this.profileService.rejectAndDeleteProfile(profile.id);
    if (error) {
      this.inlineMessage.set(ES.admin.alreadyProcessed);
    }
    this.rejectingId.set(null);
    this.rejectNote.set('');
  }

  protected onRejectNoteInput(event: Event): void {
    this.rejectNote.set((event.target as HTMLInputElement).value);
  }

  readonly hasPrev = computed(() => this.currentPage() > 1);

  readonly hasNext = computed(() => {
    const pageSize = this.viewMode() === 'pending' ? 50 : 25;
    return this.currentPage() * pageSize < this.totalCount();
  });

  private async reload(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      if (this.viewMode() === 'pending') {
        const result = await this.profileService.getPendingProfiles(
          this.currentPage(),
        );
        this.totalCount.set(result.count);
      } else {
        const result = await this.profileService.getAllProfiles(
          this.currentPage(),
          this.filters(),
        );
        this.totalCount.set(result.count);
      }
    } catch {
      this.errorMessage.set(ES.common.error);
    } finally {
      this.isLoading.set(false);
    }
  }
}
