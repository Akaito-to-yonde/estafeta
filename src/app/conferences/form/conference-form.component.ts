import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '../../core/auth/auth.service';
import { ConferenceService } from '../../core/conference/conference.service';
import { OverlapService } from '../../core/overlap/overlap.service';
import { MeetingService } from '../../core/meeting/meeting.service';
import { dateRangeValidator } from '../../shared/validators/date-range.validator';
import { futureDateValidator } from '../../shared/validators/future-date.validator';
import { ES } from '../../shared/i18n/es';

@Component({
  selector: 'app-conference-form',
  templateUrl: './conference-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, InputTextModule, ButtonModule],
})
export class ConferenceFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly conferenceService = inject(ConferenceService);
  private readonly overlapService = inject(OverlapService);
  private readonly meetingService = inject(MeetingService);

  readonly ES = ES;

  readonly isLoading = signal(false);
  readonly isEditMode = signal(false);
  readonly editId = signal<string | null>(null);
  readonly overlapError = signal<string | null>(null);
  readonly meetingConflicts = signal<string[]>([]);
  readonly errorMessage = signal<string | null>(null);

  readonly form = new FormGroup(
    {
      subject: new FormControl('', [Validators.required, Validators.maxLength(500)]),
      start: new FormControl('', [Validators.required, futureDateValidator()]),
      ending: new FormControl('', [Validators.required]),
      location: new FormControl('', [Validators.required, Validators.maxLength(255)]),
    },
    { validators: dateRangeValidator('start', 'ending') },
  );

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.editId.set(id);
      await this.loadConference(id);
    }
  }

  private async loadConference(id: string): Promise<void> {
    this.isLoading.set(true);
    try {
      const conference = await this.conferenceService.getConferenceById(id);
      if (conference) {
        const toLocalInput = (iso: string) => {
          const d = new Date(iso);
          const pad = (n: number) => String(n).padStart(2, '0');
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        };
        this.form.patchValue({
          subject: conference.subject,
          start: toLocalInput(conference.start),
          ending: toLocalInput(conference.ending),
          location: conference.location,
        });
      }
    } catch {
      this.errorMessage.set(ES.conferences.errors.loadError);
    } finally {
      this.isLoading.set(false);
    }
  }

  async onSubmit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.overlapError.set(null);
    this.meetingConflicts.set([]);
    this.errorMessage.set(null);
    this.isLoading.set(true);

    const { subject, start, ending, location } = this.form.getRawValue() as {
      subject: string;
      start: string;
      ending: string;
      location: string;
    };

    const speakerId = this.auth.profile()?.user_id;
    if (!speakerId) {
      this.errorMessage.set(ES.common.error);
      this.isLoading.set(false);
      return;
    }

    const startIso = new Date(start).toISOString();
    const endingIso = new Date(ending).toISOString();

    try {
      const overlapResult = await this.overlapService.checkOverlapRemote({
        start: startIso,
        ending: endingIso,
        type: 'conference',
        excludeId: this.editId() ?? undefined,
        userId: speakerId,
      });

      if (overlapResult.hasOverlap) {
        const conferenceConflicts = overlapResult.conflicts.filter(
          (c) => c.type === 'conference',
        );
        const meetingConflictList = overlapResult.conflicts.filter(
          (c) => c.type === 'meeting',
        );

        if (conferenceConflicts.length > 0) {
          this.overlapError.set(ES.conferences.errors.overlap);
          this.isLoading.set(false);
          return;
        }

        if (meetingConflictList.length > 0) {
          this.meetingConflicts.set(meetingConflictList.map((c) => c.id));
          this.isLoading.set(false);
          return;
        }
      }

      await this.save(subject, startIso, endingIso, location, speakerId);
    } catch {
      this.errorMessage.set(ES.common.error);
      this.isLoading.set(false);
    }
  }

  async cancelMeetingsAndSave(): Promise<void> {
    const ids = this.meetingConflicts();
    if (!ids.length) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const { subject, start, ending, location } = this.form.getRawValue() as {
      subject: string;
      start: string;
      ending: string;
      location: string;
    };
    const speakerId = this.auth.profile()?.user_id;
    if (!speakerId) {
      this.errorMessage.set(ES.common.error);
      this.isLoading.set(false);
      return;
    }

    const startIso = new Date(start).toISOString();
    const endingIso = new Date(ending).toISOString();

    try {
      const { error: cancelError } = await this.meetingService.cancelMeetings(
        ids,
        'Cancelada por solapamiento con conferencia',
      );
      if (cancelError) {
        this.errorMessage.set(ES.common.error);
        this.isLoading.set(false);
        return;
      }
      this.meetingConflicts.set([]);
      await this.save(subject, startIso, endingIso, location, speakerId);
    } catch {
      this.errorMessage.set(ES.common.error);
      this.isLoading.set(false);
    }
  }

  dismissMeetingConflicts(): void {
    this.meetingConflicts.set([]);
  }

  private async save(
    subject: string,
    startIso: string,
    endingIso: string,
    location: string,
    speakerId: string,
  ): Promise<void> {
    const dto = { subject, start: startIso, ending: endingIso, location };

    let error: unknown;

    if (this.isEditMode() && this.editId()) {
      ({ error } = await this.conferenceService.updateConference(this.editId()!, dto));
    } else {
      ({ error } = await this.conferenceService.createConference({
        ...dto,
        speaker_id: speakerId,
      }));
    }

    if (error) {
      this.errorMessage.set(ES.common.error);
      this.isLoading.set(false);
      return;
    }

    await this.router.navigate(['/conferences']);
  }

  goBack(): void {
    void this.router.navigate(['/conferences']);
  }
}
