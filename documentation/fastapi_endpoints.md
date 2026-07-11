# FastAPI Endpoints Specification (useAnchor Backend)

This document outlines all the data fetching, mutations, authentication, and RPCs currently used by the React frontend. Your backend developer can use this as a blueprint to build the FastAPI endpoints and map them to the PostgreSQL database.

---

## 1. Authentication (`/api/auth`)

> **Note on Auth Migration:** The frontend currently uses Supabase Auth for OTP login. If you move to FastAPI, you can either:
> 1. Continue using `supabase.auth` on the frontend, and simply pass the `access_token` to FastAPI in the `Authorization: Bearer <token>` header (FastAPI verifies the JWT).
> 2. OR migrate auth entirely to FastAPI by building the following endpoints:

### `POST /api/auth/send-otp`
- **Description**: Sends an SMS OTP to the user's phone number.
- **Payload**: `{ "phone": "+1234567890" }`
- **Frontend equivalent**: `supabase.auth.signInWithOtp({ phone })`

### `POST /api/auth/verify-otp`
- **Description**: Verifies the OTP and returns an access token / user object.
- **Payload**: `{ "phone": "+1234567890", "token": "123456" }`
- **Frontend equivalent**: `supabase.auth.verifyOtp({ phone, token, type: 'sms' })`

### `POST /api/auth/logout`
- **Description**: Invalidates the user's session.
- **Frontend equivalent**: `supabase.auth.signOut()`

---

## 2. User Profiles (`/api/profiles`)

### `GET /api/profiles/me`
- **Description**: Fetches the current user's profile details.
- **Frontend equivalent**: `supabase.from("profiles").select(...)`

### `PUT /api/profiles/me`
- **Description**: Updates the user's profile during onboarding (e.g., name, avatar).
- **Payload**: `{ "full_name": "string", "avatar_url": "string", "onboarding_completed": boolean }`
- **Frontend equivalent**: `supabase.from("profiles").update(...)`

### `POST /api/profiles/fcm-token`
- **Description**: Updates the user's Firebase Cloud Messaging token for push notifications.
- **Payload**: `{ "fcm_token": "string" }`
- **Frontend equivalent**: `supabase.from("profiles").update({ fcm_token: token }).eq("id", user_id)`

### `DELETE /api/profiles/account`
- **Description**: Deletes the user account entirely, cascading to delete their sessions and data.
- **Frontend equivalent**: `supabase.rpc("delete_user_account")`

---

## 3. Safety Sessions (`/api/sessions`)

### `POST /api/sessions`
- **Description**: Creates a new session in `draft` mode.
- **Payload**: `{ "title": "string", "description": "string", "meet_person": "string", "meet_phone": "string", "destination_address": "string", "checkin_interval_minutes": 30, "expected_end": "ISO-8601" }`
- **Frontend equivalent**: `supabase.from("anchor_sessions").insert(...)`

### `POST /api/sessions/{session_id}/contacts`
- **Description**: Attaches trusted contacts to a newly created session.
- **Payload**: `{ "contact_ids": ["uuid"] }`
- **Frontend equivalent**: `supabase.rpc("add_session_contacts", { p_session_id, p_contact_ids })`

### `POST /api/sessions/{session_id}/start`
- **Description**: Moves a session from `draft` to `active` and schedules the first check-in timer.
- **Payload**: `{ "p_session_id": "uuid", "p_current_version": integer }`
- **Frontend equivalent**: `supabase.rpc("start_anchor_session")`

### `POST /api/sessions/{session_id}/complete`
- **Description**: Successfully ends a session (The user pressed "I'm Safe").
- **Payload**: `{ "p_session_id": "uuid", "p_current_version": integer }`
- **Frontend equivalent**: `supabase.rpc("complete_anchor_session")`

### `GET /api/sessions/active`
- **Description**: Fetches the user's currently active session (if any).
- **Frontend equivalent**: `supabase.from("anchor_sessions").select(...).eq("status", "active")`

### `GET /api/sessions/history`
- **Description**: Fetches past sessions for the history timeline screen.
- **Frontend equivalent**: `supabase.from("anchor_sessions").select(...)`

