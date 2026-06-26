# Implementation Plan: Conference & Meeting Platform (Estafeta)

## Overview

Implementation follows a backend-first approach: database schema and constraints are
established before Edge Functions are written, and Angular code is built on top of a
stable backend contract. All SQL is written to `supabase/query.sql`; Edge Functions go
to `supabase/functions/`. Angular targets the `src/app/` tree using Angular 21 patterns
(standalone components, signals, `OnPush`, `inject()`, native control flow).

---

## Tasks

### Step 1 — Database migrations

- [x] 1. Write all SQL migrations to `supabase/query.sql`
  - [x] 1.1 Add CHECK constraints and enable pg_net extension
    - Add `CHECK (categoria IN ('admin','producer','provider','services','client'))` on `profile`
    - Add `CHECK (status IN ('proposed','accepted','rejected','rescheduled','cancelled'))` on `meeting`
    - Run `CREATE EXTENSION IF NOT EXISTS pg_net;`
    - _Requirements: 6.6_

  - [x] 1.2 Create `notification_log` table
    - Columns: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `created_at timestamptz DEFAULT now()`,
      `function_name text NOT NULL`, `recipient text NOT NULL`, `error text NOT NULL`,
      `meeting_id uuid REFERENCES meeting(id) ON DELETE SET NULL`,
      `profile_id uuid REFERENCES profile(id) ON DELETE SET NULL`
    - _Requirements: 14.5_

  - [x] 1.3 Create Postgres trigger functions for profile notifications
    - `notify_on_new_registration()`: fires `AFTER INSERT ON profile`, calls pg_net HTTP POST to
      `on-new-registration` Edge Function URL with `NEW.id`, `NEW.email`, `NEW.categoria`, `NEW.nombre_empresa`
    - `notify_on_approval_invite()`: fires `AFTER UPDATE OF estado ON profile WHERE NEW.estado = 'approved'`,
      calls `on-approval-invite` Edge Function
    - `notify_on_rejection()`: fires `AFTER UPDATE OF estado ON profile WHERE NEW.estado = 'rejected'`,
      calls `on-rejection` Edge Function
    - All functions use `perform net.http_post(...)` with the `service_role` key in the Authorization header
    - _Requirements: 1.3, 3.2, 3.4_

  - [x] 1.4 Create Postgres trigger functions for meeting notifications
    - `notify_on_meeting_proposed()`: fires `AFTER INSERT ON meeting WHERE NEW.status = 'proposed'`
    - `notify_on_meeting_accepted()`: fires `AFTER UPDATE OF status ON meeting WHERE NEW.status = 'accepted'`
    - `notify_on_meeting_rejected()`: fires `AFTER UPDATE OF status ON meeting WHERE NEW.status = 'rejected'`
    - `notify_on_meeting_rescheduled()`: fires `AFTER UPDATE OF status ON meeting WHERE NEW.status = 'rescheduled'`
    - `notify_on_meeting_cancelled()`: fires `AFTER UPDATE OF status ON meeting WHERE NEW.status = 'cancelled'`
    - Each passes `NEW.id` (meeting id) to the corresponding Edge Function via pg_net HTTP POST
    - _Requirements: 9.4, 11.1–11.6_

  - [x] 1.5 Attach all trigger functions to their tables
    - `CREATE TRIGGER trg_new_registration AFTER INSERT ON profile ...`
    - `CREATE TRIGGER trg_approval_invite AFTER UPDATE OF estado ON profile ...`
    - `CREATE TRIGGER trg_rejection AFTER UPDATE OF estado ON profile ...`
    - `CREATE TRIGGER trg_meeting_proposed AFTER INSERT ON meeting ...`
    - `CREATE TRIGGER trg_meeting_accepted/rejected/rescheduled/cancelled AFTER UPDATE OF status ON meeting ...`
    - _Requirements: 1.3, 3.2, 3.4, 9.4, 11.1–11.6_
  - [x] 1.6 Enable Supabase Realtime publications
    - `ALTER PUBLICATION supabase_realtime ADD TABLE profile;`
    - `ALTER PUBLICATION supabase_realtime ADD TABLE conference;`
    - `ALTER PUBLICATION supabase_realtime ADD TABLE meeting;`
    - _Requirements: Design — Supabase Realtime for live data_

  - [x] 1.7 Confirm / create RLS policies for `profile` table
    - SELECT: `user_id = auth.uid()` OR `(auth.jwt()->'app_metadata'->>'categoria') = 'admin'`
    - INSERT: `true` (unauthenticated registration)
    - UPDATE: `user_id = auth.uid()` OR `(auth.jwt()->'app_metadata'->>'categoria') = 'admin'`
    - DELETE: `(auth.jwt()->'app_metadata'->>'categoria') = 'admin'`
    - _Requirements: 6.6_

  - [x] 1.8 Confirm / create RLS policies for `conference` and `meeting` tables
    - `conference` SELECT: `true` (public)
    - `conference` INSERT: `speaker_id = auth.uid()`
    - `conference` UPDATE: `speaker_id = auth.uid()`
    - `conference` DELETE: `speaker_id = auth.uid()` OR admin
    - `meeting` SELECT: `speaker_id = auth.uid()` OR `participant_id = auth.uid()` OR admin
    - `meeting` INSERT: `participant_id = auth.uid()`
    - `meeting` UPDATE: `speaker_id = auth.uid()` OR `participant_id = auth.uid()`
    - _Requirements: 6.6_

