# Requirements Document

## Introduction

The Conference & Meeting Platform (named "Estafeta") is a single-page application hosted on Cloudflare, backed by Supabase for authentication and data storage. The platform serves two primary purposes:

1. **Open Conferences** — users in the producer, provider, and services categories host public conferences that any registered and approved user (and optionally the public) can view.
2. **Private Meetings** — clients propose private meetings with producer, provider, or services users; both parties negotiate the time through an iterative accept/reject/reschedule flow.

All users go through a manual admin-approval gate before they can access the platform. Email notifications (admin approvals, invitations, meeting updates) are delivered via Supabase Edge Functions that integrate with an external mailing service.

---

## Glossary

- **Platform**: The conference & meeting single-page application described in this document.
- **Auth_Service**: The Supabase authentication subsystem responsible for session management and magic-link delivery.
- **Profile_Service**: The application service that reads and writes rows in the `profile` table.
- **Conference_Service**: The application service that reads and writes rows in the `conference` table.
- **Meeting_Service**: The application service that reads and writes rows in the `meeting` table.
- **Notification_Service**: The Supabase Edge Function layer that sends transactional emails via a mailing provider.
- **Admin**: A user whose `categoria` is `admin`. Acts as gatekeeper for new registrations and oversees all platform activity.
- **Host_User**: A user whose `categoria` is one of `producer`, `provider`, or `services`. Can host open conferences and receive private meeting proposals.
- **Client**: A user whose `categoria` is `client`. Can attend conferences and propose private meetings to Host_Users.
- **Pending_User**: A user who has signed up but has not yet been accepted or rejected by an Admin.
- **Approved_User**: A user whose profile `estado` is `approved`, meaning they have been accepted by an Admin.
- **Registered_User**: A user whose profile `estado` is `registered`, meaning they have set their password via the invite link
- **Conference**: A scheduled open event with a start datetime, end datetime, location, subject, and a speaker who is a Host_User.
- **Meeting**: A private appointment between a Client and a Host_User, negotiated through an iterative proposal flow.
- **Meeting_Status**: The current state of a Meeting. Valid values: `proposed`, `accepted`, `rejected`, `rescheduled`.
- **Admin_Email**: A predefined email address configured in the Platform environment to which new-registration notifications are sent.
- **Invite_Link**: A Supabase magic link that allows an Approved_User to set their password and activate their account. Valid for 72 hours from issuance.
- **Response_Note**: An optional free-text field (max 500 characters) on a Meeting that provides context for any accept, reject, or reschedule decision.
- **Overlap**: An overlap happens when the same user takes part of two Conferences or Meetings at the same time. When a Meeting ends after another one starts, or when it starts before another one ends, it's an overlap.
- **Overlap_Service**: A Supabase Edge Funcion that scans for Overlaps when a new Meeting or Conference is inserted, proposed or accepted.

---

## Requirements

### Requirement 1: User Registration

**User Story:** As a new user, I want to sign up with my email and profile details, so that I can request access to the Platform.

#### Acceptance Criteria

1. THE Platform SHALL present a registration form that collects the following fields — required: email (valid RFC 5322 format), `categoria` (one of `producer`, `provider`, `services`, `client`), `nombre_empresa` (max 255 chars), `direccion_legal` (max 500 chars), `contacto` (name of a person, max 255 chars), `actividad` (max 500 chars); optional: `num_fijo` (max 20 chars), `num_movil` (max 20 chars), `oferta_busqueda` (max 1000 chars).
2. WHEN a user submits the registration form with all required fields filled in, THE Profile_Service SHALL create a new row in the `profile` table with `estado` set to `pending`.
3. WHEN a user submits the registration form, THE Notification_Service SHALL send an email notification to the Admin_Email informing the Admin that a new registration is pending review, including a link to view the registrant's email on the Platform.
4. IF a user submits the registration form with a missing required field, THEN THE Platform SHALL display a validation error message identifying each missing field without submitting the form.
5. IF a user submits the registration form with an email address that does not conform to RFC 5322 format, THEN THE Platform SHALL display a validation error on the email field without submitting the form.
6. IF a user submits the registration form with an email address that already exists in the `profile` table (case-insensitive match), THEN THE Platform SHALL display an error message stating that the email is already registered.
7. IF the Profile_Service fails to create the profile row due to a backend error, THEN THE Platform SHALL display a generic error message and SHALL NOT send the Admin notification email.

---

