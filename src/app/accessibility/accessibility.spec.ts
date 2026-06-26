import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute } from '@angular/router';
import axe from 'axe-core';

import { LoginComponent } from '../auth/login/login.component';
import { RegisterComponent } from '../auth/register/register.component';
import { SetPasswordComponent } from '../auth/set-password/set-password.component';
import { ConferenceListComponent } from '../conferences/list/conference-list.component';
import { ConferenceFormComponent } from '../conferences/form/conference-form.component';
import { MeetingListComponent } from '../meetings/list/meeting-list.component';
import { MeetingDetailComponent } from '../meetings/detail/meeting-detail.component';
import { MeetingFormComponent } from '../meetings/form/meeting-form.component';
import { CalendarComponent } from '../calendar/calendar.component';
import { AdminUserListComponent } from '../admin/users/admin-user-list.component';
import { AdminUserDetailComponent } from '../admin/users/admin-user-detail.component';

import { AuthService } from '../core/auth/auth.service';
import { RedirectService } from '../core/guards/redirect.service';
import { ConferenceService } from '../core/conference/conference.service';
import { MeetingService } from '../core/meeting/meeting.service';
import { OverlapService } from '../core/overlap/overlap.service';
import { ProfileService } from '../core/profile/profile.service';
import { SupabaseService } from '../supabase.service';

// ---------------------------------------------------------------------------
// Shared mock factory helpers
// ---------------------------------------------------------------------------

function makeAuthServiceMock() {
  return {
    session: signal(null),
    profile: signal(null),
    isLoading: signal(false),
  };
}

function makeActivatedRouteMock(paramMapValue: Record<string, string> = {}) {
  return {
    snapshot: {
      paramMap: {
        get: vi.fn((key: string) => paramMapValue[key] ?? null),
      },
      queryParamMap: {
        get: vi.fn((key: string) => paramMapValue[key] ?? null),
      },
    },
  };
}

function makeSupabaseChainMock() {
  const chain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockReturnThis(),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  };
  return { client: chain };
}

// ---------------------------------------------------------------------------
// Accessibility test suite
// ---------------------------------------------------------------------------

