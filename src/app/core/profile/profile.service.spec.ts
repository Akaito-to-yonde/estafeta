import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';

import { ProfileService } from './profile.service';
import { SupabaseService } from '../../supabase.service';
import { Profile, ProfileEstado, UserCategoria } from '../models/profile.model';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const profileEstadoArb = fc.constantFrom<ProfileEstado>(
  'pending',
  'approved',
  'rejected',
  'registered',
);

const userCategoriaArb = fc.constantFrom<UserCategoria>(
  'admin',
  'producer',
  'provider',
  'services',
  'client',
);

const profileArb = fc.record<Profile>({
  id: fc.uuid(),
  user_id: fc.uuid(),
  email: fc.emailAddress(),
  categoria: userCategoriaArb,
  estado: profileEstadoArb,
  nombre_empresa: fc.string({ minLength: 1, maxLength: 80 }),
  direccion_legal: fc.string({ minLength: 1, maxLength: 120 }),
  contacto: fc.string({ minLength: 1, maxLength: 60 }),
  created_at: fc.date().map((d) => d.toISOString()),
  updated_at: fc.date().map((d) => d.toISOString()),
});

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

/**
 * Builds a fully-chainable Supabase mock.
 *
 * The Realtime callback registered via `.on(event, filter, cb)` is captured
 * into `capturedRealtimeCallback` so tests can invoke it directly.
 */
function buildMockSupabase() {
  let capturedRealtimeCallback: ((payload: unknown) => void) | null = null;

  // Stored result resolved when the chain is awaited.
  let storedResult: { data: Profile[] | null; count: number | null; error: null } = {
    data: null,
    count: null,
    error: null,
  };

  // The chain is a thenable: every method returns `this`, and `await chain`
  // resolves to `storedResult`. This mirrors the real Supabase PostgrestFilterBuilder
  // which is both chainable AND a Promise — so .eq() still works after .range().
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queryChain: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(() => Promise.resolve(storedResult)),
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(storedResult).then(resolve, reject),
  };

  const fakeChannel = {
    on: vi
      .fn()
      .mockImplementation((_event: string, _filter: unknown, cb: (payload: unknown) => void) => {
        capturedRealtimeCallback = cb;
        return fakeChannel;
      }),
    subscribe: vi.fn().mockReturnThis(),
  };

  const mockClient = {
    from: vi.fn().mockReturnValue(queryChain),
    channel: vi.fn().mockReturnValue(fakeChannel),
    removeChannel: vi.fn(),
  };

  return {
    mockClient,
    queryChain,
    fakeChannel,
    getCapturedCallback: () => capturedRealtimeCallback,
    /** Seed the result that `await chain` will resolve to. */
    respondWith(profiles: Profile[], count?: number) {
      storedResult = { data: profiles, count: count ?? profiles.length, error: null };
      queryChain.single = vi.fn().mockResolvedValue({ data: profiles[0] ?? null, error: null });
    },
  };
}

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