- [x] 2. Checkpoint — Review SQL before applying
  - Ensure all constraints, triggers, realtime publications, and RLS policies are correct.
  - Ask the user if questions arise before proceeding to Edge Functions.

---

### Step 2 — Supabase Edge Functions

All functions are written to `/home/zorrojo/Documentos/estafeta/supabase/functions/` and
uploaded manually via the Supabase dashboard or CLI.

- [x] 3. Implement shared `send-email` Edge Function
  - [x] 3.1 Create `supabase/functions/send-email/index.ts`
    - Accept `{ to: string; templateId: string; variables: Record<string, string> }` in the request body
    - Call Resend API (`POST https://api.resend.com/emails`) using the `RESEND_API_KEY` env variable
    - Implement retry loop: up to 3 total attempts, 15-second wait between attempts (`setTimeout` / sleep)
    - On final failure: insert a row into `notification_log` (via Supabase service-role client) with
      `function_name = 'send-email'`, `recipient = to`, `error = <error message>`
    - Return `{ success: true }` on delivery or `{ success: false, error }` after all retries
    - _Requirements: 14.4, 14.5_

  - [ ]\* 3.2 Write unit test for `send-email` retry and logging logic
    - Mock `fetch` to fail N times then succeed; assert exactly N+1 calls
    - Mock `fetch` to fail 3 times; assert `notification_log` insert is called once
    - **Property 24: Notification Retry Lives in Edge Function**
    - **Validates: Requirements 11.7, 14.5**

- [x] 4. Implement profile notification Edge Functions
  - [x] 4.1 Create `supabase/functions/on-new-registration/index.ts`
    - Read `profile_id` from request body (passed by pg_net trigger)
    - Fetch the profile row from Supabase using the service-role key
    - Build `SendEmailPayload` with `templateId = 'new-registration'`, variables: `email`, `categoria`, `nombre_empresa`
    - Invoke `send-email` as a Supabase function call (or HTTP invoke)
    - _Requirements: 1.3, 14.1, 14.2_

  - [x] 4.2 Create `supabase/functions/on-approval-invite/index.ts`
    - Fetch profile row by `profile_id` from request body
    - Generate Supabase invite link using admin auth API (`supabase.auth.admin.generateLink`)
    - Call `send-email` with `templateId = 'approval-invite'`, variables: `email`, `inviteLink`
    - _Requirements: 3.2, 3.3, 4.1_

  - [x] 4.3 Create `supabase/functions/on-rejection/index.ts`
    - Fetch profile row by `profile_id` from request body (trigger fires before delete, so row still exists)
    - Call `send-email` with `templateId = 'rejection'`, variables: `email`, optional `response_note`
    - _Requirements: 3.4, 3.6_

- [x] 5. Implement meeting notification Edge Functions
  - [x] 5.1 Create `supabase/functions/on-meeting-proposed/index.ts`
    - Fetch meeting row + joined profile rows for both `speaker_id` and `participant_id`
    - Resolve host's email as the recipient
    - Call `send-email` with `templateId = 'meeting-proposed'`, variables: `start`, `ending`, `location`,
      `clientEmpresa`, `hostEmpresa`, optional `response_note`
    - _Requirements: 9.4, 14.1, 14.2_

  - [x] 5.2 Create `supabase/functions/on-meeting-accepted/index.ts`
    - Determine the other party (not `last_updated_by`) and resolve their email from the joined profile
    - Call `send-email` with `templateId = 'meeting-accepted'`, variables: `start`, `ending`, `location`,
      optional `response_note`
    - _Requirements: 11.1, 11.4_

  - [x] 5.3 Create `supabase/functions/on-meeting-rejected/index.ts`
    - Resolve other party's email; call `send-email` with `templateId = 'meeting-rejected'`,
      variables: optional `response_note`
    - _Requirements: 11.2, 11.5_

  - [x] 5.4 Create `supabase/functions/on-meeting-rescheduled/index.ts`
    - Resolve other party's email; call `send-email` with `templateId = 'meeting-rescheduled'`,
      variables: `start`, `ending`, `location`, optional `response_note`
    - _Requirements: 11.3, 11.6_

  - [x] 5.5 Create `supabase/functions/on-meeting-cancelled/index.ts`
    - Resolve both parties' emails (cancelled by admin/conference conflict — notify both)
    - Call `send-email` twice (once per party) with `templateId = 'meeting-cancelled'`,
      variables: `start`, `ending`
    - _Requirements: 7.11, 11.7_

- [x] 6. Implement `overlap-check` Edge Function
  - [x] 6.1 Create `supabase/functions/overlap-check/index.ts`
    - Accept `OverlapCheckRequest`: `{ start, ending, type, excludeId?, userId }`
    - Query `conference` table for rows where `[start, ending)` overlaps `[NEW.starting, NEW.ending)` and
      `speaker_id = userId` (or all rows for conference-type check), excluding `excludeId`
    - Query `meeting` table for rows where the user is `speaker_id` OR `participant_id`,
      `status IN ('proposed','accepted','rescheduled')`, and the intervals overlap
    - Return `OverlapCheckResponse`: `{ hasOverlap: boolean, conflicts: [...] }`
    - _Requirements: 7.10, 7.11, 9.3, 10.7, 10.11_

  - [ ]\* 6.2 Write unit test for overlap-check query logic
    - Test adjacent intervals (must NOT be considered overlapping)
    - Test fully overlapping intervals
    - Test `excludeId` correctly excludes the row
    - **Property 15: Time-Interval Overlap Detection**
    - **Validates: Requirements 7.10, 9.3, 10.11**