### Requirement 2: Pending Login Notification

**User Story:** As a Pending_User, I want to be informed of my pending status when I try to log in, so that I know my registration is awaiting admin approval.

#### Acceptance Criteria

1. WHEN a Pending_User submits valid credentials (email matches a `profile` row with `estado` set to `pending`), THE Platform SHALL display a message stating that the registration is pending admin approval, and THE Platform SHALL remain on the login page.
2. WHEN a Pending_User submits valid credentials, THE Auth_Service SHALL NOT create an authenticated session.

---

### Requirement 3: Admin Registration Approval

**User Story:** As an Admin, I want to review new registrations and accept or reject them, so that only authorised users gain access to the Platform.

#### Acceptance Criteria

1. WHERE the authenticated user's `categoria` is `admin`, THE Platform SHALL provide a dashboard listing all profiles whose `estado` is `pending`, paginated at 50 rows per page, ordered by `created_at` descending, showing at minimum: email, `categoria`, `nombre_empresa`, `contacto`, and `created_at`.
2. WHEN an Admin accepts a registration, THE Profile_Service SHALL atomically set `estado` to `approved` for the corresponding profile row and THE Notification_Service SHALL send an Invite_Link email to the newly approved user so they can set their password.
3. THE Invite_Link sent upon approval SHALL expire 72 hours after issuance. New Invite_Links SHALL NOT be sent to the same Pending_User IF an Invite_Link is still active for that Pending_User.
4. WHEN an Admin rejects a registration, THE Platform SHALL ask the Admin to send an optional note, THE Notification_Service SHALL send an email to the rejected user notifying them that their registration was not approved and append the note if it was made, and THEN THE Profile_Service SHALL delete the corresponding profile row from the `profile` table.
5. IF the Notification_Service fails to send the approval Invite_Link email, THEN THE Platform SHALL display an error message to the Admin but SHALL NOT revert the `estado` change.
6. IF the Notification_Service fails to send the rejection email, THEN THE Platform SHALL display an error message to the Admin but SHALL still delete the profile row.
7. IF an Admin attempts to accept or reject a registration that has already been processed (profile row no longer has `estado` = `pending` or has been deleted), THEN THE Platform SHALL display an error message stating the registration is no longer pending.

---

### Requirement 4: Password Setup via Invite Link

**User Story:** As an Approved_User, I want to receive a magic link by email to set my password, so that I can log in to the Platform for the first time.

#### Acceptance Criteria

1. WHEN an Approved_User clicks the Invite_Link in their email, THE Auth_Service SHALL present a form with two fields: new password and password confirmation.
2. WHEN an Approved_User submits a valid new password (meeting minimum requirements and matching the confirmation field) through the Invite_Link flow, THE Auth_Service SHALL activate the user's account, set their Profile `estado` to `registered`, create a valid session, and THE Platform SHALL redirect the user to their role-appropriate dashboard.
3. IF an Approved_User submits a password shorter than 8 characters, THEN THE Platform SHALL display a validation error identifying the minimum length requirement and SHALL NOT create a session.
4. IF an Approved_User submits a new password and confirmation that do not match, THEN THE Platform SHALL display a validation error on the confirmation field and SHALL NOT create a session.
5. IF an Invite_Link has already been used or has expired (more than 72 hours since issuance), THEN THE Platform SHALL display an error message prompting the user to contact an Admin to receive a new invitation.

---

### Requirement 5: User Authentication

**User Story:** As a Registered_User, I want to log in with my email and password, so that I can access the Platform features available to my user category.

#### Acceptance Criteria

1. WHEN a Registered_User submits valid credentials, THE Auth_Service SHALL create an authenticated session with a 30-minute inactivity timeout.
2. WHEN an authenticated session is created, THE Platform SHALL redirect the user to their role-appropriate dashboard.
3. IF a Registered_User submits incorrect credentials, THEN THE Platform SHALL display a generic authentication error message that does not reveal whether the email or the password is incorrect.
4. IF a Registered_User submits incorrect credentials 5 or more consecutive times within a 15-minute window, THEN THE Auth_Service SHALL lock that account from login attempts for 15 minutes and THE Platform SHALL display a message indicating the account is temporarily locked.
5. WHEN an authenticated user requests to log out, THE Auth_Service SHALL invalidate the current session.
6. WHEN the session is invalidated, THE Platform SHALL redirect the user to the landing page.
7. WHILE a user has an active session and the session is within 5 minutes of its expiry, THE Auth_Service SHALL automatically refresh the session token, extending the session by another 30-minute inactivity period.
8. IF the Auth_Service fails to refresh the session token, THEN THE Platform SHALL redirect the user to the login page with a message indicating their session has expired.
9. THE Platform SHALL request the user's email and validate it's an existing profile before requesting the password.
10. IF the user inputs an email without an existing profile, THE Platform SHALL reject the input and notify the email is not registered.
11. IF the user inputs an email with a profile with `estado` set to `pending`, THE Platform SHALL notify the user that their profile is still pending approval.

