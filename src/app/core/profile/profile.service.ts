import { DestroyRef, Injectable, Signal, inject, signal } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '../../supabase.service';
import { CreateProfileDto, Profile, ProfileEstado, ProfileFilters } from '../models/profile.model';
import { PaginatedResult } from '../models/pagination.model';

const PENDING_PAGE_SIZE = 50;
const ALL_PAGE_SIZE = 25;

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly supabase = inject(SupabaseService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _pendingProfiles = signal<Profile[]>([]);
  private readonly _allProfiles = signal<Profile[]>([]);

  readonly pendingProfiles: Signal<Profile[]> = this._pendingProfiles.asReadonly();
  readonly allProfiles: Signal<Profile[]> = this._allProfiles.asReadonly();

  private channel: RealtimeChannel | null = null;

  constructor() {
    this.subscribeRealtime();
    this.destroyRef.onDestroy(() => this.unsubscribeRealtime());
  }

  async createProfile(data: CreateProfileDto): Promise<{ data: Profile | null; error: unknown }> {
    // Anonymous users cannot read rows from profile (SELECT policy requires auth.uid()).
    // Avoid .select().single() here — PostgREST applies the SELECT policy to RETURNING *,
    // which would return 0 rows and cause single() to throw even if the INSERT succeeded.
    const { error } = await this.supabase.client
      .from('profile')
      .insert({ ...data, estado: 'pending' satisfies ProfileEstado });

    return { data: null, error };
  }

  async getProfile(userId: string): Promise<Profile | null> {
    const { data } = await this.supabase.client
      .from('profile')
      .select('*')
      .eq('user_id', userId)
      .single();

    return (data as Profile | null) ?? null;
  }

  async getProfileById(id: string): Promise<{ data: Profile | null; error: unknown }> {
    const { data, error } = await this.supabase.client
      .from('profile')
      .select('*')
      .eq('id', id)
      .single();

    return { data: (data as Profile | null) ?? null, error };
  }

  async emailExists(email: string): Promise<boolean> {
    const { data } = await this.supabase.client
      .from('profile')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    return !!data;
  }

  async getPendingProfiles(page: number): Promise<PaginatedResult<Profile>> {
    const from = (page - 1) * PENDING_PAGE_SIZE;
    const to = from + PENDING_PAGE_SIZE - 1;

    const { data, count, error } = await this.supabase.client
      .from('profile')
      .select('*', { count: 'exact' })
      .eq('estado', 'pending' satisfies ProfileEstado)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    const profiles = (data ?? []) as Profile[];
    this._pendingProfiles.set(profiles);

    return {
      data: profiles,
      count: count ?? 0,
      page,
      pageSize: PENDING_PAGE_SIZE,
    };
  }

  async getAllProfiles(page: number, filters: ProfileFilters): Promise<PaginatedResult<Profile>> {
    const from = (page - 1) * ALL_PAGE_SIZE;
    const to = from + ALL_PAGE_SIZE - 1;

    let query = this.supabase.client
      .from('profile')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (filters.estado) {
      query = query.eq('estado', filters.estado);
    }
    if (filters.categoria) {
      query = query.eq('categoria', filters.categoria);
    }

    const { data, count, error } = await query;

    if (error) throw error;

    const profiles = (data ?? []) as Profile[];
    this._allProfiles.set(profiles);

    return {
      data: profiles,
      count: count ?? 0,
      page,
      pageSize: ALL_PAGE_SIZE,
    };
  }

  async approveProfile(profileId: string): Promise<{ error: unknown }> {
    const { error } = await this.supabase.client
      .from('profile')
      .update({ estado: 'approved' satisfies ProfileEstado })
      .eq('id', profileId);

    return { error };
  }

  async rejectAndDeleteProfile(profileId: string): Promise<{ error: unknown }> {
    const { error } = await this.supabase.client
      .from('profile')
      .update({ estado: 'rejected' satisfies ProfileEstado })
      .eq('id', profileId);

    return { error };
  }

  async updateEstado(profileId: string, estado: ProfileEstado): Promise<{ error: unknown }> {
    const { error } = await this.supabase.client
      .from('profile')
      .update({ estado })
      .eq('id', profileId);

    return { error };
  }

  subscribeRealtime(): void {
    this.channel = this.supabase.client
      .channel('profile-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profile' }, (payload) => {
        switch (payload.eventType) {
          case 'INSERT': {
            const inserted = payload.new as Profile;
            this._allProfiles.update((profiles) => [inserted, ...profiles]);
            if (inserted.estado === 'pending') {
              this._pendingProfiles.update((profiles) => [inserted, ...profiles]);
            }
            break;
          }
          case 'UPDATE': {
            const updated = payload.new as Profile;
            this._allProfiles.update((profiles) =>
              profiles.map((p) => (p.id === updated.id ? updated : p)),
            );
            this._pendingProfiles.update((profiles) =>
              profiles.map((p) => (p.id === updated.id ? updated : p)),
            );
            break;
          }
          case 'DELETE': {
            const deletedId = (payload.old as Partial<Profile>).id;
            if (deletedId) {
              this._allProfiles.update((profiles) => profiles.filter((p) => p.id !== deletedId));
              this._pendingProfiles.update((profiles) =>
                profiles.filter((p) => p.id !== deletedId),
              );
            }
            break;
          }
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
