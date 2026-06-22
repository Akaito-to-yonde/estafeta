---
inclusion: always
---

# Project Steering

This is **Estafeta** — an **Angular 21** single-page application hosted on **Cloudflare Pages**, backed by **Supabase** (auth + database + Edge Functions). The UI layer uses **PrimeNG 21** with **Tailwind CSS v4** for styling. Tests run with **Vitest**. The package manager is **npm**. The entire user-facing interface is in **Spanish**.

## Tech Stack

| Layer          | Library / Tool                              |
| -------------- | ------------------------------------------- |
| Framework      | Angular 21 (standalone components, signals) |
| UI components  | PrimeNG 21 + PrimeIcons                     |
| Styling        | Tailwind CSS v4, SCSS via Sass              |
| Backend / Auth | Supabase (`@supabase/supabase-js`)          |
| Date utilities | `date-fns` (always use the `es` locale)     |
| Testing        | Vitest + jsdom + fast-check (PBT)           |
| Formatting     | Prettier (100-char width, single quotes)    |
| Deployment     | Cloudflare Pages                            |

---

## Application Overview

Estafeta is a conference and private meeting platform with five user categories:

| Category   | Can do                                                          |
| ---------- | --------------------------------------------------------------- |
| `producer` | Host open conferences, receive and respond to meeting proposals |
| `provider` | Same as producer                                                |
| `services` | Same as producer                                                |
| `client`   | View conferences, propose private meetings to host users        |
| `admin`    | Approve/reject registrations, oversee all conferences/meetings  |

Every new user goes through a manual **admin approval gate** before gaining access. Email notifications are handled entirely **server-side** via Supabase Postgres triggers → Edge Functions → Resend — the Angular frontend never calls a notification function directly.

---

## Database Tables (Supabase)

### `profile`

| Column            | Type        | Notes                                                 |
| ----------------- | ----------- | ----------------------------------------------------- |
| `id`              | bigint      | PK, identity                                          |
| `created_at`      | timestamptz | default `now()`                                       |
| `user_id`         | uuid        | FK → `auth.users.id`, default `auth.uid()`            |
| `categoria`       | text        | CHECK: `admin\|producer\|provider\|services\|client`  |
| `nombre_empresa`  | text        | max 255                                               |
| `direccion_legal` | text        | max 500                                               |
| `contacto`        | text        | max 255                                               |
| `num_fijo`        | text        | nullable, max 20                                      |
| `num_movil`       | text        | nullable, max 20                                      |
| `email`           | text        | unique (case-insensitive)                             |
| `actividad`       | text        | max 500                                               |
| `oferta_busqueda` | text        | nullable, max 1000                                    |
| `estado`          | text        | `pending` \| `approved` \| `registered` \| `rejected` |

### `conference`

| Column       | Type        | Notes                |
| ------------ | ----------- | -------------------- |
| `id`         | bigint      | PK, identity         |
| `created_at` | timestamptz | default `now()`      |
| `starting`   | timestamptz | nullable             |
| `ending`     | timestamptz | nullable             |
| `location`   | text        | nullable, max 255    |
| `subject`    | text        | nullable, max 500    |
| `speaker_id` | uuid        | FK → `auth.users.id` |

### `meeting`

| Column            | Type        | Notes                                                         |
| ----------------- | ----------- | ------------------------------------------------------------- |
| `id`              | bigint      | PK, identity                                                  |
| `created_at`      | timestamptz | default `now()`                                               |
| `updated_at`      | timestamptz | nullable                                                      |
| `speaker_id`      | uuid        | FK → `auth.users.id` (host)                                   |
| `participant_id`  | uuid        | FK → `auth.users.id` (client)                                 |
| `start`           | timestamptz | nullable                                                      |
| `ending`          | timestamptz | nullable                                                      |
| `status`          | text        | CHECK: `proposed\|accepted\|rejected\|rescheduled\|cancelled` |
| `last_updated_by` | uuid        | FK → `auth.users.id`                                          |
| `response_note`   | text        | nullable, max 500                                             |

### `notification_log`

| Column          | Type        | Notes                                         |
| --------------- | ----------- | --------------------------------------------- |
| `id`            | uuid        | PK, default `gen_random_uuid()`               |
| `created_at`    | timestamptz | default `now()`                               |
| `function_name` | text        | NOT NULL                                      |
| `recipient`     | text        | NOT NULL                                      |
| `error`         | text        | NOT NULL                                      |
| `meeting_id`    | uuid        | nullable FK → `meeting.id` ON DELETE SET NULL |
| `profile_id`    | uuid        | nullable FK → `profile.id` ON DELETE SET NULL |

All three main tables have **RLS enabled** and are published to **Supabase Realtime**.

---

## Supabase Edge Functions

Located in `supabase/functions/`. Uploaded manually by the developer.