---

### Requirement 6: Role-Based Access Control

**User Story:** As a Platform operator, I want each user category to access only the features relevant to their role, so that the Platform enforces proper separation of capabilities.

#### Acceptance Criteria

1. THE Platform SHALL restrict conference creation and management routes to users whose `categoria` is one of `producer`, `provider`, `services`, or `admin`.
2. THE Platform SHALL restrict meeting proposal creation to users whose `categoria` is `client`.
3. THE Platform SHALL restrict the admin dashboard and all admin-only routes to users whose `categoria` is `admin`.
4. IF an authenticated user attempts to navigate to a route that their `categoria` does not permit, THEN THE Platform SHALL redirect the user to the landing page and display an access-denied notification.
5. IF an unauthenticated user attempts to navigate to any route other than the login page, registration page, or landing page, THEN THE Platform SHALL redirect the user to the login page.
6. THE Platform SHALL enforce Supabase row-level security (RLS) policies on the `profile`, `conference`, and `meeting` tables such that: a user may only read their own `profile` row (Admin may read all); a Host_User may insert, update, and delete only `conference` rows where `speaker_id` matches their `user_id` (Admin may read all); a Client may insert and update only `meeting` rows where `participant_id` matches their `user_id`; a Host_User may read and update `meeting` rows where `speaker_id` matches their `user_id`.

---

### Requirement 7: Conference Creation and Management

**User Story:** As a Host_User, I want to create and manage open conferences, so that registered users can discover and attend my events.

#### Acceptance Criteria

1. THE Platform SHALL provide Host_Users with a form to create a Conference with the following fields: `start` (datetime, required), `ending` (datetime, required), `location` (text, required, max 255 chars), and `subject` (text, required, max 500 chars). The `speaker_id` SHALL be automatically set to the authenticated Host_User's `user_id` and SHALL NOT be editable by the user.
2. WHEN a Host_User submits a valid Conference creation form, THE Conference_Service SHALL insert a new row into the `conference` table.
3. IF a Host_User submits a Conference creation form where `ending` is before or equal to `start`, THEN THE Platform SHALL display a validation error stating the end datetime must be after the start datetime and SHALL NOT insert the row.
4. IF a Host_User submits a Conference creation form with any required field empty, THEN THE Platform SHALL display a validation error identifying the specific offending field and SHALL NOT insert the row.
5. WHEN a Host_User edits an existing Conference and submits changes where `ending` is strictly after `start` and all required fields are non-empty and within length limits, THE Conference_Service SHALL update the corresponding `conference` row.
6. WHEN a Host_User deletes a Conference, THE Conference_Service SHALL remove the corresponding `conference` row from the table.
7. WHILE a Host_User is authenticated, THE Platform SHALL display for editing and deletion only the Conferences where `speaker_id` matches the authenticated user's `user_id`.
8. IF a Host_User attempts to edit or delete a Conference where `speaker_id` does not match their `user_id`, THEN THE Platform SHALL display an access-denied error and SHALL NOT modify the row.
9. IF the Conference_Service fails to insert, update, or delete a Conference row due to a backend error, THEN THE Platform SHALL display an error message and leave the existing data unchanged.
10. WHEN a Host_User inserts a Conference, the Overlap_Service SHALL validate if it provokes an Overlap with another Conference. IF it does, the Conference_Service SHALL reject the input, the Platform SHALL display a validation error stating that the Conference overlaps with another Conference, and ask the user to reschedule.
11. WHEN a Host_User inserts a Conference, the Overlap_Service SHALL validate if it provokes an Overlap with another Meeting and send a list of the Meetings that Overlap. IF it does, the Conference_Service SHALL reject the input, the Platform SHALL display a validation error stating that the Conference overlaps with a Meeting, notifying the user if one of the Meeting's `estado` is `accepted`, and ask the user to reschedule or cancel all Meetings. IF the Host_User chooses to cancel all Meetings, the Meeting_Service SHALL update the Meetings that Overlap and set their `estado` to `cancelled` and the Notification_Service shall notify all of the affected Clients that their meetings were cancelled due to another event, and ask them to re-schedule.

