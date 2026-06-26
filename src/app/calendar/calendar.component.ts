import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions, EventClickArg, EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

import { AuthService } from '../core/auth/auth.service';
import { ConferenceService } from '../core/conference/conference.service';
import { MeetingService } from '../core/meeting/meeting.service';
import { ConferenceWithSpeaker } from '../core/models/conference.model';
import { MeetingWithParties } from '../core/models/meeting.model';
import {
  CalendarEvent,
  CalendarEventColor,
  CalendarEventType,
} from '../core/models/calendar-event.model';
import { ES } from '../shared/i18n/es';

const COLOR_MAP: Record<CalendarEventColor, string> = {
  blue:  '#3b82f6',
  green: '#22c55e',
  red:   '#ef4444',
};

function mapConference(c: ConferenceWithSpeaker): CalendarEvent {
  return {
    id:       `conference-${c.id}`,
    sourceId: c.id,
    type:     'conference',
    title:    c.subject,
    start:    c.start,
    end:      c.ending,
    color:    'blue',
  };
}

function mapMeeting(m: MeetingWithParties): CalendarEvent {
  let color: CalendarEventColor;
  switch (m.status) {
    case 'accepted':
      color = 'green';
      break;
    case 'rejected':
    case 'cancelled':
      color = 'red';
      break;
    default:
      color = 'blue';
  }

  return {
    id:       `meeting-${m.id}`,
    sourceId: m.id,
    type:     'meeting',
    title:    `${m.speaker.nombre_empresa} / ${m.participant.nombre_empresa}`,
    start:    m.start,
    end:      m.ending,
    color,
  };
}

function toEventInput(event: CalendarEvent): EventInput {
  return {
    id:              event.id,
    title:           event.title,
    start:           event.start,
    end:             event.end,
    backgroundColor: COLOR_MAP[event.color],
    borderColor:     COLOR_MAP[event.color],
    extendedProps:   { sourceId: event.sourceId, type: event.type },
  };
}

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FullCalendarModule],
})
export class CalendarComponent {
  private readonly router            = inject(Router);
  private readonly authService       = inject(AuthService);
  private readonly conferenceService = inject(ConferenceService);
  private readonly meetingService    = inject(MeetingService);

  readonly ES = ES;

  readonly isLoading = this.authService.isLoading;

  readonly calendarEvents = computed<CalendarEvent[]>(() => [
    ...this.conferenceService.conferences().map(mapConference),
    ...this.meetingService.meetings().map(mapMeeting),
  ]);

  readonly calendarOptions = computed<CalendarOptions>(() => ({
    plugins:      [dayGridPlugin, timeGridPlugin, interactionPlugin],
    initialView:  'dayGridMonth',
    headerToolbar: {
      left:   'prev,next today',
      center: 'title',
      right:  'dayGridMonth,timeGridWeek',
    },
    locale:      'es',
    buttonText: {
      today:  'Hoy',
      month:  'Mes',
      week:   'Semana',
    },
    events:      this.calendarEvents().map(toEventInput),
    eventClick:  this.onEventClick.bind(this),
    height:      'auto',
  }));

  onEventClick(arg: EventClickArg): void {
    const { sourceId, type } = arg.event.extendedProps as {
      sourceId: string;
      type: CalendarEventType;
    };
    if (type === 'conference') {
      this.router.navigate(['/conferences', sourceId]);
    } else {
      this.router.navigate(['/meetings', sourceId]);
    }
  }
}