- [x] 7. Checkpoint — Edge Functions complete
  - Ensure all `supabase/functions/` files are created and ready for manual upload.
  - Ask the user if questions arise.

---

### Step 3 — Angular core setup

- [x] 8. Create shared models, i18n constants, pipes, and validators
  - [x] 8.1 Create TypeScript model files
    - `src/app/core/models/profile.model.ts` — `Profile`, `CreateProfileDto`, `ProfileFilters`,
      `ProfileEstado`, `UserCategoria`
    - `src/app/core/models/conference.model.ts` — `Conference`, `ConferenceWithSpeaker`,
      `CreateConferenceDto`, `UpdateConferenceDto`
    - `src/app/core/models/meeting.model.ts` — `Meeting`, `MeetingWithParties`, `MeetingStatus`,
      `ProposeMeetingDto`, `RescheduleMeetingDto`
    - `src/app/core/models/interval.model.ts` — `TimeInterval`
    - `src/app/core/models/calendar-event.model.ts` — `CalendarEvent`, `CalendarEventColor`
    - `src/app/core/models/pagination.model.ts` — `PaginatedResult<T>`
    - _Requirements: all_

  - [x] 8.2 Create Spanish UI string constants
    - Write `src/app/shared/i18n/es.ts` with all keys from the design (`ES.auth`, `ES.register`,
      `ES.conferences`, `ES.meetings`, `ES.admin`, `ES.common`)
    - _Requirements: Design — Full Spanish UI_

  - [ ]\* 8.3 Write property test for ES string coverage
    - Assert no key in the `ES` object is `undefined` or empty string
    - **Property 35: Spanish String Coverage is Complete**
    - **Validates: Design — Full Spanish UI**
  - [x] 8.4 Create shared validators
    - `src/app/shared/validators/email-format.validator.ts` — RFC 5322 email `ValidatorFn`
    - `src/app/shared/validators/future-date.validator.ts` — rejects past datetimes
    - `src/app/shared/validators/date-range.validator.ts` — cross-field `ending > start`
    - `src/app/shared/validators/password-match.validator.ts` — cross-field `password === confirmation`
    - _Requirements: 1.1, 1.5, 4.3, 4.4, 7.3, 9.6, 10.9_

  - [ ]\* 8.5 Write property tests for all validators
    - `emailFormatValidator`: valid RFC 5322 → null; invalid → non-null error
    - `endingAfterStartValidator`: ending ≤ start → non-null; ending > start → null
    - `futureDateValidator`: past date → non-null; future date → null
    - `passwordMatchValidator`: unequal strings → non-null; equal → null
    - **Properties 3, 9, 10, 13**
    - **Validates: Requirements 1.5, 4.3, 4.4, 7.3, 9.6, 10.9**

  - [x] 8.6 Create `DateFormatPipe`
    - `src/app/shared/pipes/date-format.pipe.ts`
    - Wraps `date-fns/format` with the `es` locale
    - Pure pipe, `transform(value: string | Date, fmt: string): string`
    - _Requirements: Design — Full Spanish UI_

  - [ ]\* 8.7 Write unit tests for `DateFormatPipe`
    - Assert Spanish locale output (e.g., "12 de junio 2026, 10:30")
    - Test null / invalid input handling
    - _Requirements: Design — Full Spanish UI_