---

### Requirement 8: Conference Listing and Visibility

**User Story:** As any user (authenticated or not), I want to view the list of upcoming conferences, so that I can decide which ones to attend.

#### Acceptance Criteria

1. THE Platform SHALL display a list of all Conferences where `start` is greater than or equal to the current datetime, ordered by `start` ascending.
2. THE Platform SHALL show for each Conference in the list: `subject`, `start`, `ending`, `location`, and the speaker's `nombre_empresa`.
3. IF a user is not authenticated, THE Platform SHALL still display the Conference listing page with all upcoming Conferences without requiring login.
4. WHEN a user selects a Conference from the list, THE Platform SHALL display a detail view showing: `subject`, `start`, `ending`, `location`, and the speaker's `nombre_empresa`, `categoria`, `contacto`, `actividad` and email.
5. WHEN a Client selects a Conference from the list, THE Platform SHALL allow the User to schedule a Meeting with the Conference's Host_User from the detail view.
6. IF the Conference_Service fails to load the conference list, THEN THE Platform SHALL display an error message and SHALL NOT show a partial or stale list.

---

### Requirement 9: Meeting Proposal

**User Story:** As a Client, I want to propose a private meeting with a Host_User, so that I can arrange a one-on-one appointment.

#### Acceptance Criteria

1. WHEN a Client initiates a meeting proposal, THE Platform SHALL present a form allowing the Client to select a Host_User from the list of Host_Users, specify `start` and `ending` as ISO 8601 datetimes with UTC offset, `location`, and optionally provide a `response_note` (max 500 characters).
2. WHEN a Client submits a valid Meeting proposal, THE Meeting_Service SHALL insert a new row into the `meeting` table with: `speaker_id` set to the selected Host_User's `user_id`, `participant_id` set to the Client's `user_id`, `status` set to `proposed`, and `last_updated_by` set to the Client's `user_id`.
3. THE Platform SHALL disable the Client from selecting a `start` and `ending` intervals that Overlap with Host_User's Conferences or Meetings with `estado` equal to `accepted` or Client's Meetings with Estado `proposed`, `rescheduled` or `accepted`.
4. WHEN a Client submits a valid Meeting proposal, THE Notification_Service SHALL send an email to the targeted Host_User within 60 seconds, informing them of the new meeting proposal, including `start`, `ending`, `location`, and `response_note` if present.
5. IF the Notification_Service fails to deliver the proposal email after 3 attempts at 60-second intervals, THEN THE Platform SHALL display an error message to the Client indicating that the notification could not be sent, but SHALL retain the inserted meeting row.
6. IF a Client submits a Meeting proposal where `ending` is before or equal to `start`, or where `start` is in the past, THEN THE Platform SHALL display a validation error identifying the specific constraint violated and SHALL NOT insert the row.
7. IF a Client submits a Meeting proposal with `start` or `ending` missing, THEN THE Platform SHALL display a validation error identifying each missing field and SHALL NOT insert the row.

---

### Requirement 10: Meeting Response (Accept / Reject / Reschedule)

**User Story:** As a Host_User or Client, I want to accept, reject, or reschedule a meeting proposal, so that both parties can reach an agreed appointment time.

#### Acceptance Criteria