| Function                 | Trigger / Caller                           | Purpose                                      |
| ------------------------ | ------------------------------------------ | -------------------------------------------- |
| `send-email`             | Called by all notification functions       | Shared mailer helper; retries 3×, logs fails |
| `on-new-registration`    | Postgres AFTER INSERT ON profile           | Notify admin of new registration             |
| `on-approval-invite`     | Postgres AFTER UPDATE estado='approved'    | Send invite link to newly approved user      |
| `on-rejection`           | Postgres AFTER UPDATE estado='rejected'    | Notify rejected user                         |
| `on-meeting-proposed`    | Postgres AFTER INSERT ON meeting           | Notify host of new proposal                  |
| `on-meeting-accepted`    | Postgres AFTER UPDATE status='accepted'    | Notify other party                           |
| `on-meeting-rejected`    | Postgres AFTER UPDATE status='rejected'    | Notify other party                           |
| `on-meeting-rescheduled` | Postgres AFTER UPDATE status='rescheduled' | Notify other party                           |
| `on-meeting-cancelled`   | Postgres AFTER UPDATE status='cancelled'   | Notify both parties                          |
| `overlap-check`          | Called by Angular `OverlapService`         | Detect conference/meeting time conflicts     |

The Angular frontend **only** calls `overlap-check`. All other Edge Functions are triggered by Postgres triggers via `pg_net`. The `RESEND_API_KEY` and Supabase service-role key are **only** stored as Edge Function environment variables — never sent to the browser.

---

## Angular Application Structure

```
src/app/
├── core/
│   ├── auth/            AuthService
│   ├── profile/         ProfileService
│   ├── conference/      ConferenceService
│   ├── meeting/         MeetingService
│   ├── overlap/         OverlapService
│   ├── guards/          authGuard, roleGuard, publicOnlyGuard, magicLinkGuard
│   └── models/          profile, conference, meeting, interval, calendar-event, pagination
├── shared/
│   ├── i18n/            es.ts  (all Spanish strings — NO hardcoded English in templates)
│   ├── pipes/           DateFormatPipe (date-fns with es locale)
│   └── validators/      emailFormat, futureDate, dateRange, passwordMatch
├── auth/
│   ├── login/           LoginComponent       (publicOnlyGuard)
│   ├── register/        RegisterComponent    (publicOnlyGuard)
│   └── set-password/    SetPasswordComponent (magicLinkGuard)
├── conferences/
│   ├── list/            ConferenceListComponent   (public)
│   ├── detail/          ConferenceDetailComponent (public)
│   └── form/            ConferenceFormComponent   (authGuard + roleGuard: host|admin)
├── meetings/
│   ├── list/            MeetingListComponent   (authGuard + roleGuard: host|client|admin)
│   ├── detail/          MeetingDetailComponent (authGuard + roleGuard: host|client|admin)
│   └── form/            MeetingFormComponent   (authGuard + roleGuard: client)
├── calendar/            CalendarComponent      (authGuard + roleGuard: host|client)
└── admin/
    ├── admin-shell/     AdminShellComponent    (authGuard + roleGuard: admin)
    └── users/           AdminUserListComponent, AdminUserDetailComponent
```

### Route Table

```
/                          → redirect → /calendar (auth) or /conferences (anon)
/auth/login                → LoginComponent (publicOnlyGuard)
/auth/register             → RegisterComponent (publicOnlyGuard)
/auth/set-password         → SetPasswordComponent (magicLinkGuard — token in URL hash required)
/conferences               → ConferenceListComponent (public)
/conferences/new           → ConferenceFormComponent (authGuard + roleGuard: host|admin)
/conferences/:id           → ConferenceDetailComponent (public)
/conferences/:id/edit      → ConferenceFormComponent (authGuard + roleGuard: host|admin)
/meetings                  → MeetingListComponent (authGuard + roleGuard: host|client|admin)
/meetings/new              → MeetingFormComponent (authGuard + roleGuard: client)
/meetings/:id              → MeetingDetailComponent (authGuard + roleGuard: host|client|admin)
/calendar                  → CalendarComponent (authGuard + roleGuard: host|client)
/admin                     → AdminShellComponent (authGuard + roleGuard: admin)
/admin/users               → AdminUserListComponent
/admin/users/:id           → AdminUserDetailComponent
```

There are **no** `/app/host/`, `/app/client/` subtrees. Components adapt their content based on `AuthService.profile().categoria`.

---

## Key Design Rules

### Notifications — Server-Side Only

The Angular frontend has **no** `NotificationService`. All emails are triggered by Postgres triggers → Edge Functions. Never add frontend notification calls.

### Magic-Link Guard

`/auth/set-password` requires a valid Supabase `access_token` in the URL hash. Without it, the `magicLinkGuard` redirects to `/auth/login`. This route is **not** public.

### Role-Adaptive Components

`ConferenceListComponent`, `MeetingListComponent`, `MeetingDetailComponent` etc. are shared across roles. They read `AuthService.profile().categoria` and `computed()` signals to show the correct actions, data, and UI for each role.

### CalendarComponent (Home for host/client)

After login, non-admin users land on `/calendar`. It shows all upcoming conferences (blue) and the user's own meetings colour-coded by status:

- `accepted` → green
- `proposed` | `rescheduled` → blue
- `rejected` | `cancelled` → red

### Admin User List (Fused)