- [x] 9. Create core Angular services
  - [x] 9.1 Create `AuthService` (`src/app/core/auth/auth.service.ts`)
    - Wrap `SupabaseService`; expose `session: Signal<Session | null>`, `profile: Signal<Profile | null>`,
      `isLoading: Signal<boolean>`
    - Implement `checkEmail()`, `signIn()`, `signOut()`, `setPassword()`, `refreshSession()`
    - Use `supabase.auth.onAuthStateChange` to update `session` signal and load profile on login
    - Set `profile.estado = 'registered'` after `setPassword()` succeeds
    - _Requirements: 2.1, 5.1–5.8_

  - [ ]\* 9.2 Write unit tests for `AuthService`
    - Mock `SupabaseClient`; test pending user does not receive a session
    - Test session refresh on `SIGNED_IN` event
    - **Property 5: Pending Users Never Receive a Session**
    - **Validates: Requirements 2.2, 5.1**

  - [x] 9.3 Create `OverlapService` (`src/app/core/overlap/overlap.service.ts`)
    - Implement pure `intervalsOverlap(a, b): boolean` using `a.start < b.end && b.start < a.end`
    - Implement `findOverlaps(proposed, existing[]): TimeInterval[]`
    - Implement `checkOverlapRemote(req: OverlapCheckRequest): Promise<OverlapCheckResponse>` —
      calls the `overlap-check` Edge Function via `supabase.functions.invoke`
    - _Requirements: 7.10, 7.11, 9.3, 10.7, 10.11_

  - [ ]\* 9.4 Write property tests for `OverlapService`
    - `intervalsOverlap`: for all valid pairs, assert `a.start < b.end && b.start < a.end` ↔ true
    - Adjacent intervals: `a.end === b.start` → false
    - `findOverlaps`: result is always a subset of `existing`
    - **Property 15: Time-Interval Overlap Detection**
    - **Validates: Requirements 7.10, 9.3, 10.11**
  - [x] 9.5 Create `ProfileService` (`src/app/core/profile/profile.service.ts`)
    - Expose `pendingProfiles: Signal<Profile[]>` and `allProfiles: Signal<Profile[]>`
    - Implement `createProfile()`, `getProfile()`, `getPendingProfiles()`, `getAllProfiles()`,
      `approveProfile()`, `rejectAndDeleteProfile()`, `updateEstado()`
    - Patch signals from `subscribeRealtime()` on INSERT / UPDATE / DELETE
    - _Requirements: 1.2, 3.1–3.7, 13.1–13.3_

  - [ ]\* 9.6 Write property tests for `ProfileService` signal updates
    - Realtime INSERT → signal count increases by 1, new row present
    - Realtime UPDATE → signal count unchanged, stale row replaced
    - Realtime DELETE → signal count decreases by 1, row absent
    - **Properties 32, 33, 34**
    - **Validates: Design — Supabase Realtime**

  - [x] 9.7 Create `ConferenceService` (`src/app/core/conference/conference.service.ts`)
    - Expose `conferences: Signal<ConferenceWithSpeaker[]>` and `upcomingConferences: Signal<...>`
      (computed: `starting >= now`, sorted ascending)
    - Implement `getConferenceById()`, `getMyConferences()`, `getAllConferences()`,
      `createConference()`, `updateConference()`, `deleteConference()`
    - Patch signal from `subscribeRealtime()` on INSERT / UPDATE / DELETE
    - _Requirements: 7.1–7.9, 8.1–8.6_

  - [ ]\* 9.8 Write property tests for `ConferenceService`
    - `upcomingConferences` computed: all items have `starting >= now`; result is sorted ascending
    - `getMyConferences(userId)`: all returned items have `speaker_id === userId`
    - Realtime INSERT / UPDATE / DELETE patch signal correctly
    - **Properties 14, 16, 32–34**
    - **Validates: Requirements 7.7, 8.1**
  - [x] 9.9 Create `MeetingService` (`src/app/core/meeting/meeting.service.ts`)
    - Expose `meetings`, `meetingsAsClient`, `meetingsAsHost`, `actionRequiredCount` signals
    - Implement `getMeetingById()`, `getAllMeetings()`, `proposeMeeting()`, `acceptMeeting()`,
      `rejectMeeting()`, `rescheduleMeeting()`, `cancelMeetings()`
    - `proposeMeeting()` must set `status = 'proposed'`, `participant_id = currentUserId`,
      `last_updated_by = currentUserId`
    - `acceptMeeting()` must produce `{ status: 'accepted', last_updated_by: userId }`
    - `rejectMeeting()` must produce `{ status: 'rejected', last_updated_by: userId }`
    - `rescheduleMeeting()` must produce `{ status: 'rescheduled', start, ending, last_updated_by }`
    - Block action when `rescheduleMeeting()` called on `status = 'accepted' | 'rejected'`
    - Patch signals from `subscribeRealtime()` (filtered channels per user)
    - _Requirements: 9.1–9.7, 10.1–10.11, 12.1–12.6_

  - [ ]\* 9.10 Write property tests for `MeetingService`
    - `proposeMeeting` DTO invariants: `status='proposed'`, `participant_id=clientId`, `last_updated_by=clientId`
    - `acceptMeeting` / `rejectMeeting` update invariants
    - `rescheduleMeeting` invariants; blocked on final states
    - `meetingsAsClient` contains only rows with `participant_id = userId`
    - `meetingsAsHost` contains only rows with `speaker_id = userId`
    - `actionRequiredCount`: count of rows where status ∈ ['proposed','rescheduled'] AND last_updated_by ≠ userId
    - **Properties 18, 20, 21, 22, 23, 25, 26**
    - **Validates: Requirements 9.2, 10.1–10.6, 10.8, 10.10, 12.1–12.3**

- [x] 10. Create route guards
  - [x] 10.1 Create `authGuard` (`src/app/core/guards/auth.guard.ts`)
    - Injects `AuthService`; if `session()` is null, stores target URL in a `RedirectService`
      and routes to `/auth/login`
    - Returns `true` when session is present
    - Stored URL is consumed exactly once after login
    - _Requirements: 6.5, 15.2, 15.3_

  - [x] 10.2 Create `roleGuard` (`src/app/core/guards/role.guard.ts`)
    - Factory function `roleGuard(allowedRoles: UserCategoria[]): CanActivateFn`
    - Reads `AuthService.profile().categoria`; if not in `allowedRoles`, navigates to role-home
      without storing the forbidden URL
    - _Requirements: 6.1–6.4, 15.4_

  - [x] 10.3 Create `publicOnlyGuard` (`src/app/core/guards/public-only.guard.ts`)
    - Redirects authenticated users away from `/auth/login` and `/auth/register`
    - _Requirements: 15.2_

  - [x] 10.4 Create `magicLinkGuard` (`src/app/core/guards/magic-link.guard.ts`)
    - Checks `window.location.hash` for a valid Supabase `access_token` fragment
    - Returns `false` and navigates to `/auth/login` if token is absent
    - _Requirements: Design — Magic-link-only set-password route_

  - [ ]\* 10.5 Write property tests for guards
    - `roleGuard`: for every `UserCategoria`, assert allowed routes return true and forbidden return false
    - `magicLinkGuard`: token present → true; absent → false (redirect to `/auth/login`)
    - Post-login redirect stores and discards target URL exactly once
    - Role-forbidden URL must not be stored in `RedirectService`
    - **Properties 11, 30, 31, 36**
    - **Validates: Requirements 6.1–6.4, 15.3, 15.4**