1. WHEN a Host_User loads the detail view of a Meeting with `status` of `proposed` or `rescheduled` and `last_updated_by` is not the Host_User's `user_id`, THE Platform SHALL present the options to accept, reject, or reschedule the Meeting.
2. WHEN a Client loads the detail view of a Meeting with `status` of `rescheduled` and `last_updated_by` is not the Client's `user_id`, THE Platform SHALL present the options to accept, reject, or reschedule the Meeting.
3. IF a user attempts to accept or reject a Meeting and their `user_id` matches `last_updated_by`, THEN THE Meeting_Service SHALL reject the action and THE Platform SHALL display an error message stating it is the other party's turn to respond. The user will be allowed to reschedule.
4. IF a user loads the detail view of a Meeting with `status` of `proposed` or `rescheduled`, and `last_updated_by` is the user's `user_id`, THE Platform SHALL only present the option to reschedule the meeting.
5. WHEN a party accepts a Meeting, THE Meeting_Service SHALL set `status` to `accepted`, update `last_updated_by` to the accepting user's `user_id`, store the optional `response_note` (max 500 characters), and update `updated_at` to the current timestamp.
6. WHEN a party rejects a Meeting, THE Meeting_Service SHALL set `status` to `rejected`, update `last_updated_by` to the rejecting user's `user_id`, store the optional `response_note` (max 500 characters), and update `updated_at` to the current timestamp.
7. WHEN a party reschedules a Meeting, THE Platform SHALL verify and rescrict the `start` and `ending` values that cause an Overlap.
8. WHEN a party reschedules a Meeting, THE Meeting_Service SHALL verify that the new `ending` is strictly after the new `start` and `start` is in the future, then set `status` to `rescheduled`, update `start` and `ending`, update `last_updated_by` to the rescheduling user's `user_id`, store the optional `response_note` (max 500 characters), and update `updated_at`.
9. IF a party attempts to reschedule a Meeting with `ending` before or equal to `start`, or with `start` in the past, THEN THE Platform SHALL display a validation error identifying the constraint violated and SHALL NOT update the row.
10. IF a party attempts to reschedule a Meeting whose `status` is `accepted` or `rejected`, THEN THE Platform SHALL display an error message stating the Meeting is no longer open for negotiation.
11. IF a party attempts to reschedule a Meeting the Overlap_Service SHALL check for Overlap with other Meetings where `estado` equals `aceptado` or Conferences. IF there is an Overlap, the Meeting_Service SHALL reject the input and the Platform SHALL notify the user that they need to choose a different time.

---

### Requirement 11: Meeting Negotiation Email Notifications

**User Story:** As a participant in a meeting negotiation, I want to receive email notifications when the other party takes an action, so that I can respond in a timely manner.

#### Acceptance Criteria

1. WHEN a Host_User accepts a Meeting, THE Notification_Service SHALL send an email to the Client within 60 seconds, confirming the accepted meeting with the agreed `start`, `ending`, `location`, and `response_note` if present.
2. WHEN a Host_User rejects a Meeting, THE Notification_Service SHALL send an email to the Client within 60 seconds, informing them the meeting was rejected, including the `response_note` if present.
3. WHEN a Host_User reschedules a Meeting, THE Notification_Service SHALL send an email to the Client within 60 seconds, providing the newly proposed `start`, `ending`, `location`, and `response_note` if present.
4. WHEN a Client or Host_User accepts a Meeting, THE Notification_Service SHALL send an email to the other party within 60 seconds, confirming the accepted meeting with the agreed `start`, `ending`, and `response_note` if present.
5. WHEN a Client or Host_User rejects a Meeting, THE Notification_Service SHALL send an email to the other party within 60 seconds, informing them the meeting was rejected, including the `response_note` if present.
6. WHEN a Client or Host_User reschedules a Meeting, THE Notification_Service SHALL send an email to the other party within 60 seconds, providing the newly proposed `start`, `ending`, and `response_note` if present.
7. WHEN a Meeting is cancelled by the Meeting_Service, the Notification_Service SHALL send an email to the other party withing 60 seconds, urging them to reschedule.
8. IF the Notification_Service fails to deliver a negotiation email, THEN THE Notification_Service SHALL retry up to 3 times at 60-second intervals and, if all retries fail, SHALL log the failure with the recipient address, notification type, meeting ID, and error details.

---

### Requirement 12: Meeting Listing and Status Tracking

**User Story:** As a Client or Host_User, I want to see all my meetings and their current status, so that I can track ongoing negotiations and confirmed appointments.

#### Acceptance Criteria

1. THE Platform SHALL display to a Client a list of all Meetings where `participant_id` matches the Client's `user_id`, ordered by `start` descending, showing: the Host_User's `nombre_empresa`, `start`, `ending` and `status`.
2. THE Platform SHALL display to a Host_User a list of all Meetings where `speaker_id` matches the Host_User's `user_id`, ordered by `start` descending, showing: the Client's `nombre_empresa` if non-null, otherwise `contacto`, along with `start`, `ending`, `status`, and `response_note`.
3. THE Platform SHALL render a distinct action-required indicator on each Meeting where `status` is `proposed` or `rescheduled` and `last_updated_by` is not the authenticated user's `user_id`.
4. WHEN an authenticated user selects a Meeting from the list, THE Platform SHALL display a detail view showing: `speaker_id`, `participant_id`, `start`, `ending`, `status`, `last_updated_by`, `response_note`, `created_at`, and `updated_at`.
5. IF no meetings exist for the authenticated user, THE Platform SHALL display a message indicating there are no meetings to show.
6. IF the Meeting_Service fails to load the meeting list, THEN THE Platform SHALL display an error message and SHALL NOT show a partial or stale list.