describe('Accessibility', () => {
  // -------------------------------------------------------------------------
  // 1. LoginComponent
  // -------------------------------------------------------------------------
  it('LoginComponent has no axe violations', async () => {
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        provideAnimations(),
        { provide: AuthService, useValue: makeAuthServiceMock() },
        { provide: RedirectService, useValue: { consumeUrl: vi.fn().mockReturnValue(null) } },
      ],
    });

    try {
      const fixture = TestBed.createComponent(LoginComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      const results = await axe.run(fixture.nativeElement as HTMLElement);
      expect(results.violations).toHaveLength(0);
    } catch (err) {
      throw new Error(`LoginComponent render or axe failed: ${(err as Error).message}`);
    }
  });

  // -------------------------------------------------------------------------
  // 2. RegisterComponent
  // -------------------------------------------------------------------------
  it('RegisterComponent has no axe violations', async () => {
    const supabaseMock = makeSupabaseChainMock();

    TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        provideRouter([]),
        provideAnimations(),
        {
          provide: ProfileService,
          useValue: {
            pendingProfiles: signal([]),
            allProfiles: signal([]),
            checkEmailExists: vi.fn().mockResolvedValue(false),
          },
        },
        { provide: SupabaseService, useValue: supabaseMock },
      ],
    });

    try {
      const fixture = TestBed.createComponent(RegisterComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      const results = await axe.run(fixture.nativeElement as HTMLElement);
      expect(results.violations).toHaveLength(0);
    } catch (err) {
      throw new Error(`RegisterComponent render or axe failed: ${(err as Error).message}`);
    }
  });

  // -------------------------------------------------------------------------
  // 3. SetPasswordComponent
  // -------------------------------------------------------------------------
  it('SetPasswordComponent has no axe violations', async () => {
    TestBed.configureTestingModule({
      imports: [SetPasswordComponent],
      providers: [
        provideRouter([]),
        provideAnimations(),
        { provide: AuthService, useValue: makeAuthServiceMock() },
      ],
    });

    try {
      const fixture = TestBed.createComponent(SetPasswordComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      const results = await axe.run(fixture.nativeElement as HTMLElement);
      expect(results.violations).toHaveLength(0);
    } catch (err) {
      throw new Error(`SetPasswordComponent render or axe failed: ${(err as Error).message}`);
    }
  });

  // -------------------------------------------------------------------------
  // 4. ConferenceListComponent
  // -------------------------------------------------------------------------
  it('ConferenceListComponent has no axe violations', async () => {
    TestBed.configureTestingModule({
      imports: [ConferenceListComponent],
      providers: [
        provideRouter([]),
        provideAnimations(),
        {
          provide: ConferenceService,
          useValue: {
            upcomingConferences: signal([]),
            conferences: signal([]),
          },
        },
        { provide: AuthService, useValue: makeAuthServiceMock() },
      ],
    });

    try {
      const fixture = TestBed.createComponent(ConferenceListComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      const results = await axe.run(fixture.nativeElement as HTMLElement);
      expect(results.violations).toHaveLength(0);
    } catch (err) {
      throw new Error(`ConferenceListComponent render or axe failed: ${(err as Error).message}`);
    }
  });

  // -------------------------------------------------------------------------
  // 5. ConferenceFormComponent
  // -------------------------------------------------------------------------
  it('ConferenceFormComponent has no axe violations', async () => {
    TestBed.configureTestingModule({
      imports: [ConferenceFormComponent],
      providers: [
        provideRouter([]),
        provideAnimations(),
        { provide: AuthService, useValue: makeAuthServiceMock() },
        {
          provide: ConferenceService,
          useValue: {
            upcomingConferences: signal([]),
            conferences: signal([]),
            getConferenceById: vi.fn().mockResolvedValue({ data: null, error: null }),
          },
        },
        {
          provide: OverlapService,
          useValue: { checkConferenceOverlap: vi.fn().mockResolvedValue(null) },
        },
        {
          provide: MeetingService,
          useValue: {
            meetings: signal([]),
            meetingsAsClient: signal([]),
            meetingsAsHost: signal([]),
            getMeetingsByConference: vi.fn().mockResolvedValue([]),
          },
        },
        { provide: ActivatedRoute, useValue: makeActivatedRouteMock() },
      ],
    });

    try {
      const fixture = TestBed.createComponent(ConferenceFormComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      const results = await axe.run(fixture.nativeElement as HTMLElement);
      expect(results.violations).toHaveLength(0);
    } catch (err) {
      throw new Error(`ConferenceFormComponent render or axe failed: ${(err as Error).message}`);
    }
  });

  // -------------------------------------------------------------------------
  // 6. MeetingListComponent
  // -------------------------------------------------------------------------
  it('MeetingListComponent has no axe violations', async () => {
    TestBed.configureTestingModule({
      imports: [MeetingListComponent],
      providers: [
        provideRouter([]),
        provideAnimations(),
        {
          provide: MeetingService,
          useValue: {
            meetings: signal([]),
            meetingsAsClient: signal([]),
            meetingsAsHost: signal([]),
          },
        },
        { provide: AuthService, useValue: makeAuthServiceMock() },
      ],
    });

    try {
      const fixture = TestBed.createComponent(MeetingListComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      const results = await axe.run(fixture.nativeElement as HTMLElement);
      expect(results.violations).toHaveLength(0);
    } catch (err) {
      throw new Error(`MeetingListComponent render or axe failed: ${(err as Error).message}`);
    }
  });

  // -------------------------------------------------------------------------
  // 7. MeetingDetailComponent
  // -------------------------------------------------------------------------
  it('MeetingDetailComponent has no axe violations', async () => {
    TestBed.configureTestingModule({
      imports: [MeetingDetailComponent],
      providers: [
        provideRouter([]),
        provideAnimations(),
        {
          provide: MeetingService,
          useValue: {
            meetings: signal([]),
            meetingsAsClient: signal([]),
            meetingsAsHost: signal([]),
            getMeetingById: vi.fn().mockResolvedValue({ data: null, error: null }),
          },
        },
        { provide: AuthService, useValue: makeAuthServiceMock() },
        { provide: ActivatedRoute, useValue: makeActivatedRouteMock({ id: 'test-id' }) },
      ],
    });

    try {
      const fixture = TestBed.createComponent(MeetingDetailComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      const results = await axe.run(fixture.nativeElement as HTMLElement);
      expect(results.violations).toHaveLength(0);
    } catch (err) {
      throw new Error(`MeetingDetailComponent render or axe failed: ${(err as Error).message}`);
    }
  });

  // -------------------------------------------------------------------------
  // 8. MeetingFormComponent
  // -------------------------------------------------------------------------
  it('MeetingFormComponent has no axe violations', async () => {
    TestBed.configureTestingModule({
      imports: [MeetingFormComponent],
      providers: [
        provideRouter([]),
        provideAnimations(),
        { provide: AuthService, useValue: makeAuthServiceMock() },
        {
          provide: MeetingService,
          useValue: {
            meetings: signal([]),
            meetingsAsClient: signal([]),
            meetingsAsHost: signal([]),
            createMeeting: vi.fn().mockResolvedValue({ data: null, error: null }),
          },
        },
        {
          provide: ConferenceService,
          useValue: {
            upcomingConferences: signal([]),
            conferences: signal([]),
          },
        },
        {
          provide: OverlapService,
          useValue: { checkMeetingOverlap: vi.fn().mockResolvedValue(null) },
        },
        {
          provide: ProfileService,
          useValue: {
            pendingProfiles: signal([]),
            allProfiles: signal([]),
            getAllProfiles: vi.fn().mockResolvedValue({ data: [], count: 0, page: 1, pageSize: 25 }),
          },
        },
        { provide: ActivatedRoute, useValue: makeActivatedRouteMock() },
      ],
    });

    try {
      const fixture = TestBed.createComponent(MeetingFormComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      const results = await axe.run(fixture.nativeElement as HTMLElement);
      expect(results.violations).toHaveLength(0);
    } catch (err) {
      throw new Error(`MeetingFormComponent render or axe failed: ${(err as Error).message}`);
    }
  });

  // -------------------------------------------------------------------------
  // 9. CalendarComponent
  // -------------------------------------------------------------------------
  it('CalendarComponent has no axe violations', async () => {
    TestBed.configureTestingModule({
      imports: [CalendarComponent],
      providers: [
        provideRouter([]),
        provideAnimations(),
        { provide: AuthService, useValue: makeAuthServiceMock() },
        {
          provide: ConferenceService,
          useValue: {
            upcomingConferences: signal([]),
            conferences: signal([]),
          },
        },
        {
          provide: MeetingService,
          useValue: {
            meetings: signal([]),
            meetingsAsClient: signal([]),
            meetingsAsHost: signal([]),
          },
        },
      ],
    });

    try {
      const fixture = TestBed.createComponent(CalendarComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      // FullCalendar renders internal SVG icons without explicit alt text (third-party library).
      const results = await axe.run(fixture.nativeElement as HTMLElement, {
        rules: { 'role-img-alt': { enabled: false } },
      });
      expect(results.violations).toHaveLength(0);
    } catch (err) {
      throw new Error(`CalendarComponent render or axe failed: ${(err as Error).message}`);
    }
  });

  // -------------------------------------------------------------------------
  // 10. AdminUserListComponent
  // -------------------------------------------------------------------------
  it('AdminUserListComponent has no axe violations', async () => {
    TestBed.configureTestingModule({
      imports: [AdminUserListComponent],
      providers: [
        provideRouter([]),
        provideAnimations(),
        {
          provide: ProfileService,
          useValue: {
            pendingProfiles: signal([]),
            allProfiles: signal([]),
            getPendingProfiles: vi.fn().mockResolvedValue({ data: [], count: 0 }),
            getAllProfiles: vi.fn().mockResolvedValue({ data: [], count: 0 }),
          },
        },
      ],
    });

    try {
      const fixture = TestBed.createComponent(AdminUserListComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      const results = await axe.run(fixture.nativeElement as HTMLElement);
      expect(results.violations).toHaveLength(0);
    } catch (err) {
      throw new Error(`AdminUserListComponent render or axe failed: ${(err as Error).message}`);
    }
  });

  // -------------------------------------------------------------------------
  // 11. AdminUserDetailComponent
  // -------------------------------------------------------------------------
  it('AdminUserDetailComponent has no axe violations', async () => {
    const supabaseMock = makeSupabaseChainMock();

    TestBed.configureTestingModule({
      imports: [AdminUserDetailComponent],
      providers: [
        provideRouter([]),
        provideAnimations(),
        {
          provide: ProfileService,
          useValue: {
            pendingProfiles: signal([]),
            allProfiles: signal([]),
            approveProfile: vi.fn().mockResolvedValue({ error: null }),
            rejectAndDeleteProfile: vi.fn().mockResolvedValue({ error: null }),
          },
        },
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: ActivatedRoute, useValue: makeActivatedRouteMock({ id: 'test-id' }) },
      ],
    });

    try {
      const fixture = TestBed.createComponent(AdminUserDetailComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      const results = await axe.run(fixture.nativeElement as HTMLElement);
      expect(results.violations).toHaveLength(0);
    } catch (err) {
      throw new Error(`AdminUserDetailComponent render or axe failed: ${(err as Error).message}`);
    }
  });
});
