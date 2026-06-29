import { Injectable, inject } from '@angular/core';
import { TimeInterval } from '../models/interval.model';
import { SupabaseService } from '../../supabase.service';

export interface OverlapCheckRequest {
  start: string;
  ending: string;
  type: 'conference' | 'meeting';
  excludeId?: string;
  userId: string;
}

export interface OverlapCheckResponse {
  hasOverlap: boolean;
  conflicts: Array<{
    id: string;
    type: 'conference' | 'meeting';
    start: string;
    ending: string;
    status?: string;
  }>;
}

@Injectable({
  providedIn: 'root',
})
export class OverlapService {
  private readonly supabase = inject(SupabaseService);

  intervalsOverlap(a: TimeInterval, b: TimeInterval): boolean {
    return new Date(a.start) < new Date(b.end) && new Date(b.start) < new Date(a.end);
  }

  findOverlaps(proposed: TimeInterval, existing: TimeInterval[]): TimeInterval[] {
    return existing.filter((interval) => this.intervalsOverlap(proposed, interval));
  }

  async checkOverlapRemote(req: OverlapCheckRequest): Promise<OverlapCheckResponse> {
    const { data, error } = await this.supabase.client.functions.invoke<OverlapCheckResponse>(
      'overlap-check',
      { body: req },
    );
    if (error) {
      throw error;
    }
    return data!;
  }
}