---

### Requirement 13: Admin User Management

**User Story:** As an Admin, I want to view and manage all registered users, so that I can oversee platform activity and maintain data quality.

#### Acceptance Criteria

1. WHERE the authenticated user's `categoria` is `admin`, THE Platform SHALL provide a paginated list (25 rows per page, default sort: `created_at` descending) of all profiles, showing: email, `categoria`, `nombre_empresa`, `estado`, and `created_at`.
2. THE Admin Dashboard SHALL allow the Admin to filter profiles by `categoria` and/or `estado`; when filters are applied together, only profiles matching both conditions SHALL be shown; if no profiles match the active filters, THE Platform SHALL display a "no results" message.
3. WHEN an Admin views a user's profile, THE Platform SHALL display all profile fields: `id`, `created_at`, `user_id`, `categoria`, `nombre_empresa`, `direccion_legal`, `contacto`, `num_fijo`, `num_movil`, `email`, `actividad`, `oferta_busqueda`, and `estado`.
4. THE Platform SHALL allow the Admin to view a paginated list (25 rows per page) of all Conferences across all users, showing at minimum: `subject`, `start`, `ending`, `location`, and the speaker's `nombre_empresa`.
5. THE Platform SHALL allow the Admin to view a paginated list (25 rows per page) of all Meetings across all users, showing at minimum: the Client's `nombre_empresa`, the Host_User's `nombre_empresa`, `start`, `ending`, and `status`.

---

### Requirement 14: Edge Function Email Delivery

**User Story:** As a platform operator, I want all transactional emails to be sent reliably via Supabase Edge Functions, so that email delivery is decoupled from the frontend and can be maintained independently.

#### Acceptance Criteria

1. THE Notification_Service SHALL expose dedicated Edge Function endpoints for each of the following notification types: new-registration, admin-approval-invite, admin-rejection, meeting-proposed, meeting-accepted, meeting-rejected, meeting-cancelled, and meeting-rescheduled.
2. WHEN the Platform triggers a notification, THE Notification_Service SHALL invoke the corresponding Edge Function, passing the recipient email address and the following template variables: for registration notifications — registrant email, `categoria`, `nombre_empresa`; for meeting notifications — `start`, `ending`, `location`, `response_note` (if present), and both parties' `nombre_empresa`; for approval/rejection notifications — recipient email and `response_note` (if present).
3. IF an Edge Function invocation does not return a success response within 60 seconds, THE Notification_Service SHALL treat the invocation as failed, log the failure with recipient, notification type, and error details, and THE Platform SHALL not block the primary user action due to the notification failure.
4. THE Notification_Service SHALL authenticate all Edge Function calls using the Supabase service role key, and this key SHALL NOT be included in any response payload sent to the frontend client.
5. IF an Edge Function invocation fails, THE Notification_Service SHALL retry up to 3 times at 15-second intervals; if all retries fail, THE failure SHALL be logged with recipient address, notification type, and final error message.

---

### Requirement 15: Session Persistence and Route Protection

**User Story:** As an authenticated user, I want my session to persist across page refreshes and my role-appropriate routes to be protected, so that I do not lose my context and unauthorised access is prevented.

#### Acceptance Criteria

1. WHEN a user loads the Platform and the Auth_Service detects a valid stored session token, THE Platform SHALL restore the authenticated state without requiring the user to log in again.
2. WHEN an authenticated user navigates to any route other than the login page, the registration page, landing page, or the public conference listing, THE Platform SHALL verify with the Auth_Service that a valid session exists before rendering the route.
3. IF an unauthenticated user attempts to access a route that requires authentication, THEN THE Platform SHALL store the originally requested URL, redirect the user to the login page, and after successful login redirect the user to the stored URL; the stored URL SHALL be discarded after a single use to prevent redirect loops.
4. IF an authenticated user attempts to access a role-specific route that their `categoria` does not permit (as defined in Requirement 6), THEN THE Platform SHALL redirect the user to their role-appropriate dashboard and display an access-denied notification; the Platform SHALL NOT store the disallowed URL for post-login redirect.