- [x] 11. Wire up `app.routes.ts` with all lazy-loaded routes and guards
  - Register all routes per the design Route Architecture section
  - Use `loadComponent` for each feature component
  - Attach appropriate guards to each route
  - _Requirements: 6.1–6.5, 15.2_

- [x] 12. Checkpoint — Core services, guards, and routes complete
  - Ensure all tests pass. Ask the user if questions arise.

---

### Step 4 — Auth feature

- [x] 13. Implement auth components
  - [x] 13.1 Create `LoginComponent` (`src/app/auth/login/login.component.ts`)
    - Two-step flow: step 1 calls `AuthService.checkEmail()` to verify email exists and estado
    - If `estado = 'pending'`: show `ES.auth.pendingMessage`, do not proceed to password step
    - If email not found: show `ES.auth.notRegisteredError`
    - Step 2: password `FormControl` + submit calls `AuthService.signIn()`
    - On success: redirect based on `profile.categoria`
      (non-admin → `/calendar`, admin → `/admin/users`)
    - On 5 failed attempts within 15 min: show `ES.auth.accountLocked`
    - Uses `publicOnlyGuard`
    - `ChangeDetectionStrategy.OnPush`; all text from `ES`
    - _Requirements: 2.1, 5.1–5.11_

  - [ ]\* 13.2 Write unit tests for `LoginComponent`
    - Pending user → message shown, no session
    - Unknown email → error shown
    - Correct credentials → redirect to `/calendar` (non-admin) or `/admin/users` (admin)
    - **Property 12: Post-Login Redirect to Calendar**
    - **Validates: Requirements 2.1, 5.2, 5.9–5.11**

  - [x] 13.3 Create `RegisterComponent` (`src/app/auth/register/register.component.ts`)
    - `FormGroup` with all required + optional fields from Requirement 1.1
    - `categoria` dropdown excludes `admin` (values: producer, provider, services, client)
    - On submit: call `ProfileService.createProfile()`; on success show `ES.register.successMessage`
    - Validate duplicate email via Supabase query before submit (async validator)
    - Show inline field errors using PrimeNG `p-message`; all labels from `ES`
    - Uses `publicOnlyGuard`
    - _Requirements: 1.1–1.7_

  - [ ]\* 13.4 Write property tests for `RegisterComponent`
    - Any subset of missing required fields → form invalid, each absent control has `required` error
    - Invalid email format → `emailFormatValidator` error on email control
    - All required fields filled → form valid (assuming no duplicate)
    - **Properties 1, 2, 3**
    - **Validates: Requirements 1.2, 1.4, 1.5**
  - [x] 13.5 Create `SetPasswordComponent` (`src/app/auth/set-password/set-password.component.ts`)
    - Protected by `magicLinkGuard`
    - `FormGroup` with `password` (min 8 chars) + `passwordConfirmation` (must match) controls
    - On submit: call `AuthService.setPassword()`; on success redirect to role-appropriate home
    - Show inline error if passwords do not match or length < 8
    - Show error if link expired (Supabase returns 401/400 on consumed token)
    - All text from `ES`
    - _Requirements: 4.1–4.5_

  - [ ]\* 13.6 Write unit tests for `SetPasswordComponent`
    - Password < 8 chars → validation error, no session
    - Passwords do not match → cross-field error
    - Expired link → error message shown
    - **Properties 9, 10, 36**
    - **Validates: Requirements 4.3, 4.4, 4.5**

---

### Step 5 — Conference feature

