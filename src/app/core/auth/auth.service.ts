import { Injectable, Signal, inject, signal } from '@angular/core';
import { AuthError, Session } from '@supabase/supabase-js';
import { Profile, ProfileEstado } from '../models/profile.model';
import { SupabaseService } from '../../supabase.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly supabase = inject(SupabaseService);

  private readonly _session = signal<Session | null>(null);
  private readonly _profile = signal<Profile | null>(null);
  private readonly _isLoading = signal<boolean>(true);

  readonly session: Signal<Session | null> = this._session.asReadonly();
  readonly profile: Signal<Profile | null> = this._profile.asReadonly();
  readonly isLoading: Signal<boolean> = this._isLoading.asReadonly();

  constructor() {
    this.supabase.client.auth.getSession().then(({ data }) => {
      this._session.set(data.session);
      if (data.session) {
        this.loadProfile(data.session.user.id).finally(() => this._isLoading.set(false));
      } else {
        this._isLoading.set(false);
      }
    });

    this.supabase.client.auth.onAuthStateChange((event, session) => {
      this._session.set(session);
      if (event === 'SIGNED_IN' && session) {
        this.loadProfile(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        this._profile.set(null);
      }
    });
  }

  private async loadProfile(userId: string): Promise<void> {
    const { data } = await this.supabase.client
      .from('profile')
      .select('*')
      .eq('user_id', userId)
      .single();
    this._profile.set(data ?? null);
  }

  async checkEmail(email: string): Promise<{ exists: boolean; estado: ProfileEstado | null }> {
    const { data } = await this.supabase.client
      .from('profile')
      .select('estado')
      .eq('email', email)
      .maybeSingle();

    if (!data) {
      return { exists: false, estado: null };
    }
    return { exists: true, estado: data.estado as ProfileEstado };
  }

  async signIn(email: string, password: string): Promise<{ error: AuthError | null }> {
    const { error } = await this.supabase.client.auth.signInWithPassword({ email, password });
    return { error };
  }

  async signOut(): Promise<void> {
    await this.supabase.client.auth.signOut();
    this._session.set(null);
    this._profile.set(null);
  }

  async setPassword(password: string): Promise<{ error: AuthError | null }> {
    const { error } = await this.supabase.client.auth.updateUser({ password });
    if (!error) {
      const userId = this._session()?.user.id;
      if (userId) {
        await this.supabase.client
          .from('profile')
          .update({ estado: 'registered' })
          .eq('user_id', userId);
        await this.loadProfile(userId);
      }
    }
    return { error };
  }

  async refreshSession(): Promise<void> {
    const { data } = await this.supabase.client.auth.refreshSession();
    this._session.set(data.session);
  }
}