`AdminUserListComponent` handles both pending registrations and all-user management in one component. The default filter is `{ estado: 'pending' }`. Admins toggle the filter to see all profiles.

### Overlap Detection

Time overlaps are checked via the `overlap-check` Edge Function (called from `OverlapService.checkOverlapRemote()`). Two intervals overlap if `a.start < b.end && b.start < a.end`. Adjacent intervals (one ends when the other starts) do NOT overlap. Never perform overlap detection directly in the frontend without calling the Edge Function.

### Meeting Turn Logic

- `status ∈ {proposed, rescheduled}` AND `last_updated_by !== userId` → show Accept, Reject, Reschedule
- `status ∈ {proposed, rescheduled}` AND `last_updated_by === userId` → show Reschedule only
- `status ∈ {accepted, rejected, cancelled}` → no action buttons

### Supabase Realtime

`ProfileService`, `ConferenceService`, and `MeetingService` each subscribe to their table's Realtime channel in the constructor and tear down via Angular `DestroyRef`. Signal patches on INSERT/UPDATE/DELETE keep all views live without manual refresh.

### Spanish UI

All user-visible text comes from `src/app/shared/i18n/es.ts`. **Never** hardcode English strings in templates or component logic. Dates are formatted with `date-fns` and the `es` locale via `DateFormatPipe`.

---

## TypeScript

- `strict: true` is enforced — never disable it or add `@ts-ignore` without a comment explaining why.
- `noImplicitOverride`, `noImplicitReturns`, `noPropertyAccessFromIndexSignature`, and `noFallthroughCasesInSwitch` are all enabled.
- Avoid `any`; use `unknown` when the type is genuinely uncertain.
- Prefer type inference when the type is obvious from the right-hand side.
- Target is **ES2022**; module format is `preserve`.

---

## Angular

- **Angular 21+**: `standalone: true` is the default — do NOT write it in `@Component`, `@Directive`, or `@Pipe` decorators.
- Use `input()` / `output()` / `model()` functions instead of `@Input()` / `@Output()` decorators.
- Always set `changeDetection: ChangeDetectionStrategy.OnPush`.
- Put host bindings in the `host` object of the decorator, not `@HostBinding` / `@HostListener`.
- Use `inject()` for dependency injection, not constructor injection.
- Use `NgOptimizedImage` for all static `<img>` tags (does not apply to inline base64 images).
- Implement lazy loading for all feature routes.
- External template / style paths must be relative to the component `.ts` file.

---

## State Management

- Use **signals** (`signal()`, `computed()`, `effect()`) for all local and shared state.
- Use `computed()` for derived values — never recalculate in templates.
- Mutate signals with `.set()` or `.update()` only; never call `.mutate()`.
- Keep state transformations pure and side-effect-free.

---

## Templates

- Use native control flow: `@if`, `@for`, `@switch` — never `*ngIf`, `*ngFor`, `*ngSwitch`.
- Use `class` bindings instead of `ngClass`.
- Use `style` bindings instead of `ngStyle`.
- Keep template logic minimal; move complex logic into the component class or a `computed()`.
- Use the `async` pipe for observables that haven't been converted to signals yet.
- Do not assume globals like `new Date()` are available in templates — derive them in the component.

---

## Forms

- Prefer **Reactive Forms** (`FormGroup`, `FormControl`) over Template-Driven Forms.
- Use the shared validators from `src/app/shared/validators/`:
  - `emailFormatValidator` — RFC 5322
  - `futureDateValidator` — rejects past datetimes
  - `endingAfterStartValidator` — cross-field, `ending > start`
  - `passwordMatchValidator` — cross-field, `password === confirmation`

---

## Services

- Single responsibility per service.
- Provide at root scope with `providedIn: 'root'` unless a narrower scope is intentional.
- Data services (`ProfileService`, `ConferenceService`, `MeetingService`) must call `subscribeRealtime()` in the constructor and `unsubscribeRealtime()` via `DestroyRef`.

---

## Styling

- Use **Tailwind CSS v4** utility classes as the primary styling mechanism.
- Component-scoped SCSS is acceptable for complex or dynamic styles that can't be expressed with Tailwind.
- Prettier formats HTML templates with the `angular` parser.

---

## Accessibility

- All components **must** pass AXE checks.
- Follow **WCAG AA** minimums: focus management, colour contrast ≥ 4.5:1 (text), proper ARIA roles and labels.

---

## Testing

- Test runner: **Vitest** with the `jsdom` environment.
- Run tests with `npm test` (uses `ng test` internally).
- Write unit tests for services and complex component logic.
- Use **fast-check** for property-based tests (`npm install --save-dev fast-check`). Tag each PBT with the design property it validates:

  ```typescript
  // Feature: conference-meeting-platform, Property 15: Time-Interval Overlap Detection
  ```

- Each property test runs a minimum of 100 iterations (`{ numRuns: 100 }`).
- Use `axe-core` for accessibility assertions in all component tests.

---

## Common Commands

```bash
npm run start      # dev server (ng serve)
npm run build      # production build
npm run test       # run tests via Vitest
```
