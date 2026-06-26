import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { MeetingService } from './core/meeting/meeting.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly title = signal('estafeta');

  private readonly auth = inject(AuthService);
  private readonly meetingService = inject(MeetingService);

  constructor() {
    effect(() => {
      const profile = this.auth.profile();
      if (profile) {
        this.meetingService.subscribeRealtime(profile.user_id, profile.categoria === 'admin');
      } else {
        this.meetingService.unsubscribeRealtime();
      }
    });
  }
}