- [x] 14. Implement conference components
  - [x] 14.1 Create `ConferenceListComponent` (`src/app/conferences/list/conference-list.component.ts`)
    - Uses `ConferenceService.upcomingConferences` signal (computed, live via Realtime)
    - Display columns: `subject`, `starting`, `ending`, `location`, `speaker.nombre_empresa`
    - Show edit / delete actions only when `profile.categoria` is `producer|provider|services|admin`
      AND `conference.speaker_id === profile.user_id` (or admin)
    - "Nueva conferencia" button links to `/conferences/new` (hidden when not host/admin)
    - Error state: show `ES.conferences.errors.loadError`
    - All text from `ES`; dates via `DateFormatPipe`; `OnPush`
    - _Requirements: 7.7, 8.1–8.3_

  - [x] 14.2 Create `ConferenceDetailComponent` (`src/app/conferences/detail/conference-detail.component.ts`)
    - Load conference by route param via `ConferenceService.getConferenceById()`
    - Display all fields: `subject`, `starting`, `ending`, `location`, `speaker.nombre_empresa`,
      `speaker.categoria`, `speaker.contacto`, `speaker.actividad`, `speaker.email`
    - Show "Proponer reunión" CTA only when user is authenticated and `categoria === 'client'`
    - CTA navigates to `/meetings/new?speakerId=...`
    - _Requirements: 8.4, 8.5_
  - [x] 14.3 Create `ConferenceFormComponent` (`src/app/conferences/form/conference-form.component.ts`)
    - Shared create / edit form; reads `:id` param to load existing conference for edit mode
    - `FormGroup`: `starting` (required, future), `ending` (required, must be after `starting`),
      `location` (required, max 255), `subject` (required, max 500)
    - `speaker_id` set automatically from `AuthService.profile().user_id`, not editable
    - On submit: call `OverlapService.checkOverlapRemote()` for conflict check before insert/update
      - Conference-conference conflict → show `ES.conferences.errors.overlap` and block
      - Conference-meeting conflict → list affected meetings; offer "cancel all" or "reschedule conference"
      - "Cancel all" triggers `MeetingService.cancelMeetings(ids, reason)` then re-submits the conference
    - On success: navigate back to `/conferences`
    - _Requirements: 7.1–7.11_

  - [ ]\* 14.4 Write unit tests for `ConferenceFormComponent`
    - `ending ≤ start` → validation error, no insert
    - Missing required field → per-field error
    - Overlap detected → error shown, insert blocked
    - **Properties 13, 2**
    - **Validates: Requirements 7.3, 7.4, 7.10**

  - [ ]\* 14.5 Write property test for conference list render completeness
    - For any `ConferenceWithSpeaker`, rendered output contains all 5 required fields
    - **Property 17: Conference and Meeting Render Completeness**
    - **Validates: Requirements 8.2, 8.4**

---

### Step 6 — Meeting feature

- [x] 15. Implement meeting components
  - [x] 15.1 Create `MeetingListComponent` (`src/app/meetings/list/meeting-list.component.ts`)
    - Uses `MeetingService.meetingsAsClient` or `meetingsAsHost` depending on `profile.categoria`
    - Admin gets `MeetingService.meetings` (all)
    - Action-required indicator on each row where `actionRequired` is true
    - Display: host/client `nombre_empresa`, `start`, `ending`, `status` (from `ES.meetings.statuses`)
    - Navigate to `/meetings/:id` on row click
    - Empty state: `ES.meetings.noResults`; error state: `ES.meetings.errors.loadError`
    - _Requirements: 12.1–12.6_
  - [x] 15.2 Create `MeetingDetailComponent` (`src/app/meetings/detail/meeting-detail.component.ts`)
    - Load meeting by route param via `MeetingService.getMeetingById()`
    - Display all fields: `speaker.nombre_empresa`, `participant.nombre_empresa`, `start`, `ending`,
      `status`, `last_updated_by`, `response_note`, `created_at`, `updated_at`
    - Compute available actions using turn logic:
      - `status ∈ ['proposed','rescheduled']` AND `last_updated_by !== userId` →
        show Accept, Reject, Reschedule buttons
      - `status ∈ ['proposed','rescheduled']` AND `last_updated_by === userId` →
        show only Reschedule
      - `status ∈ ['accepted','rejected','cancelled']` → no action buttons
    - Accept / Reject call `MeetingService.acceptMeeting()` / `rejectMeeting()`
    - Reschedule opens an inline form with `start`, `ending`, optional `response_note`
    - Status labels from `ES.meetings.statuses`; dates via `DateFormatPipe`
    - _Requirements: 10.1–10.11, 12.4_

  - [ ]\* 15.3 Write property tests for `MeetingDetailComponent`
    - For all `status` × `last_updated_by` combinations, assert correct action set
    - For any `MeetingWithParties`, rendered output contains all required fields
    - **Properties 17, 20**
    - **Validates: Requirements 10.1–10.4, 12.4**

  - [x] 15.4 Create `MeetingFormComponent` (`src/app/meetings/form/meeting-form.component.ts`)
    - `authGuard + roleGuard(['client'])`; pre-fills `speaker_id` from query param if coming from
      `ConferenceDetailComponent`
    - `FormGroup`: host selection (dropdown of approved hosts), `start`, `ending`, `location`,
      optional `response_note` (max 500)
    - Disable time slots that cause overlap (call `OverlapService.checkOverlapRemote()` on blur)
    - Client cannot propose `start` or `ending` overlapping host's accepted meetings/conferences
      or client's own proposed/rescheduled/accepted meetings
    - Validations: `ending > start`, `start` in the future, required fields
    - On submit: call `MeetingService.proposeMeeting()`; no notification call from frontend
    - _Requirements: 9.1–9.7_

  - [ ]\* 15.5 Write property tests for `MeetingFormComponent`
    - DTO constructed on submit always has `status='proposed'`, `participant_id=clientId`, `last_updated_by=clientId`
    - `ending ≤ start` or `start` in the past → validation error, no insert
    - **Properties 13, 18**
    - **Validates: Requirements 9.2, 9.6**

---

### Step 7 — Calendar feature

