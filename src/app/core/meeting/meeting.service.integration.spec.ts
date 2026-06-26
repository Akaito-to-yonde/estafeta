import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DestroyRef } from '@angular/core';
import { MeetingService } from './meeting.service';
import { SupabaseService } from '../../supabase.service';
import { ProposeMeetingDto, RescheduleMeetingDto } from '../models/meeting.model';

// ---------------------------------------------------------------------------
// Chainable Supabase mock factory
// ---------------------------------------------------------------------------

function makeChainableMock(resolvedValue: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};

  const terminal = vi.fn().mockResolvedValue(resolvedValue);

  chain['single'] = terminal;
  chain['select'] = vi.fn().mockReturnValue(chain);
  chain['insert'] = vi.fn().mockReturnValue(chain);
  chain['update'] = vi.fn().mockReturnValue(chain);
  chain['eq'] = vi.fn().mockReturnValue(chain);
  chain['in'] = vi.fn().mockReturnValue(chain);

  return chain;
}

function makeSupabaseMock() {
  const subscribeStub = vi.fn().mockReturnValue({ unsubscribe: vi.fn() });
  const onStub = vi.fn().mockReturnValue({ subscribe: subscribeStub });
  const channelStub = vi.fn().mockReturnValue({ on: onStub });
  const removeChannelStub = vi.fn();

  const mock = {
    channelStub,
    onStub,
    subscribeStub,
    removeChannelStub,
    fromStub: vi.fn(),
    get client() {
      return {
        from: this.fromStub,
        channel: channelStub,
        removeChannel: removeChannelStub,
      };
    },
  };

  return mock;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MeetingService — integration (mock Supabase)', () => {
  let service: MeetingService;
  let supabaseMock: ReturnType<typeof makeSupabaseMock>;

  const mockDestroyRef = { onDestroy: vi.fn() };

  beforeEach(() => {
    supabaseMock = makeSupabaseMock();

    TestBed.configureTestingModule({
      providers: [
        MeetingService,
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: DestroyRef, useValue: mockDestroyRef },
      ],
    });

    service = TestBed.inject(MeetingService);
  });

  // -------------------------------------------------------------------------
  // proposeMeeting — must insert with status: 'proposed'
  // -------------------------------------------------------------------------

  describe('proposeMeeting', () => {
    it('inserts with status: "proposed"', async () => {
      const chain = makeChainableMock({ data: null, error: null });
      supabaseMock.fromStub.mockReturnValue(chain);

      const dto: ProposeMeetingDto = {
        speaker_id: 'speaker-1',
        participant_id: 'participant-1',
        start: '2026-07-01T10:00:00Z',
        ending: '2026-07-01T11:00:00Z',
        location: 'Room A',
        status: 'proposed',
        last_updated_by: 'speaker-1',
      };

      await service.proposeMeeting(dto);

      expect(supabaseMock.fromStub).toHaveBeenCalledWith('meeting');
      expect(chain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'proposed' }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // rescheduleMeeting — must update with status: 'rescheduled'
  // -------------------------------------------------------------------------

  describe('rescheduleMeeting', () => {
    it('calls update with status: "rescheduled" and filters by id', async () => {
      const chain = makeChainableMock({ error: null });
      chain['eq'].mockResolvedValue({ error: null });
      supabaseMock.fromStub.mockReturnValue(chain);

      const meetingId = 'meeting-abc';
      const rescheduleDto: RescheduleMeetingDto = {
        start: '2026-07-02T10:00:00Z',
        ending: '2026-07-02T11:00:00Z',
        location: 'Room B',
        status: 'rescheduled',
        last_updated_by: 'participant-1',
      };

      await service.rescheduleMeeting(meetingId, rescheduleDto);

      expect(supabaseMock.fromStub).toHaveBeenCalledWith('meeting');
      expect(chain['update']).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'rescheduled' }),
      );
      expect(chain['eq']).toHaveBeenCalledWith('id', meetingId);
    });
  });

  // -------------------------------------------------------------------------
  // acceptMeeting — must update with status: 'accepted'
  // -------------------------------------------------------------------------

  describe('acceptMeeting', () => {
    it('calls update with status: "accepted" and filters by id', async () => {
      const chain = makeChainableMock({ error: null });
      chain['eq'].mockResolvedValue({ error: null });
      supabaseMock.fromStub.mockReturnValue(chain);

      const meetingId = 'meeting-def';
      const responderId = 'participant-2';

      await service.acceptMeeting(meetingId, responderId, 'Confirmed, see you there');

      expect(supabaseMock.fromStub).toHaveBeenCalledWith('meeting');
      expect(chain['update']).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'accepted',
          last_updated_by: responderId,
        }),
      );
      expect(chain['eq']).toHaveBeenCalledWith('id', meetingId);
    });

    it('sets response_note to null when no note is provided', async () => {
      const chain = makeChainableMock({ error: null });
      chain['eq'].mockResolvedValue({ error: null });
      supabaseMock.fromStub.mockReturnValue(chain);

      await service.acceptMeeting('meeting-ghi', 'user-1');

      expect(chain['update']).toHaveBeenCalledWith(
        expect.objectContaining({ response_note: null }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // rejectMeeting — must update with status: 'rejected'
  // -------------------------------------------------------------------------

  describe('rejectMeeting', () => {
    it('calls update with status: "rejected" and filters by id', async () => {
      const chain = makeChainableMock({ error: null });
      chain['eq'].mockResolvedValue({ error: null });
      supabaseMock.fromStub.mockReturnValue(chain);

      const meetingId = 'meeting-jkl';
      const responderId = 'participant-3';

      await service.rejectMeeting(meetingId, responderId, 'Schedule conflict');

      expect(supabaseMock.fromStub).toHaveBeenCalledWith('meeting');
      expect(chain['update']).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'rejected',
          last_updated_by: responderId,
        }),
      );
      expect(chain['eq']).toHaveBeenCalledWith('id', meetingId);
    });

    it('sets response_note to null when no note is provided', async () => {
      const chain = makeChainableMock({ error: null });
      chain['eq'].mockResolvedValue({ error: null });
      supabaseMock.fromStub.mockReturnValue(chain);

      await service.rejectMeeting('meeting-mno', 'user-2');

      expect(chain['update']).toHaveBeenCalledWith(
        expect.objectContaining({ response_note: null }),
      );
    });
  });
});
