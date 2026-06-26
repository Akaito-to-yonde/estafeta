import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '../../core/auth/auth.service';
import { ConferenceService } from '../../core/conference/conference.service';
import { ConferenceWithSpeaker } from '../../core/models/conference.model';
import { DateFormatPipe } from '../../shared/pipes/date-format.pipe';
import { ES } from '../../shared/i18n/es';

const MANAGE_ROLES = ['producer', 'provider', 'services', 'admin'] as const;
type ManageRole = (typeof MANAGE_ROLES)[number];

@Component({
  selector: 'app-conference-list',
  templateUrl: './conference-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TableModule, ButtonModule, DateFormatPipe],
})
export class ConferenceListComponent {
  private readonly router = inject(Router);
  private readonly conferenceService = inject(ConferenceService);
  private readonly authService = inject(AuthService);

  readonly i18n = ES.conferences;
  readonly common = ES.common;

  readonly conferences = this.conferenceService.upcomingConferences;
  readonly profile = this.authService.profile;

  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly confirmDeleteId = signal<string | null>(null);

  readonly canCreate = computed(() => {
    const cat = this.profile()?.categoria as ManageRole | undefined;
    return cat != null && (MANAGE_ROLES as readonly string[]).includes(cat);
  });

  canManage(conference: ConferenceWithSpeaker): boolean {
    const p = this.profile();
    if (!p) return false;
    const cat = p.categoria as ManageRole;
    if (!(MANAGE_ROLES as readonly string[]).includes(cat)) return false;
    return p.categoria === 'admin' || conference.speaker_id === p.user_id;
  }

  onRowClick(conference: ConferenceWithSpeaker): void {
    this.router.navigate(['/conferences', conference.id]);
  }

  onNew(): void {
    this.router.navigate(['/conferences', 'new']);
  }

  onEdit(event: Event, conference: ConferenceWithSpeaker): void {
    event.stopPropagation();
    this.router.navigate(['/conferences', conference.id, 'edit']);
  }

  onDeleteRequest(event: Event, conference: ConferenceWithSpeaker): void {
    event.stopPropagation();
    this.confirmDeleteId.set(conference.id);
  }

  onDeleteCancel(event: Event): void {
    event.stopPropagation();
    this.confirmDeleteId.set(null);
  }

  async onDeleteConfirm(event: Event, conference: ConferenceWithSpeaker): Promise<void> {
    event.stopPropagation();
    this.errorMessage.set(null);
    try {
      const { error } = await this.conferenceService.deleteConference(conference.id);
      if (error) {
        this.errorMessage.set(ES.conferences.errors.loadError);
      }
    } catch {
      this.errorMessage.set(ES.common.error);
    } finally {
      this.confirmDeleteId.set(null);
    }
  }
}