- [x] 16. Implement `CalendarComponent` (`src/app/calendar/calendar.component.ts`)
  - [x] 16.1 Build calendar event mapping logic
    - Map `ConferenceWithSpeaker[]` → `CalendarEvent[]` with `color = 'blue'`, `type = 'conference'`
    - Map `MeetingWithParties[]` (user-relevant only) → `CalendarEvent[]` with colour from status:
      - `'accepted'` → `'green'`
      - `'proposed' | 'rescheduled'` → `'blue'`
      - `'rejected' | 'cancelled'` → `'red'`
    - `computed()` derives the merged event list from `ConferenceService.conferences` and
      `MeetingService.meetings` signals
    - _Requirements: Design — CalendarComponent as home view_

  - [ ]\* 16.2 Write property tests for calendar colour mapping and event filtering
    - For any `Meeting`, mapped `CalendarEvent.color` matches status → colour rule exhaustively
    - For any `userId`, only meetings where `speaker_id = userId` OR `participant_id = userId` appear
    - All conference-derived events have `color = 'blue'`
    - No `CalendarEvent` has undefined color
    - **Properties 37, 38**
    - **Validates: Design — CalendarComponent as home view**

  - [x] 16.3 Wire `CalendarComponent` with `@fullcalendar/angular`
    - Install / import `@fullcalendar/core` and required plugins via PrimeNG `FullCalendarModule`
    - Pass computed `calendarEvents` signal as `[events]` input
    - On event click: navigate to `/conferences/:id` or `/meetings/:id` via `sourceId`
    - `authGuard + roleGuard(['producer','provider','services','client'])`
    - `OnPush`; all labels from `ES`
    - _Requirements: Design — CalendarComponent as home view_

---

### Step 8 — Admin feature

- [x] 17. Implement admin components
  - [x] 17.1 Create `AdminShellComponent` (`src/app/admin/admin-shell.component.ts`)
    - Layout wrapper with sidebar navigation to `/admin/users`
    - `authGuard + roleGuard(['admin'])`
    - Uses `router-outlet` for child routes
    - _Requirements: 3.1, 6.3_

  - [x] 17.2 Create `AdminUserListComponent` (`src/app/admin/users/admin-user-list.component.ts`)
    - Single fused list handling both pending-review and all-users views
    - Default filter: `{ estado: 'pending' }`; filter bar to switch to all users or filter by `categoria`
    - Uses `ProfileService.pendingProfiles` (live signal) for pending view and `ProfileService.allProfiles`
      for all-users view
    - Table columns: `email`, `categoria`, `nombre_empresa`, `estado`, `created_at`
    - Paginated: 25 rows per page (pending: 50 per the requirement); sortable by `created_at` desc
    - Approve / Reject buttons on pending rows; inline reject-note prompt before confirming rejection
    - Shows `ES.admin.alreadyProcessed` if row no longer pending on action
    - Navigate to `/admin/users/:id` on row click
    - _Requirements: 3.1–3.7, 13.1–13.2_

  - [ ]\* 17.3 Write property tests for `AdminUserListComponent`
    - For any `ProfileFilters`, filtered result contains only matching profiles
    - Both categoria AND estado filters active simultaneously → both conditions hold
    - Default filter shows only pending; no-filter shows all
    - **Properties 27, 39**
    - **Validates: Requirements 13.2, Design — Fused admin user list**

  - [x] 17.4 Create `AdminUserDetailComponent` (`src/app/admin/users/admin-user-detail.component.ts`)
    - Load profile by route param via `ProfileService.getProfile()`
    - Display all 13 fields as per Requirement 13.3
    - Show Approve / Reject actions if `estado === 'pending'`
    - _Requirements: 13.3_

  - [ ]\* 17.5 Write property test for admin profile detail render completeness
    - For any `Profile` object, rendered output contains all 13 required fields
    - **Property 28: Admin Profile Detail Render Completeness**
    - **Validates: Requirements 13.3**

---

### Step 9 — Realtime subscriptions

- [x] 18. Wire Realtime subscriptions in all data services
  - [x] 18.1 Complete `ProfileService.subscribeRealtime()` and `unsubscribeRealtime()`
    - Subscribe to `postgres_changes` on `public.profile` channel
    - On INSERT: append to `allProfiles`; if `estado = 'pending'` also append to `pendingProfiles`
    - On UPDATE: patch both signals in-place by `id`
    - On DELETE: remove from both signals by `id`
    - Tear down via Angular `DestroyRef`
    - _Requirements: Design — Supabase Realtime_

  - [x] 18.2 Complete `ConferenceService.subscribeRealtime()` and `unsubscribeRealtime()`
    - Subscribe to `postgres_changes` on `public.conference` channel (unfiltered — public)
    - On INSERT / UPDATE / DELETE: patch `conferences` signal
    - Tear down via `DestroyRef`
    - _Requirements: Design — Supabase Realtime_

  - [x] 18.3 Complete `MeetingService.subscribeRealtime()` and `unsubscribeRealtime()`
    - Subscribe to two filtered channels: `speaker_id=eq.{uid}` and `participant_id=eq.{uid}`
    - Admin context: unfiltered channel for all meetings
    - Merge events from both channels into the `meetings` signal (dedup by `id`)
    - Tear down via `DestroyRef`
    - _Requirements: Design — Supabase Realtime_

  - [ ]\* 18.4 Write integration tests for Realtime event handling
    - Mock Supabase Realtime channel; emit INSERT / UPDATE / DELETE; assert signal state
    - **Properties 32, 33, 34**
    - **Validates: Design — Supabase Realtime**

