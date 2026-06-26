import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '../../core/auth/auth.service';
import { MeetingService } from '../../core/meeting/meeting.service';
import { ProfileService } from '../../core/profile/profile.service';
import { OverlapService } from '../../core/overlap/overlap.service';
import { Profile } from '../../core/models/profile.model';
import { futureDateValidator } from '../../shared/validators/future-date.validator';
import { dateRangeValidator } from '../../shared/validators/date-range.validator';
import { ES } from '../../shared/i18n/es';

const HOST_CATEGORIES = ['producer', 'provider', 'services'] as const;

@Component({
  selector: 'app-meeting-form',
  templateUrl: './meeting-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    SelectModule,
    InputTextModule,
    TextareaModule,
    ButtonModule,
  ],
})
export class MeetingFormComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly meetingService = inject(MeetingService);
  private readonly profileService = inject(ProfileService);
  private readonly overlapService = inject(OverlapService);

  readonly i18n = ES.meetings;
  readonly common = ES.common;
  readonly endBeforeStartError = ES.conferences.errors.endBeforeStart;

  readonly hosts = signal<Profile[]>([]);
  readonly isLoading = signal(false);
  readonly overlapError = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly form = new FormGroup(
    {
      speaker_id: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      start: new FormControl('', { nonNullable: true, validators: [Validators.required, futureDateValidator()] }),
      ending: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      location: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(255)] }),
      response_note: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    },
    { validators: dateRangeValidator('start', 'ending') }
  );

  ngOnInit(): void {
    void this.loadHosts();
  }

  private async loadHosts(): Promise<void> {
    const speakerId = this.route.snapshot.queryParamMap.get('speakerId');

    const result = await this.profileService.getAllProfiles(1, { estado: 'approved' });
    const filtered = result.data.filter(
      (p) => (HOST_CATEGORIES as readonly string[]).includes(p.categoria)
    );
    this.hosts.set(filtered);

    if (speakerId) {
      this.form.get('speaker_id')?.setValue(speakerId);
      this.form.get('speaker_id')?.disable();
    }
  }

  async onSubmit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.isLoading.set(true);
    this.overlapError.set(null);
    this.errorMessage.set(null);

    const currentUser = this.authService.profile();
    if (!currentUser) {
      this.errorMessage.set(this.common.error);
      this.isLoading.set(false);
      return;
    }

    const raw = this.form.getRawValue();
    const startIso = new Date(raw.start).toISOString();
    const endingIso = new Date(raw.ending).toISOString();

    const [hostOverlap, clientOverlap] = await Promise.all([
      this.overlapService.checkOverlapRemote({
        start: startIso,
        ending: endingIso,
        type: 'meeting',
        userId: raw.speaker_id,
      }),
      this.overlapService.checkOverlapRemote({
        start: startIso,
        ending: endingIso,
        type: 'meeting',
        userId: currentUser.user_id,
      }),
    ]);

    if (hostOverlap.hasOverlap || clientOverlap.hasOverlap) {
      this.overlapError.set(this.i18n.errors.overlap);
      this.isLoading.set(false);
      return;
    }

    const { error } = await this.meetingService.proposeMeeting({
      speaker_id: raw.speaker_id,
      participant_id: currentUser.user_id,
      start: startIso,
      ending: endingIso,
      location: raw.location,
      response_note: raw.response_note || undefined,
      status: 'proposed',
      last_updated_by: currentUser.user_id,
    });

    if (error) {
      this.errorMessage.set(this.common.error);
      this.isLoading.set(false);
      return;
    }

    await this.router.navigate(['/meetings']);
    this.isLoading.set(false);
  }

  onBack(): void {
    this.router.navigate(['/meetings']);
  }
}
