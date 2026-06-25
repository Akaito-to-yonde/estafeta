import { Profile } from './profile.model';

export type MeetingStatus = 'proposed' | 'accepted' | 'rejected' | 'rescheduled' | 'cancelled';

export interface Meeting {
  id: string;
  speaker_id: string;
  participant_id: string;
  start: string;
  ending: string;
  location: string;
  status: MeetingStatus;
  response_note?: string;
  last_updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface MeetingWithParties extends Meeting {
  speaker: Pick<Profile, 'nombre_empresa' | 'email'>;
  participant: Pick<Profile, 'nombre_empresa' | 'email'>;
}

export interface ProposeMeetingDto {
  speaker_id: string;
  participant_id: string;
  start: string;
  ending: string;
  location: string;
  response_note?: string;
  status: 'proposed';
  last_updated_by: string;
}

export interface RescheduleMeetingDto {
  start: string;
  ending: string;
  location: string;
  response_note?: string;
  status: 'rescheduled';
  last_updated_by: string;
}