- [x] 19. Checkpoint — All Realtime subscriptions wired
  - Ensure all tests pass. Ask the user if questions arise.

---

### Step 10 — Testing

- [ ] 20. Install fast-check and write remaining property-based tests
  - [ ] 20.1 Install `fast-check` dev dependency
    - Run `npm install --save-dev fast-check`
    - Verify import in a sample spec file
    - _Requirements: Design — Property-Based Testing Setup_

  - [ ]\* 20.2 Write property tests for `ProfileService` filter and admin
    - `getAllProfiles` with arbitrary `ProfileFilters`: result satisfies both filter conditions when active
    - `pendingProfiles` computed: all items have `estado = 'pending'`
    - **Properties 27, 39**
    - **Validates: Requirements 13.1, 13.2**

  - [ ]\* 20.3 Write property tests for post-login redirect behaviour
    - For any `targetUrl` stored before login, router navigates to exactly `targetUrl` after login
    - Stored URL is discarded after first use
    - Role-forbidden URL is never stored in `RedirectService`
    - **Properties 30, 31**
    - **Validates: Requirements 15.3, 15.4**

  - [ ]\* 20.4 Write integration tests for backend trigger chain (mocked at HTTP level)
    - Registration → `createProfile()` → assert pg trigger fires (mock pg_net call observed)
    - Admin approval → `approveProfile()` → assert `on-approval-invite` trigger fired
    - Meeting proposal → `proposeMeeting()` → assert `on-meeting-proposed` trigger fired
    - Conference insert → overlap-check Edge Function → conflict response handled correctly
    - **Properties 6, 8, 19**
    - **Validates: Requirements 1.3, 3.2, 9.4\_**

  - [ ]\* 20.5 Write accessibility tests for all components
    - Use `axe-core` via `@axe-core/angular` in Vitest `jsdom` environment
    - Covers: `LoginComponent`, `RegisterComponent`, `SetPasswordComponent`,
      `ConferenceListComponent`, `ConferenceFormComponent`, `MeetingListComponent`,
      `MeetingDetailComponent`, `MeetingFormComponent`, `CalendarComponent`,
      `AdminUserListComponent`, `AdminUserDetailComponent`
    - Any AXE violation fails the test
    - Assert focus management after form submit and after modal open
    - _Requirements: Design — Accessibility_

- [ ] 21. Final checkpoint — All tests pass
  - Run `npm test` and ensure the full suite passes.
  - Ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP build
- Each task references specific requirements from `requirements.md` for traceability
- All SQL is written to a single `supabase/query.sql` file; apply it via the Supabase SQL editor or CLI
- Edge Functions are placed in `supabase/functions/` and uploaded manually via the Supabase dashboard
- The `send-email` Edge Function must be deployed before all other notification functions
- Angular components follow the project steering rules: `OnPush`, `inject()`, `signal()`, native control flow
- All user-visible text must come from `src/app/shared/i18n/es.ts` — no hardcoded English strings
- Checkpoints are real stop points; verify tests pass before moving to the next step

## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": 0,
      "tasks": ["1.1", "1.2"]
    },
    {
      "id": 1,
      "tasks": ["1.3", "1.4"]
    },
    {
      "id": 2,
      "tasks": ["1.5", "1.6", "1.7", "1.8"]
    },
    {
      "id": 3,
      "tasks": ["3.1", "8.1", "8.2"]
    },
    {
      "id": 4,
      "tasks": ["3.2", "8.3", "8.4", "6.1"]
    },
    {
      "id": 5,
      "tasks": ["4.1", "4.2", "4.3", "5.1", "5.2", "5.3", "5.4", "5.5", "6.2", "8.5", "8.6"]
    },
    {
      "id": 6,
      "tasks": ["8.7", "9.1", "9.3", "9.5", "9.7", "9.9"]
    },
    {
      "id": 7,
      "tasks": ["9.2", "9.4", "9.6", "9.8", "9.10", "10.1", "10.2", "10.3", "10.4"]
    },
    {
      "id": 8,
      "tasks": ["10.5", "11"]
    },
    {
      "id": 9,
      "tasks": ["13.1", "13.3"]
    },
    {
      "id": 10,
      "tasks": ["13.2", "13.4", "13.5", "14.1", "14.2", "14.3", "15.1", "15.4"]
    },
    {
      "id": 11,
      "tasks": ["13.6", "14.4", "14.5", "15.2", "15.3", "15.5", "17.1"]
    },
    {
      "id": 12,
      "tasks": ["16.1", "17.2", "17.4"]
    },
    {
      "id": 13,
      "tasks": ["16.2", "16.3", "17.3", "17.5"]
    },
    {
      "id": 14,
      "tasks": ["18.1", "18.2", "18.3"]
    },
    {
      "id": 15,
      "tasks": ["18.4", "20.1"]
    },
    {
      "id": 16,
      "tasks": ["20.2", "20.3", "20.4", "20.5"]
    }
  ]
}
```
