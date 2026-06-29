import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ProfileService } from '../../core/profile/profile.service';
import { Profile } from '../../core/models/profile.model';
import { DateFormatPipe } from '../../shared/pipes/date-format.pipe';
import { ES } from '../../shared/i18n/es';

@Component({
  selector: 'app-admin-user-detail',
  templateUrl: './admin-user-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, InputTextModule, ReactiveFormsModule, DateFormatPipe],
})
export class AdminUserDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly profileService = inject(ProfileService);

  readonly profile = signal<Profile | null>(null);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly actionMessage = signal<string | null>(null);
  readonly isActing = signal(false);
  readonly showRejectInput = signal(false);
  readonly rejectNote = new FormControl('');

  readonly ES = ES;

  private profileId = '';

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.errorMessage.set(ES.common.error);
      this.isLoading.set(false);
      return;
    }
    this.profileId = id;
    void this.loadProfile();
  }

  private async loadProfile(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      const { data, error } = await this.profileService.getProfileById(this.profileId);
      if (error || !data) {
        this.errorMessage.set(ES.common.error);
      } else {
        this.profile.set(data);
      }
    } catch {
      this.errorMessage.set(ES.common.error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async approve(): Promise<void> {
    const p = this.profile();
    if (!p || p.estado !== 'pending') {
      this.actionMessage.set(ES.admin.alreadyProcessed);
      return;
    }
    this.isActing.set(true);
    this.actionMessage.set(null);
    const { error } = await this.profileService.approveProfile(p.id);
    if (error) {
      this.actionMessage.set(ES.common.error);
    } else {
      await this.loadProfile();
    }
    this.isActing.set(false);
  }

  startReject(): void {
    this.showRejectInput.set(true);
    this.rejectNote.reset('');
  }

  cancelReject(): void {
    this.showRejectInput.set(false);
    this.rejectNote.reset('');
  }

  async confirmReject(): Promise<void> {
    const p = this.profile();
    if (!p || p.estado !== 'pending') {
      this.actionMessage.set(ES.admin.alreadyProcessed);
      this.showRejectInput.set(false);
      return;
    }
    this.isActing.set(true);
    this.actionMessage.set(null);
    const { error } = await this.profileService.rejectAndDeleteProfile(p.id);
    if (error) {
      this.actionMessage.set(ES.common.error);
    } else {
      this.showRejectInput.set(false);
      await this.loadProfile();
    }
    this.isActing.set(false);
  }

  goBack(): void {
    void this.router.navigate(['/admin/users']);
  }

  getCategoriaLabel(categoria: string): string {
    const map: Record<string, string> = {
      producer: ES.register.categorias.producer,
      provider: ES.register.categorias.provider,
      services: ES.register.categorias.services,
      client: ES.register.categorias.client,
    };
    return map[categoria] ?? categoria;
  }

  getEstadoLabel(estado: string): string {
    const map: Record<string, string> = {
      pending: ES.admin.estados.pending,
      approved: ES.admin.estados.approved,
      rejected: ES.admin.estados.rejected,
      registered: ES.admin.estados.registered,
    };
    return map[estado] ?? estado;
  }
}
