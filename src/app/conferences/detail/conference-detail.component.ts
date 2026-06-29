import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '../../core/auth/auth.service';
import { ConferenceService } from '../../core/conference/conference.service';
import { ConferenceWithSpeaker } from '../../core/models/conference.model';
import { ES } from '../../shared/i18n/es';
import { DateFormatPipe } from '../../shared/pipes/date-format.pipe';

@Component({
  selector: 'app-conference-detail',
  templateUrl: './conference-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, DateFormatPipe],
})
export class ConferenceDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly conferenceService = inject(ConferenceService);
  private readonly authService = inject(AuthService);

  readonly session = this.authService.session;
  readonly profile = this.authService.profile;

  readonly conference = signal<ConferenceWithSpeaker | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);

  readonly ES = ES;

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set(true);
      this.loading.set(false);
      return;
    }

    try {
      const data = await this.conferenceService.getConferenceById(id);
      if (data) {
        this.conference.set(data);
      } else {
        this.error.set(true);
      }
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  readonly canPropose = computed(
    () => this.session() !== null && this.profile()?.categoria === 'client',
  );

  readonly canEdit = computed(() => {
    const p = this.profile();
    const c = this.conference();
    if (!p || !c) return false;
    return p.user_id === c.speaker_id || p.categoria === 'admin';
  });

  proposeMeeting(): void {
    const c = this.conference();
    if (!c) return;
    this.router.navigate(['/meetings/new'], { queryParams: { speakerId: c.speaker_id } });
  }

  editConference(): void {
    const c = this.conference();
    if (!c) return;
    this.router.navigate(['/conferences', c.id, 'edit']);
  }

  goBack(): void {
    this.router.navigate(['/conferences']);
  }
}
