import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '../../supabase.service';
import { Meeting, MeetingWithParties, ProposeMeetingDto, RescheduleMeetingDto } from '../models/meeting.model';
import { PaginatedResult } from '../models/pagination.model';

const PAGE_SIZE = 25;

const MEETING_SELECT =
  '*, speaker:profile(nombre_empresa,email), participant:profile(nombre_empresa,email)';

@Injectable({ providedIn: 'root' })
export class MeetingService {
  private readonly supabase = inject(SupabaseService);
  private readonly destroyRef = inject(DestroyRef);
  private channels: RealtimeChannel[] = [];

  readonly meetings = signal<MeetingWithParties[]>([]);
  readonly currentUserId = signal<string | null>(null);

  readonly meetingsAsClient = computed(() =>
    this.meetings().filter(m => m.participant_id === this.currentUserId())
  );

  readonly meetingsAsHost = computed(() =>
    this.meetings().filter(m => m.speaker_id === this.currentUserId())
  );

  readonly actionRequiredCount = computed(() =>
    this.meetings().filter(
      m =>
        ['proposed', 'rescheduled'].includes(m.status) &&
        m.last_updated_by !== this.currentUserId()
    ).length
  );

  constructor() {
    this.destroyRef.onDestroy(() => this.unsubscribeRealtime());
  }

  async getMeetingById(id: string): Promise<MeetingWithParties | null> {
    const { data } = await this.supabase.client
      .from('meeting')
      .select(MEETING_SELECT)
      .eq('id', id);

    return (data?.[0] as MeetingWithParties) ?? null;
  }

  async getAllMeetings(page: number): Promise<PaginatedResult<MeetingWithParties>> {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, count } = await this.supabase.client
      .from('meeting')
      .select(MEETING_SELECT, { count: 'exact' })
      .order('start', { ascending: false })
      .range(from, to);

    const rows = (data ?? []) as MeetingWithParties[];
    this.meetings.set(rows);

    return { data: rows, count: count ?? 0, page, pageSize: PAGE_SIZE };
  }

  async proposeMeeting(data: ProposeMeetingDto): Promise<{ data: Meeting | null; error: unknown }> {
    const { data: result, error } = await this.supabase.client
      .from('meeting')
      .insert(data)
      .select()
      .single();

    return { data: result as Meeting | null, error };
  }

  async acceptMeeting(id: string, responderId: string, note?: string): Promise<{ error: unknown }> {
    const { error } = await this.supabase.client
      .from('meeting')
      .update({ status: 'accepted', last_updated_by: responderId, response_note: note ?? null })
      .eq('id', id);

    return { error };
  }

  async rejectMeeting(id: string, responderId: string, note?: string): Promise<{ error: unknown }> {
    const { error } = await this.supabase.client
      .from('meeting')
      .update({ status: 'rejected', last_updated_by: responderId, response_note: note ?? null })
      .eq('id', id);

    return { error };
  }

  async rescheduleMeeting(id: string, data: RescheduleMeetingDto): Promise<{ error: unknown }> {
    const { error } = await this.supabase.client
      .from('meeting')
      .update(data)
      .eq('id', id);

    return { error };
  }

  async cancelMeetings(ids: string[], reason: string): Promise<{ error: unknown }> {
    const { error } = await this.supabase.client
      .from('meeting')
      .update({ status: 'cancelled', response_note: reason })
      .in('id', ids);

    return { error };
  }

  subscribeRealtime(userId: string, isAdmin = false): void {
    this.currentUserId.set(userId);

    if (isAdmin) {
      const channel = this.supabase.client
        .channel('meetings-admin')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'meeting' },
          payload => this.handleRealtimeEvent(payload)
        )
        .subscribe();

      this.channels.push(channel);
      return;
    }

    const hostChannel = this.supabase.client
      .channel('meetings-host')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meeting', filter: `speaker_id=eq.${userId}` },
        payload => this.handleRealtimeEvent(payload)
      )
      .subscribe();

    const clientChannel = this.supabase.client
      .channel('meetings-client')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meeting', filter: `participant_id=eq.${userId}` },
        payload => this.handleRealtimeEvent(payload)
      )
      .subscribe();

    this.channels.push(hostChannel, clientChannel);
  }

  unsubscribeRealtime(): void {
    for (const channel of this.channels) {
      this.supabase.client.removeChannel(channel);
    }
    this.channels = [];
  }

  private handleRealtimeEvent(payload: { eventType: string; new: unknown; old: unknown }): void {
    if (payload.eventType === 'INSERT') {
      const newRow = payload.new as MeetingWithParties;
      this.meetings.update(current => {
        if (current.some(m => m.id === newRow.id)) return current;
        return [...current, newRow];
      });
    } else if (payload.eventType === 'UPDATE') {
      const updated = payload.new as MeetingWithParties;
      this.meetings.update(current =>
        current.map(m => (m.id === updated.id ? updated : m))
      );
    } else if (payload.eventType === 'DELETE') {
      const deleted = payload.old as { id: string };
      this.meetings.update(current => current.filter(m => m.id !== deleted.id));
    }
  }
}