function setup() {
  const supabaseMock = buildMockSupabase();

  TestBed.configureTestingModule({
    providers: [
      ProfileService,
      {
        provide: SupabaseService,
        useValue: { client: supabaseMock.mockClient },
      },
    ],
  });

  const service = TestBed.inject(ProfileService);

  return { service, supabaseMock };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Synchronously draw one sample from an arbitrary. */
function sample<T>(arb: fc.Arbitrary<T>): T {
  const [first] = fc.sample(arb, 1);
  if (first === undefined) throw new Error('fc.sample returned empty array');
  return first;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProfileService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  // -------------------------------------------------------------------------
  // Property 27 — pendingProfiles signal mirrors DB result exactly
  // -------------------------------------------------------------------------

  describe('Property 27: pendingProfiles reflects whatever the DB returns', () => {
    it('sets pendingProfiles to the exact array returned by the query', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate 0-20 profiles with any estado value.
          fc.array(profileArb, { minLength: 0, maxLength: 20 }),
          async (profiles) => {
            // Recreate TestBed for each run so signals start clean.
            TestBed.resetTestingModule();
            const { service, supabaseMock } = setup();

            supabaseMock.respondWith(profiles);

            await TestBed.runInInjectionContext(() => service.getPendingProfiles(1));

            const actual = service.pendingProfiles();
            expect(actual).toEqual(profiles);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('reflects the correct page offset in the range call', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          fc.array(profileArb, { minLength: 0, maxLength: 5 }),
          async (page, profiles) => {
            TestBed.resetTestingModule();
            const { service, supabaseMock } = setup();

            supabaseMock.respondWith(profiles);

            await TestBed.runInInjectionContext(() => service.getPendingProfiles(page));

            const PENDING_PAGE_SIZE = 50;
            const expectedFrom = (page - 1) * PENDING_PAGE_SIZE;
            const expectedTo = expectedFrom + PENDING_PAGE_SIZE - 1;

            expect(supabaseMock.queryChain.range).toHaveBeenCalledWith(expectedFrom, expectedTo);
          },
        ),
        { numRuns: 30 },
      );
    });
  });

  // -------------------------------------------------------------------------
  // Property 39 — allProfiles signal mirrors DB result exactly
  // -------------------------------------------------------------------------

  describe('Property 39: allProfiles reflects whatever the DB returns', () => {
    it('sets allProfiles to the exact array returned by the query', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(profileArb, { minLength: 0, maxLength: 20 }),
          fc.record({
            estado: fc.option(profileEstadoArb, { nil: undefined }),
            categoria: fc.option(userCategoriaArb, { nil: undefined }),
          }),
          async (profiles, filters) => {
            TestBed.resetTestingModule();
            const { service, supabaseMock } = setup();

            supabaseMock.respondWith(profiles);

            await TestBed.runInInjectionContext(() => service.getAllProfiles(1, filters));

            expect(service.allProfiles()).toEqual(profiles);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('applies eq filters only when filter values are defined', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            estado: fc.option(profileEstadoArb, { nil: undefined }),
            categoria: fc.option(userCategoriaArb, { nil: undefined }),
          }),
          async (filters) => {
            TestBed.resetTestingModule();
            const { service, supabaseMock } = setup();

            supabaseMock.respondWith([]);

            await TestBed.runInInjectionContext(() => service.getAllProfiles(1, filters));

            const eqCalls: string[] = (
              supabaseMock.queryChain.eq as ReturnType<typeof vi.fn>
            ).mock.calls.map((c: unknown[]) => c[0] as string);

            if (filters.estado !== undefined) {
              expect(eqCalls).toContain('estado');
            } else {
              expect(eqCalls).not.toContain('estado');
            }

            if (filters.categoria !== undefined) {
              expect(eqCalls).toContain('categoria');
            } else {
              expect(eqCalls).not.toContain('categoria');
            }
          },
        ),
        { numRuns: 40 },
      );
    });
  });

  // -------------------------------------------------------------------------
  // Unit — Realtime INSERT
  // -------------------------------------------------------------------------

  describe('Realtime INSERT', () => {
    it('adds a pending item to both pendingProfiles and allProfiles', async () => {
      const { service, supabaseMock } = setup();

      // Seed both signals with one item each.
      const existingPending = { ...sample(profileArb), estado: 'pending' as ProfileEstado };
      const existingAll = { ...sample(profileArb), estado: 'approved' as ProfileEstado };

      supabaseMock.respondWith([existingPending]);
      await TestBed.runInInjectionContext(() => service.getPendingProfiles(1));

      supabaseMock.respondWith([existingAll]);
      await TestBed.runInInjectionContext(() => service.getAllProfiles(1, {}));

      const newPending: Profile = {
        ...sample(profileArb),
        id: 'new-pending-id',
        estado: 'pending',
      };

      const callback = supabaseMock.getCapturedCallback();
      expect(callback).not.toBeNull();

      callback!({ eventType: 'INSERT', new: newPending, old: {} });

      expect(service.pendingProfiles()).toContainEqual(newPending);
      expect(service.allProfiles()).toContainEqual(newPending);
    });

    it('adds a non-pending item to allProfiles but NOT pendingProfiles', async () => {
      const { service, supabaseMock } = setup();

      supabaseMock.respondWith([]);
      await TestBed.runInInjectionContext(() => service.getPendingProfiles(1));
      await TestBed.runInInjectionContext(() => service.getAllProfiles(1, {}));

      const newApproved: Profile = {
        ...sample(profileArb),
        id: 'new-approved-id',
        estado: 'approved',
      };

      const callback = supabaseMock.getCapturedCallback();
      callback!({ eventType: 'INSERT', new: newApproved, old: {} });

      expect(service.allProfiles()).toContainEqual(newApproved);
      expect(service.pendingProfiles()).not.toContainEqual(newApproved);
    });
  });

  // -------------------------------------------------------------------------
  // Unit — Realtime UPDATE patches both signals in-place
  // -------------------------------------------------------------------------

  describe('Realtime UPDATE', () => {
    it('patches the matching item in both signals', async () => {
      const { service, supabaseMock } = setup();

      const original: Profile = {
        ...sample(profileArb),
        id: 'target-id',
        estado: 'pending',
        nombre_empresa: 'Original Name',
      };
      const other: Profile = { ...sample(profileArb), id: 'other-id', estado: 'approved' };

      supabaseMock.respondWith([original]);
      await TestBed.runInInjectionContext(() => service.getPendingProfiles(1));

      supabaseMock.respondWith([original, other]);
      await TestBed.runInInjectionContext(() => service.getAllProfiles(1, {}));

      const updated: Profile = { ...original, nombre_empresa: 'Updated Name', estado: 'approved' };

      const callback = supabaseMock.getCapturedCallback();
      callback!({ eventType: 'UPDATE', new: updated, old: original });

      // allProfiles: the item at 'target-id' is replaced.
      const allItem = service.allProfiles().find((p) => p.id === 'target-id');
      expect(allItem).toEqual(updated);

      // pendingProfiles: also patched in-place (no client-side filtering on UPDATE).
      const pendingItem = service.pendingProfiles().find((p) => p.id === 'target-id');
      expect(pendingItem).toEqual(updated);

      // Unrelated item untouched.
      const otherItem = service.allProfiles().find((p) => p.id === 'other-id');
      expect(otherItem).toEqual(other);
    });
  });

  // -------------------------------------------------------------------------
  // Unit — Realtime DELETE removes from both signals
  // -------------------------------------------------------------------------

  describe('Realtime DELETE', () => {
    it('removes the deleted item from both signals', async () => {
      const { service, supabaseMock } = setup();

      const toDelete: Profile = {
        ...sample(profileArb),
        id: 'delete-me',
        estado: 'pending',
      };
      const survivor: Profile = {
        ...sample(profileArb),
        id: 'keep-me',
        estado: 'approved',
      };

      supabaseMock.respondWith([toDelete]);
      await TestBed.runInInjectionContext(() => service.getPendingProfiles(1));

      supabaseMock.respondWith([toDelete, survivor]);
      await TestBed.runInInjectionContext(() => service.getAllProfiles(1, {}));

      const callback = supabaseMock.getCapturedCallback();
      callback!({ eventType: 'DELETE', new: {}, old: { id: 'delete-me' } });

      expect(service.pendingProfiles().map((p) => p.id)).not.toContain('delete-me');
      expect(service.allProfiles().map((p) => p.id)).not.toContain('delete-me');

      // Survivor still present.
      expect(service.allProfiles().map((p) => p.id)).toContain('keep-me');
    });

    it('does nothing when the DELETE payload has no id', async () => {
      const { service, supabaseMock } = setup();

      const existing: Profile = { ...sample(profileArb), id: 'keep-id', estado: 'pending' };

      supabaseMock.respondWith([existing]);
      await TestBed.runInInjectionContext(() => service.getPendingProfiles(1));
      await TestBed.runInInjectionContext(() => service.getAllProfiles(1, {}));

      const callback = supabaseMock.getCapturedCallback();
      callback!({ eventType: 'DELETE', new: {}, old: {} }); // no id

      expect(service.pendingProfiles()).toHaveLength(1);
      expect(service.allProfiles()).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Unit — subscribeRealtime wires up channel correctly
  // -------------------------------------------------------------------------

  describe('subscribeRealtime', () => {
    it('opens a channel named "profile-changes" and subscribes', () => {
      const { supabaseMock } = setup();

      expect(supabaseMock.mockClient.channel).toHaveBeenCalledWith('profile-changes');
      expect(supabaseMock.fakeChannel.subscribe).toHaveBeenCalled();
    });

    it('registers a listener for postgres_changes on the profile table', () => {
      const { supabaseMock } = setup();

      const [event, filter] = (supabaseMock.fakeChannel.on as ReturnType<typeof vi.fn>).mock
        .calls[0] as [string, { event: string; schema: string; table: string }, unknown];

      expect(event).toBe('postgres_changes');
      expect(filter.event).toBe('*');
      expect(filter.schema).toBe('public');
      expect(filter.table).toBe('profile');
    });
  });
});
