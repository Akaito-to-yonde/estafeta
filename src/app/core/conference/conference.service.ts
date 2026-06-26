import { computed, DestroyRef, inject, Injectable, Signal, signal } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '../../supabase.service';
import {
  Conference,
  ConferenceWithSpeaker,
  CreateConferenceDto,
  UpdateConferenceDto,
} from '../models/conference.model';
import { PaginatedResult } from '../models/pagination.model';

const PAGE_SIZE = 25;
const SPEAKER_SELECT = '*, speaker:profile(nombre_empresa,categoria,contacto,actividad,email)';

@Injectable({ providedIn: 'root' })
export class ConferenceService {
  private readonly supabase = inject(SupabaseService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _conferences = signal<ConferenceWithSpeaker[]>([]);
  private channel: RealtimeChannel | null = null;

  readonly conferences: Signal<ConferenceWithSpeaker[]> = this._conferences.asReadonly();

  readonly upcomingConferences = computed(() =>
    this._conferences()
      .filter((c) => new Date(c.start) >= new Date())
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()),
  );

  constructor() {
    this.getAllConferences(1);
    this.subscribeRealtime();
    this.destroyRef.onDestroy(() => this.unsubscribeRealtime());
  }

  async getConferenceById(id: string): Promise<ConferenceWithSpeaker | null> {
    const { data, error } = await this.supabase.client
      .from('conference')
      .select(SPEAKER_SELECT)
      .eq('id', id);

    if (error) return null;
    return (data as ConferenceWithSpeaker[])[0] ?? null;
  }

  getMyConferences(speakerId: string): ConferenceWithSpeaker[] {
    return this._conferences().filter((c) => c.speaker_id === speakerId);
  }

  async getAllConferences(page: number): Promise<PaginatedResult<ConferenceWithSpeaker>> {
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await this.supabase.client
      .from('conference')
      .select(SPEAKER_SELECT, { count: 'exact' })
      .order('start', { ascending: true })
      .range(from, to);

    if (error || !data) {
      return { data: [], count: 0, page, pageSize: PAGE_SIZE };
    }

    const conferences = data as ConferenceWithSpeaker[];
    this._conferences.set(conferences);

    return { data: conferences, count: count ?? 0, page, pageSize: PAGE_SIZE };
  }

  async createConference(
    data: CreateConferenceDto & { speaker_id: string },
  ): Promise<{ data: Conference | null; error: unknown }> {
    const { data: created, error } = await this.supabase.client
      .from('conference')
      .insert(data)
      .select()
      .single();

    return { data: created as Conference | null, error };
  }

  async updateConference(id: string, data: UpdateConferenceDto): Promise<{ error: unknown }> {
    const { error } = await this.supabase.client.from('conference').update(data).eq('id', id);

    return { error };
  }

  async deleteConference(id: string): Promise<{ error: unknown }> {
    const { error } = await this.supabase.client.from('conference').delete().eq('id', id);

    return { error };
  }

  subscribeRealtime(): void {
    this.channel = this.supabase.client
      .channel('conference-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conference' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          this._conferences.update((list) => [...list, payload.new as ConferenceWithSpeaker]);
        } else if (payload.eventType === 'UPDATE') {
          this._conferences.update((list) =>
            list.map((c) =>
              c.id === (payload.new as ConferenceWithSpeaker).id
                ? (payload.new as ConferenceWithSpeaker)
                : c,
            ),
          );
        } else if (payload.eventType === 'DELETE') {
          this._conferences.update((list) =>
            list.filter((c) => c.id !== (payload.old as { id: string }).id),
          );
        }
      })
      .subscribe();
  }

  unsubscribeRealtime(): void {
    if (this.channel) {
      this.supabase.client.removeChannel(this.channel);
      this.channel = null;
    }
  }
}
