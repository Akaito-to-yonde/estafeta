import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { MeetingService } from '../../core/meeting/meeting.service';
import type { MeetingWithParties, RescheduleMeetingDto } from '../../core/models/meeting.model';
import { AuthService } from '../../core/auth/auth.service';
import { futureDateValidator } from '../../shared/validators/future-date.validator';
import { dateRangeValidator } from '../../shared/validators/date-range.validator';
import { DateFormatPipe } from '../../shared/pipes/date-format.pipe';
import { ES } from '../../shared/i18n/es';

@Component({
  selector: 'app-meeting-detail',
  templateUrl: './meeting-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DateFormatPipe],
})
export class MeetingDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly meetingService = inject(MeetingService);
  private readonly authService = inject(AuthService);

  readonly ES = ES;

  readonly meeting = signal<MeetingWithParties | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly showRescheduleForm = signal(false);
  readonly pendingAction = signal<'accept' | 'reject' | null>(null);
  readonly responseNote = signal('');

  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  readonly availableActions = computed<'full' | 'reschedule-only' | 'none'>(() => {
    const m = this.meeting();
    if (!m) return 'none';
    const userId = this.authService.profile()?.user_id;
    const closedStatuses = ['accepted', 'rejected', 'cancelled'];
    if (closedStatuses.includes(m.status)) return 'none';
    if (['proposed', 'rescheduled'].includes(m.status)) {
      return m.last_updated_by !== userId ? 'full' : 'reschedule-only';
    }
    return 'none';
  });

  readonly rescheduleForm = new FormGroup(
    {
      start: new FormControl('', [Validators.required, futureDateValidator()]),
      ending: new FormControl('', [Validators.required]),
      location: new FormControl('', [Validators.required]),
      response_note: new FormControl(''),
    },
    { validators: dateRangeValidator('start', 'ending') },
  );

  async ngOnInit(): Promise<void> {
    await this.loadMeeting();
  }

  private async loadMeeting(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const result = await this.meetingService.getMeetingById(this.id);
      this.meeting.set(result);
    } catch {
      this.error.set(ES.meetings.errors.loadError);
    } finally {
      this.loading.set(false);
    }
  }

  openReschedule(): void {
    this.showRescheduleForm.set(true);
    this.pendingAction.set(null);
  }

  cancelReschedule(): void {
    this.showRescheduleForm.set(false);
    this.rescheduleForm.reset();
    this.errorMessage.set(null);
  }

  async submitReschedule(): Promise<void> {
    this.rescheduleForm.markAllAsTouched();
    if (this.rescheduleForm.invalid) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const val = this.rescheduleForm.value;
    const userId = this.authService.profile()?.user_id ?? '';
    const dto: RescheduleMeetingDto = {
      start: new Date(val.start!).toISOString(),
      ending: new Date(val.ending!).toISOString(),
      location: val.location!,
      response_note: val.response_note ?? undefined,
      status: 'rescheduled',
      last_updated_by: userId,
    };

    const { error } = await this.meetingService.rescheduleMeeting(this.id, dto);
    if (error) {
      this.errorMessage.set(ES.common.error);
    } else {
      this.showRescheduleForm.set(false);
      this.rescheduleForm.reset();
      await this.loadMeeting();
    }
    this.isLoading.set(false);
  }

  openConfirm(action: 'accept' | 'reject'): void {
    this.pendingAction.set(action);
    this.responseNote.set('');
    this.showRescheduleForm.set(false);
  }

  cancelConfirm(): void {
    this.pendingAction.set(null);
    this.responseNote.set('');
    this.errorMessage.set(null);
  }

  async confirmAction(): Promise<void> {
    const action = this.pendingAction();
    if (!action) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const userId = this.authService.profile()?.user_id ?? '';
    const note = this.responseNote() || undefined;

    const { error } =
      action === 'accept'
        ? await this.meetingService.acceptMeeting(this.id, userId, note)
        : await this.meetingService.rejectMeeting(this.id, userId, note);

    if (error) {
      this.errorMessage.set(ES.common.error);
    } else {
      this.pendingAction.set(null);
      this.responseNote.set('');
      await this.loadMeeting();
    }
    this.isLoading.set(false);
  }

  goBack(): void {
    this.router.navigate(['/meetings']);
  }
}
