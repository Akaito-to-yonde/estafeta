import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DestroyRef } from '@angular/core';
import { ProfileService } from './profile.service';
import { SupabaseService } from '../../supabase.service';
import { CreateProfileDto } from '../models/profile.model';

// ---------------------------------------------------------------------------
// Chainable Supabase mock factory
// ---------------------------------------------------------------------------

function makeChainableMock(resolvedValue: unknown) {
  const chain: Record<string, () => unknown> = {};

  const terminal = vi.fn().mockResolvedValue(resolvedValue);

  chain['single'] = terminal;
  chain['select'] = vi.fn().mockReturnValue(chain);
  chain['insert'] = vi.fn().mockReturnValue(chain);
  chain['update'] = vi.fn().mockReturnValue(chain);
  chain['eq'] = vi.fn().mockReturnValue(chain);

  return chain;
}

function makeSupabaseMock() {
  // Realtime channel chain: channel().on().subscribe()
  const subscribeStub = vi.fn().mockReturnValue({ unsubscribe: vi.fn() });
  const onStub = vi.fn().mockReturnValue({ subscribe: subscribeStub });
  const channelStub = vi.fn().mockReturnValue({ on: onStub });
  const removeChannelStub = vi.fn();

  return {
    channelStub,
    onStub,
    subscribeStub,
    removeChannelStub,
    // fromStub is replaced per test
    fromStub: vi.fn(),
    get client() {
      return {
        from: this.fromStub,
        channel: channelStub,
        removeChannel: removeChannelStub,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProfileService — integration (mock Supabase)', () => {
  let service: ProfileService;
  let supabaseMock: ReturnType<typeof makeSupabaseMock>;

  const mockDestroyRef = { onDestroy: vi.fn() };

  beforeEach(() => {
    supabaseMock = makeSupabaseMock();

    TestBed.configureTestingModule({
      providers: [
        ProfileService,
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: DestroyRef, useValue: mockDestroyRef },
      ],
    });

    service = TestBed.inject(ProfileService);
  });

  // -------------------------------------------------------------------------
  // createProfile — must force estado: 'pending'
  // -------------------------------------------------------------------------

  describe('createProfile', () => {
    it('inserts with estado: "pending" regardless of what the DTO contains', async () => {
      const chain = makeChainableMock({ data: null, error: null });
      supabaseMock.fromStub.mockReturnValue(chain);

      const dto: CreateProfileDto = {
        email: 'test@example.com',
        categoria: 'producer',
        nombre_empresa: 'ACME',
        direccion_legal: 'Av. Siempre Viva 123',
        contacto: 'Homer Simpson',
      };

      await service.createProfile(dto);

      expect(supabaseMock.fromStub).toHaveBeenCalledWith('profile');
      expect(chain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ estado: 'pending' }),
      );
    });

    it('does not pass any estado other than "pending" to insert', async () => {
      const chain = makeChainableMock({ data: null, error: null });
      supabaseMock.fromStub.mockReturnValue(chain);

      const dto: CreateProfileDto = {
        email: 'other@example.com',
        categoria: 'client',
        nombre_empresa: 'Contoso',
        direccion_legal: 'Calle Falsa 742',
        contacto: 'Jane Doe',
      };

      await service.createProfile(dto);

      const insertedPayload = (chain['insert'] as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
      expect(insertedPayload['estado']).toBe('pending');
    });
  });

  // -------------------------------------------------------------------------
  // approveProfile — must update to estado: 'approved'
  // -------------------------------------------------------------------------

  describe('approveProfile', () => {
    it('calls update with estado: "approved" and filters by id', async () => {
      const chain = makeChainableMock({ error: null });
      // update().eq() resolves directly (no .select().single() here)
      (chain['eq'] as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });
      supabaseMock.fromStub.mockReturnValue(chain);

      const profileId = 'profile-abc';
      await service.approveProfile(profileId);

      expect(supabaseMock.fromStub).toHaveBeenCalledWith('profile');
      expect(chain['update']).toHaveBeenCalledWith(
        expect.objectContaining({ estado: 'approved' }),
      );
      expect(chain['eq']).toHaveBeenCalledWith('id', profileId);
    });
  });

  // -------------------------------------------------------------------------
  // rejectAndDeleteProfile — must update to estado: 'rejected'
  // -------------------------------------------------------------------------

  describe('rejectAndDeleteProfile', () => {
    it('calls update with estado: "rejected" and filters by id', async () => {
      const chain = makeChainableMock({ error: null });
      (chain['eq'] as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });
      supabaseMock.fromStub.mockReturnValue(chain);

      const profileId = 'profile-xyz';
      await service.rejectAndDeleteProfile(profileId);

      expect(supabaseMock.fromStub).toHaveBeenCalledWith('profile');
      expect(chain['update']).toHaveBeenCalledWith(
        expect.objectContaining({ estado: 'rejected' }),
      );
      expect(chain['eq']).toHaveBeenCalledWith('id', profileId);
    });
  });
});
