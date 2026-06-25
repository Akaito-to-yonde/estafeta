import { Profile } from './profile.model';

export interface Conference {
  id: string;
  speaker_id: string;
  subject: string;
  start: string;
  ending: string;
  location: string;
  // created_at: string;
  // updated_at: string;
}

export interface ConferenceWithSpeaker extends Conference {
  speaker: Pick<Profile, 'nombre_empresa' | 'categoria' | 'contacto' | 'actividad' | 'email'>;
}

export interface CreateConferenceDto {
  subject: string;
  start: string;
  ending: string;
  location: string;
}

export type UpdateConferenceDto = Partial<CreateConferenceDto>;
