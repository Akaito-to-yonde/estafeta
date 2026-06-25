export type CalendarEventColor = 'blue' | 'green' | 'red';
export type CalendarEventType = 'conference' | 'meeting';

export interface CalendarEvent {
  id: string;
  sourceId: string;
  type: CalendarEventType;
  title: string;
  start: string;
  end: string;
  color: CalendarEventColor;
}