### `GET /api/sessions/{session_id}`
- **Description**: Fetches the timeline details for a specific session (including its check-ins and alerts).
- **Frontend equivalent**: Used in `SessionTimelineScreen.tsx` joining `anchor_sessions`, `checkins`, and `alerts`.

---

## 4. Check-ins (`/api/checkins`)

### `POST /api/checkins/{checkin_id}/complete`
- **Description**: Marks a scheduled check-in as verified/completed by the user before the timer runs out.
- **Payload**: `{ "p_checkin_id": "uuid" }`
- **Frontend equivalent**: `supabase.rpc("mark_checkin_completed")`

---

## 5. Emergency Alerts (`/api/alerts`)

### `POST /api/alerts/trigger`
- **Description**: Triggers an SOS alert manually (bypassing timers).
- **Payload**: 
  ```json
  {
    "p_session_id": "uuid",
    "p_trigger_type": "manual_sos",
    "p_lat": 0.0,
    "p_lng": 0.0,
    "p_accuracy": 1.0,
    "p_address": "string"
  }
  ```
- **Frontend equivalent**: `supabase.rpc("trigger_alert")`

### `POST /api/alerts/{alert_id}/cancel`
- **Description**: Cancels an active SOS alert (called by the user in danger indicating false alarm / they are safe).
- **Payload**: `{ "p_alert_id": "uuid" }`
- **Frontend equivalent**: `supabase.rpc("cancel_alert")`

### `POST /api/alerts/{alert_id}/resolve`
- **Description**: Resolves an incident (called by an emergency contact/responder who handled the emergency).
- **Payload**: `{ "p_alert_id": "uuid", "p_resolution_reason": "string", "p_resolution_details": "string" }`
- **Frontend equivalent**: `supabase.rpc("resolve_alert")`

### `GET /api/alerts`
- **Description**: Fetches the feed of active and resolved emergency alerts for emergency contacts.
- **Frontend equivalent**: `supabase.from("alerts").select(...)`

### `GET /api/alerts/{alert_id}`
- **Description**: Fetches deep details for a specific incident (including user details and session timeline).
- **Frontend equivalent**: `supabase.from("alerts").select(...)`

---

## 6. Trusted Contacts (`/api/contacts`)

### `GET /api/contacts`
- **Description**: Lists all trusted contacts for the current user.
- **Frontend equivalent**: `supabase.from("trusted_contacts").select(...)`

### `POST /api/contacts`
- **Description**: Creates a new trusted contact.
- **Payload**: `{ "name": "string", "phone_number": "string", "relationship": "string", "is_emergency_contact": boolean }`
- **Frontend equivalent**: `supabase.from("trusted_contacts").insert(...)`

### `PUT /api/contacts/{contact_id}`
- **Description**: Updates an existing trusted contact.
- **Frontend equivalent**: `supabase.from("trusted_contacts").update(...)`

### `DELETE /api/contacts/{contact_id}`
- **Description**: Deletes a trusted contact.
- **Frontend equivalent**: `supabase.from("trusted_contacts").delete(...)`

### `POST /api/contacts/{contact_id}/opt-in`
- **Description**: Processes the secure invite link logic when a contact agrees to be an emergency contact.
- **Payload**: `{ "p_contact_id": "uuid", "p_token": "string" }`
- **Frontend equivalent**: `supabase.rpc("opt_in_trusted_contact")`

---

## 7. Background Tasks & Realtime (FastAPI Specifics)

**Realtime Fallback**
The React frontend currently uses `supabase.channel(...)` to listen for Postgres changes (e.g., when a check-in timer hits zero, or an alert status changes). If migrating to FastAPI, your backend developer will either need to:
1. Continue using Supabase Realtime just for WebSockets.
2. OR implement WebSockets natively in FastAPI (e.g., `ws://api/live-sync`).

**Background Workers**
The frontend triggers background tasks using:
`supabase.functions.invoke('alert-notification-worker')`
In FastAPI, this should be mapped to `BackgroundTasks` or a background worker (like Celery) triggered immediately after the `trigger_alert` endpoint completes.
