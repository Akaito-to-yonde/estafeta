import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TableModule } from 'primeng/table';
import { AuthService } from '../../core/auth/auth.service';
import { MeetingService } from '../../core/meeting/meeting.service';
import { MeetingWithParties } from '../../core/models/meeting.model';
import { DateFormatPipe } from '../../shared/pipes/date-format.pipe';
import { ES } from '../../shared/i18n/es';

const HOST_ROLES = ['producer', 'provider', 'services'] as const;

@Component({
  selector: 'app-meeting-list',
  templateUrl: './meeting-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TableModule, DateFormatPipe],
})
export class MeetingListComponent {
  private readonly router = inject(Router);
  private readonly meetingService = inject(MeetingService);
  private readonly authService = inject(AuthService);

  readonly i18n = ES.meetings;
  readonly common = ES.common;

  readonly profile = this.authService.profile;

  readonly visibleMeetings = computed<MeetingWithParties[]>(() => {
    const cat = this.profile()?.categoria;
    if (!cat) return [];
    if (cat === 'admin') return this.meetingService.meetings();
    if (cat === 'client') return this.meetingService.meetingsAsClient();
    if ((HOST_ROLES as readonly string[]).includes(cat)) {
      return this.meetingService.meetingsAsHost();
    }
    return [];
  });

  requiresAction(m: MeetingWithParties): boolean {
    const userId = this.profile()?.user_id;
    return ['proposed', 'rescheduled'].includes(m.status) && m.last_updated_by !== userId;
  }

  statusLabel(m: MeetingWithParties): string {
    return this.i18n.statuses[m.status];
  }

  onRowClick(m: MeetingWithParties): void {
    this.router.navigate(['/meetings', m.id]);
  }
}
