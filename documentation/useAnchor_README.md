# useAnchor — MVP Technical README

> **"Because someone should always know where you are."**

---

## Table of Contents

1. [What Is useAnchor](#1-what-is-useanchor)
2. [Who This README Is For](#2-who-this-readme-is-for)
3. [Product Philosophy](#3-product-philosophy)
4. [MVP Feature Scope](#4-mvp-feature-scope)
5. [System Architecture Overview](#5-system-architecture-overview)
6. [Frontend Architecture](#6-frontend-architecture)
7. [Backend Architecture](#7-backend-architecture)
8. [Database Architecture](#8-database-architecture)
9. [Notification Architecture](#9-notification-architecture)
10. [GPS & Location Architecture](#10-gps--location-architecture)
11. [Security & Privacy Architecture](#11-security--privacy-architecture)
12. [Screen Inventory](#12-screen-inventory)
13. [User Flows](#13-user-flows)
14. [API & Edge Function Reference](#14-api--edge-function-reference)
15. [Environment Variables](#15-environment-variables)
16. [Project Structure](#16-project-structure)
17. [Development Setup](#17-development-setup)
18. [Build & Deployment](#18-build--deployment)
19. [Post-MVP Roadmap](#19-post-mvp-roadmap)
20. [Decisions Log](#20-decisions-log)

---

## 1. What Is useAnchor

### Non-Technical Explanation

useAnchor is a mobile web application that acts as a personal safety companion when you are entering an uncertain situation — a first date, meeting someone from the internet, a marketplace exchange, or traveling somewhere unfamiliar.

Before you leave, you open useAnchor and create an **Anchor Session**. You enter who you are meeting, where you are going, and when you expect to return. You select people from your trusted contact list — friends, family, or anyone you trust.

From that point, useAnchor watches over you:

- It periodically checks that you are okay
- If you stop responding, it automatically notifies your trusted contacts
- If you feel unsafe at any moment, you can press a single button to immediately alert everyone with your location and session details
- Your contacts receive a link with everything they need to find you or get help

The app is built around **uncertainty, not emergency**. You do not need to be in danger to use it. The trigger is: *"I am entering a situation that may become unsafe."*

### Technical Summary

useAnchor is a React + TypeScript Progressive Web App (PWA) backed by Supabase (PostgreSQL + Realtime + Edge Functions). It implements a dead-man-switch check-in system, a one-tap SOS trigger with cached GPS dispatch, and a multi-channel notification system (Firebase Cloud Messaging plus a deferred SMS/provider queue for post-MVP delivery). The trusted contact network is a first-class database entity, reusable across sessions.

---

## 2. Who This README Is For

This document is written for three audiences simultaneously:

**Product context** — explains what the system does and why decisions were made, so any reader understands intent before implementation.

**Developers building the MVP** — contains all architecture decisions, data models, file structure, environment variables, and flow logic needed to begin coding without ambiguity.

**LLMs assisting with development** — this document is structured so that an AI coding assistant can ingest it and understand the full system context: what stack is used, what each layer does, how data flows, and what has intentionally been left out of MVP scope.

---

## 3. Product Philosophy

useAnchor is **not** an emergency response application.

Most safety apps activate after danger has already occurred. useAnchor activates before danger is confirmed — at the moment of uncertainty.

| Other Safety Apps | useAnchor |
|---|---|
| "I am in danger" | "I am entering a situation that may become unsafe" |
| Reactive | Preventative |
| Emergency services focus | Trusted contacts focus |
| One-way alert | Automated safety workflow |

The core promise is an automated safety workflow that:

- Knows who the user is meeting
- Knows when they should return
- Checks in automatically
- Escalates if communication stops
- Alerts trusted contacts when necessary

---

## 4. MVP Feature Scope

The following features constitute the complete MVP. Nothing outside this list should be built in the first version.

### 4.1 Trusted Contacts

A reusable personal network of trusted individuals. Contacts are created once and selected per session. They are not recreated per session.

Each contact stores: name, phone number, and FCM token (if they have the app).

### 4.2 Anchor Sessions

A temporary safety session created before a meetup or journey.

Fields: meeting title, person name/alias, optional phone number, location, expected return time, notes, selected trusted contacts.

Sessions have a status: `active`, `ended`, or `sos`.

### 4.3 SOS Button

A one-tap emergency trigger on the Active Session screen.

Behavior:
- Immediately reads cached GPS location (does not wait for a fresh fix)
- Writes an alert record to the database
- Invokes the SOS Edge Function to dispatch notifications
- Transitions the session status to `sos`
- Navigates user to SOS Activated screen

The SOS button uses press-and-hold (2 seconds) to prevent accidental activation.

### 4.4 Missed Check-In / Dead-Man Switch

The most critical automated feature.

When a session is created, the user sets an expected return time. A `pg_cron` job runs every 5 minutes and checks for sessions where:

- Status is `active`
- Expected return time has passed
- No check-in response has been received in the grace period

When conditions are met, the system automatically dispatches notifications to trusted contacts. This protects users who are unable to manually trigger SOS.

### 4.5 Check-In System

During an active session, the app prompts the user periodically:

> "Are you safe?"

Four responses: **I'm Safe**, **Extend Session**, **End Session**, **Need Help**.

"Need Help" triggers the same flow as manual SOS.

Missed responses escalate through three stages before full alert dispatch.

### Out of MVP Scope (Documented for Future)

- Power Button Trigger (requires native app shell via Capacitor)
- Voice Safe Word (requires native speech recognition APIs)
- Shared Incident Room for contact coordination (post-MVP feature)

---

## 5. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        USER DEVICE                          │
│                                                             │
│   React + TypeScript + Tailwind PWA (Vite)                  │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐  │
│   │ Session  │ │ Check-in │ │   SOS    │ │  Contacts   │  │
│   │   UI     │ │   UI     │ │  Button  │ │  Manager    │  │
│   └──────────┘ └──────────┘ └──────────┘ └─────────────┘  │
│                                                             │
│   Zustand (global state)    Service Worker (PWA + offline)  │
└───────────────────┬─────────────────────────────────────────┘
                    │  HTTPS / WebSocket
┌───────────────────▼─────────────────────────────────────────┐
│                     SUPABASE                                │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │   Auth   │  │Postgres  │  │Realtime  │  │  Edge     │  │
│  │ Phone OTP│  │   DB     │  │Subscript.│  │ Functions │  │
│  └──────────┘  └──────────┘  └──────────┘  └─────┬─────┘  │
│                                                   │        │
│  ┌────────────────────────────────────────────┐   │        │
│  │  pg_cron (dead-man-switch scheduler)       │   │        │
│  └────────────────────────────────────────────┘   │        │
└───────────────────────────────────────────────────┼─────────┘
                                                    │
              ┌─────────────────────────────────────┤
              │                                     │
┌─────────────▼──────────┐           ┌──────────────▼────────┐
│   Firebase FCM          │           │   Provider Queue      │
│   Push Notifications    │           │   Deferred Delivery   │
│   (primary channel)     │           │   (post-MVP provider) │
└────────────────────────┘           └───────────────────────┘
```

### How Data Flows (Non-Technical)

1. User creates an Anchor Session on their phone
2. Session is saved to the Supabase database
3. While the session is active, the app maintains a cached GPS location in the background
4. A scheduled database job watches for overdue sessions every 5 minutes
5. If the user presses SOS or misses a check-in, an Edge Function is triggered
6. The Edge Function sends push notifications via Firebase to contacts who have the app
7. For contacts without the app, alert recipients remain queued/deferred until the production notification provider is enabled
8. Trusted contacts open the link and see all session details and last known location

---

## 6. Frontend Architecture

### 6.1 Technology Stack

| Tool | Version | Purpose |
|---|---|---|
| React | 18+ | UI framework |
| TypeScript | 5+ | Type safety |
| Vite | 5+ | Build tool and dev server |
| vite-plugin-pwa | latest | PWA manifest + service worker |
| Tailwind CSS | 3+ | Utility-first styling |
| Zustand | 4+ | Global state management |
| React Router | 6+ | Client-side routing |
| Supabase JS | 2+ | Database + auth + realtime client |

### 6.2 PWA Configuration

useAnchor is built as a Progressive Web App. This means:

- Users can install it on their home screen without an app store
- The service worker enables offline queuing of SOS alerts
- Push notifications work without the app being open (via FCM)

Critical PWA behaviors:

- GPS permission is requested at onboarding, not at session start
- Notification permission is requested at onboarding
- The service worker queues SOS requests if the network is unavailable and fires them when connectivity returns

### 6.3 State Management

Zustand manages global state across three stores:

**`sessionStore`**
```typescript
interface SessionStore {
  activeSession: Session | null
  createSession: (data: SessionForm) => Promise<void>
  endSession: (sessionId: string) => Promise<void>
  triggerSOS: () => Promise<void>
}
```

**`locationStore`**
```typescript
interface LocationStore {
  cachedLocation: Coordinates | null
  isTracking: boolean
  startTracking: () => void
  stopTracking: () => void
  getLocation: () => Coordinates | null
}
```

**`contactStore`**
```typescript
interface ContactStore {
  contacts: TrustedContact[]
  fetchContacts: () => Promise<void>
  addContact: (contact: ContactForm) => Promise<void>
  removeContact: (id: string) => Promise<void>
}
```

### 6.4 Routing Structure

```
/                         → redirect to /home or /onboarding
/onboarding               → Screen 1: Auth + setup flow
/home                     → Screen 7: Dashboard
/session/new              → Screen 2: Create session
/session/:id              → Screen 3: Active session view
/session/:id/sos          → Screen 5: SOS activated
/session/:id/timeline     → Screen 10: Session history
/contacts                 → Screen 8: Contacts manager
/settings                 → Screen 12: Settings
/alert/:alert_id          → Screen 6: Alert landing (public, no auth)
/alert/:alert_id/location → Screen 9: Live location (public, no auth)
/join/:invite_token       → Screen 11: Contact opt-in (public, no auth)
```

Routes prefixed with `/alert/` and `/join/` are **public routes** — they require no authentication and are designed to be opened by trusted contacts who may not have the app installed.

### 6.5 Key Custom Hooks

```typescript
// Manages active session state and check-in subscription
useSession(sessionId: string)

// Manages real-time check-in prompt display
useCheckin(sessionId: string)

// Manages SOS trigger logic and GPS dispatch
useSOS()

// Manages background GPS caching during active session
useLocationCache()

// Manages FCM token registration and notification permission
usePushNotifications()
```

### 6.6 Component Architecture

Components are organized into three layers:

**UI Components** (`/components/ui/`) — Primitive design system components with no business logic:
`AnchorButton`, `AnchorInput`, `AnchorChip`, `ContactAvatar`, `ConfirmModal`, `EmptyState`, `AlertBanner`

**Feature Components** (`/features/*/components/`) — Composed from UI components, contain feature-specific logic:
`SessionCard`, `CheckinSheet`, `SOSButton`, `TimelineEvent`, `ContactRow`

**Screen Components** (`/features/*/screens/`) — Full screens composed from feature components, connected to stores and hooks.

---

## 7. Backend Architecture

### 7.1 Why Supabase

Supabase is chosen over a custom Express/NestJS backend for the following reasons:

- PostgreSQL + PostGIS for geospatial queries out of the box
- Realtime subscriptions replace the need for a separate WebSocket server
- Row Level Security enforces data privacy at the database level
- Edge Functions handle custom server logic (SOS dispatch, notification routing)
- pg_cron handles the dead-man-switch scheduler without external job queue infrastructure
- Phone OTP auth is built in, eliminating custom auth implementation
- Single vendor reduces infrastructure complexity for MVP

### 7.2 Edge Functions

Edge Functions are serverless TypeScript functions that run on Supabase's infrastructure. They handle logic that cannot run on the client.

#### `sos-trigger`

**Trigger:** Called by client on SOS button press

**Responsibilities:**
1. Receives `alert_id` from client
2. Reads alert record and session details from database
3. Fetches all trusted contacts for the session
4. Dispatches FCM push notification to each contact with app
5. Queues non-push recipients for the production notification provider when that post-MVP integration is enabled
6. Marks alert as `delivered: true`
7. Updates session status to `sos`

**Failure handling:** For MVP, failed or unsupported delivery paths remain auditable in lert_recipients; production provider fallback is a later integration.

#### `checkin-reminder`

**Trigger:** Called by pg_cron every 5 minutes

**Responsibilities:**
1. Queries for sessions where:
   - `status = 'active'`
   - `expected_end < now() - grace_period`
   - No check-in response in last interval
2. For each overdue session, determines escalation stage (1, 2, or 3)
3. Stage 1: Push reminder to session owner only
4. Stage 2: Second reminder to session owner
5. Stage 3: Notify all trusted contacts

#### `notify`

**Trigger:** Called internally by `sos-trigger` and `checkin-reminder`

**Responsibilities:**
1. Routes notification work through the alert recipient queue
2. Constructs message payload with session details and alert link
3. Returns delivery status per contact

#### `schedule-checkins`

**Trigger:** Called by client when session is created

**Responsibilities:**
1. Records the session's check-in interval preference
2. Registers the session for the pg_cron monitoring window

### 7.3 pg_cron Schedule

```sql
-- Runs every 5 minutes, calls checkin-reminder Edge Function
select cron.schedule(
  'missed-checkin-escalation',
  '*/5 * * * *',
  $$
    select net.http_post(
      url := 'https://<project>.supabase.co/functions/v1/checkin-reminder',
      headers := '{"Authorization": "Bearer <service_role_key>"}'::jsonb,
      body := '{}'::jsonb
    )
  $$
);
```

### 7.4 Current Backend Implementation Status

The database layer now contains the core safety engine as transactional PL/pgSQL RPCs. The frontend and workers should call these RPCs for mutations instead of directly updating safety-critical tables.

Implemented RPC domains:

- **Session lifecycle**: `start_anchor_session`, `schedule_anchor_session`, `cancel_anchor_session`, and `complete_anchor_session` enforce session state transitions and write audit events.
- **Check-ins**: `create_checkins_for_session`, `mark_checkin_completed`, `mark_checkin_missed`, and `skip_checkin` create scheduled check-ins, record user responses, and escalate missed responses.
- **Alerts and escalation**: `trigger_alert`, `resolve_alert`, and `cancel_alert` handle SOS and missed-check-in alerts, emergency transitions, resolution, false alarms, and duplicate-alert protection.
- **Trusted contacts**: `add_session_contacts`, `link_trusted_contact_to_profile`, and `acknowledge_alert` implement immutable session contact snapshots, app-profile linking, and contact acknowledgements.
- **Notification pipeline**: `queue_alert_recipients`, `mark_recipient_sent`, `mark_recipient_delivered`, and `mark_recipient_failed` maintain per-recipient delivery state, retry counters, and delivery error metadata.
- **Audit logging**: `log_audit_event` records actor identity, event category, event type, entity references, metadata, and correlation IDs for incident replay and debugging.

Current implementation boundary:

- The deterministic DB/RPC state machine exists.
- Edge Function workers are still required to run the engine continuously.
- Realtime subscriptions and React hooks are still required to expose the engine cleanly to the UI.
- Offline reconciliation, network-failure recovery, time drift handling, and notification retry policy still need implementation hardening.

### 7.5 Authentication Implementation

Development authentication uses Supabase Test Phone Numbers & OTPs configured in the Supabase dashboard under Authentication -> Providers -> Phone -> Test OTPs. This bypasses real SMS delivery while keeping the same production auth code path.

Production authentication uses Supabase Phone Auth with TextLocal configured as the SMS provider. Removing dashboard test numbers switches real users to real OTP delivery without frontend changes.

The frontend auth flow should stay behind a single `AuthService` interface and one `SupabaseAuthService` implementation. `SupabaseAuthService` calls Supabase native `signInWithOtp` and `verifyOtp`; there is no separate mock auth implementation.

Future auth SMS provider swaps, such as Twilio or Termii, should happen in Supabase provider configuration, not frontend code.

---

## 8. Database Architecture

### 8.1 Schema Overview

```
auth.users (Supabase managed)
    │
    └── profiles (extends auth.users)
            │
            ├── trusted_contacts (user's reusable contact network)
            │
            └── sessions (anchor sessions)
                    │
                    ├── session_contacts (contacts attached to session)
                    │       └── references trusted_contacts
                    │
                    ├── checkins (check-in event log)
                    │
                    └── alerts (SOS + escalation alerts)
                            └── alert_deliveries (per-contact delivery log)
```

### 8.2 Full Table Definitions

```sql
-- User profiles (extends Supabase auth)
create table profiles (
  id          uuid primary key references auth.users on delete cascade,
  name        text not null,
  phone       text,
  fcm_token   text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Reusable trusted contact network (first-class entity)
create table trusted_contacts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id) on delete cascade,
  name        text not null,
  phone       text not null,
  fcm_token   text,
  opted_in    boolean default false,
  created_at  timestamptz default now()
);

-- Anchor sessions
create table sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references profiles(id) on delete cascade,
  title           text not null,
  meet_person     text not null,
  meet_phone      text,
  location_text   text,
  location_lat    double precision,
  location_lng    double precision,
  starts_at       timestamptz default now(),
  expected_end    timestamptz not null,
  notes           text,
  status          text default 'active'
                  check (status in ('active', 'ended', 'sos')),
  checkin_interval_minutes integer default 30,
  created_at      timestamptz default now()
);

-- Contacts attached to a session (references trusted_contacts)
create table session_contacts (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid references sessions(id) on delete cascade,
  contact_id      uuid references trusted_contacts(id) on delete cascade,
  unique (session_id, contact_id)
);

-- Check-in events during a session
create table checkins (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid references sessions(id) on delete cascade,
  response        text check (response in
                    ('safe', 'extend', 'end', 'sos', 'missed')),
  location_lat    double precision,
  location_lng    double precision,
  created_at      timestamptz default now()
);

-- SOS and escalation alerts
create table alerts (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid references sessions(id) on delete cascade,
  trigger_type    text check (trigger_type in
                    ('manual_sos', 'missed_checkin', 'checkin_help')),
  location_lat    double precision,
  location_lng    double precision,
  triggered_at    timestamptz default now(),
  resolved_at     timestamptz
);

-- Per-contact delivery log for each alert
create table alert_deliveries (
  id              uuid primary key default gen_random_uuid(),
  alert_id        uuid references alerts(id) on delete cascade,
  contact_id      uuid references trusted_contacts(id),
  channel         text check (channel in ('fcm', 'sms')),
  delivered       boolean default false,
  delivered_at    timestamptz,
  created_at      timestamptz default now()
);
```

### 8.3 Row Level Security Policies

Row Level Security (RLS) means the database itself enforces that users can only access their own data. This is not handled in application code — it is enforced at the database level.

```sql
-- Profiles: users can only read and update their own profile
alter table profiles enable row level security;
create policy "Own profile only" on profiles
  using (auth.uid() = id);

-- Trusted contacts: users can only manage their own contacts
alter table trusted_contacts enable row level security;
create policy "Own contacts only" on trusted_contacts
  using (auth.uid() = user_id);

-- Sessions: users can only access their own sessions
alter table sessions enable row level security;
create policy "Own sessions only" on sessions
  using (auth.uid() = user_id);

-- Alerts: public read via alert_id (for trusted contact landing page)
-- No auth required to read an alert by its ID (the ID itself is the access token)
alter table alerts enable row level security;
create policy "Alert read by id" on alerts
  for select using (true);
-- Write restricted to service role (Edge Functions only)
```

### 8.4 Important Database Notes for Developers

- `trusted_contacts` is a standalone table owned by the user. It is **not** tied to a session. Sessions reference contacts via `session_contacts`.
- `alerts.id` acts as an unguessable access token for the public alert landing page. No additional auth is needed for trusted contacts to view alert details — knowing the UUID is sufficient authorization.
- All GPS coordinates are stored as `double precision` lat/lng pairs. PostGIS is not required for MVP — standard coordinate storage is sufficient for the location features in scope.
- `sessions.expected_end` is the trigger field for the dead-man-switch. The pg_cron job queries this field every 5 minutes.

---

## 9. Notification Architecture

### 9.1 Two-Channel Strategy

useAnchor uses two notification channels in a priority order:

| Channel | Library | When Used |
|---|---|---|
| Push Notification | Firebase Cloud Messaging | Contact has app installed and FCM token registered |
| SMS/provider fallback | Deferred post-MVP provider | Contact has no app, or push delivery fails |

The goal: a trusted contact must receive an alert regardless of whether they have useAnchor installed.

### 9.2 FCM Setup (Push Notifications)

Firebase Cloud Messaging is configured in the frontend via the Firebase JS SDK.

When a user registers in useAnchor:
1. App requests notification permission
2. Firebase generates an FCM token for the device
3. Token is stored in `profiles.fcm_token`

When a contact is added:
1. If the contact has useAnchor, their FCM token is fetched
2. Token stored in `trusted_contacts.fcm_token`

The `notify` Edge Function uses the Firebase Admin SDK (server-side) to dispatch push notifications.

### 9.3 SMS / Provider Fallback

For MVP, the notification worker claims `alert_recipients` records and records a deferred provider result when:

- A contact has no FCM token (no app installed)
- Push delivery returns a failure status

The future provider payload should include:
- The session owner's name
- A short description of the situation
- A direct link to `/alert/:alert_id`

Example future provider message:
```
SAFETY ALERT: David may need help.
He started a session at 7:30 PM and has not responded.
View details and location: https://useanchor.app/alert/abc-123
```

### 9.4 Notification Payload Structure

```typescript
interface NotificationPayload {
  title: string         // e.g. "Safety Alert — David needs help"
  body: string          // Short summary
  data: {
    alert_id: string    // Links to /alert/:alert_id
    session_id: string
    trigger_type: string
    location_lat: string
    location_lng: string
    triggered_at: string
  }
}
```

---

## 10. GPS & Location Architecture

### 10.1 The Core Problem

Fresh GPS fixes can take 5–15 seconds to acquire on a mobile device. Waiting for a fix during an SOS event introduces unacceptable delay.

### 10.2 Cached Location Strategy

When a session becomes active, the `useLocationCache` hook starts watching the device's GPS position in the background using the browser's `navigator.geolocation.watchPosition` API.

The most recent position is stored in the `locationStore` Zustand store — always available in memory.

When SOS fires:
1. The cached location is **immediately** read from the store and included in the alert
2. In parallel, a fresh GPS fix is attempted
3. If the fresh fix arrives within 5 seconds, it updates the alert record
4. If not, the cached location stands

This means SOS dispatch is never blocked by GPS acquisition.

```typescript
// locationStore.ts
startTracking: () => {
  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      set({
        cachedLocation: {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        }
      })
    },
    (error) => console.error('GPS error:', error),
    { enableHighAccuracy: true, maximumAge: 30000 }
  )
  set({ watchId, isTracking: true })
}
```

### 10.3 Tracking Lifecycle

- **Starts:** When a session status becomes `active`
- **Stops:** When session status becomes `ended` or `sos` is resolved
- **Privacy:** Location is never tracked outside an active session

---

## 11. Security & Privacy Architecture

### 11.1 Authentication

- Phone OTP via Supabase Auth
- JWT access tokens with refresh token rotation
- Tokens stored in memory (not localStorage) via Supabase JS client defaults

### 11.2 Data Privacy Principles

- Location data is only collected during active sessions
- Trusted contacts only see data they are explicitly linked to via alert links
- Alert links use unguessable UUIDs — knowing the link is the authorization
- All session data can be deleted by the user at any time
- RLS policies enforce data isolation at the database level — no application-layer workaround can bypass them

### 11.3 Public Routes Security Model

The alert landing page (`/alert/:alert_id`) is intentionally public — no login required. The security model is:

- `alert_id` is a UUID v4 (122 bits of entropy)
- Brute-forcing is computationally infeasible
- The link is only sent to explicitly selected trusted contacts
- Alert records contain no sensitive PII beyond what the session owner chose to enter

This is the same security model used by shared document links (e.g. Google Docs "anyone with the link can view").

---

## 12. Screen Inventory

| # | Screen | Route | Auth Required | User |
|---|---|---|---|---|
| 1 | Onboarding / Auth | `/onboarding` | No | Creator |
| 2 | Create Session | `/session/new` | Yes | Creator |
| 3 | Active Session View | `/session/:id` | Yes | Creator |
| 4 | Check-in Prompt | Overlay on `/session/:id` | Yes | Creator |
| 5 | SOS Activated | `/session/:id/sos` | Yes | Creator |
| 6 | Alert Landing Page | `/alert/:alert_id` | No | Contact |
| 7 | Home / Dashboard | `/home` | Yes | Creator |
| 8 | Contacts Manager | `/contacts` | Yes | Creator |
| 9 | Live Location View | `/alert/:alert_id/location` | No | Contact |
| 10 | Session Timeline | `/session/:id/timeline` | Yes | Creator |
| 11 | Contact Opt-in | `/join/:invite_token` | No | Contact |
| 12 | Settings | `/settings` | Yes | Creator |

Screens 6, 9, and 11 are public web pages — no app install required. They are designed to be opened from SMS or push notification links by trusted contacts.

---

## 13. User Flows

### 13.1 Happy Path — Session Creator

```
Open app
  → Onboarding (first time only)
    → Phone OTP
    → Grant GPS permission
    → Grant notification permission
    → Enter name
  → Home Dashboard
  → Create Session
    → Enter meeting details
    → Select trusted contacts
    → Add notes
    → Review and confirm
  → Active Session View
    → GPS caching starts
    → Check-in prompt appears at interval
    → User responds "I'm Safe"
    → Session countdown continues
  → User taps "End Session"
  → Session marked ended
  → GPS caching stops
  → Home Dashboard
```

### 13.2 SOS Flow — Manual Trigger

```
Active Session View
  → User holds SOS button for 2 seconds
  → locationStore.getLocation() returns cached GPS immediately
  → Alert record written to database
  → sos-trigger Edge Function called
    → Reads session and contacts
    → Dispatches FCM to contacts with app
    → Queues/defer contacts without app for the production provider
    → Updates alert recipient queue state
  → Session status → 'sos'
  → User navigates to SOS Activated screen
  → User sees confirmation: contacts notified, GPS shared
```

### 13.3 Dead-Man Switch Flow — Missed Check-In

```
pg_cron fires every 5 minutes
  → checkin-reminder Edge Function called
  → Queries sessions where:
      status = 'active'
      AND expected_end < now() - 10 min grace period
      AND no recent checkin response
  → For each overdue session:
      Stage 1: Push reminder to session owner (1st miss)
      Stage 2: Second reminder to session owner (2nd miss)
      Stage 3: Notify all trusted contacts (3rd miss)
  → Trusted contacts receive alert
  → Alert landing page available at /alert/:id
```

### 13.4 Trusted Contact Flow

```
Contact receives SMS or push notification
  → Opens link: /alert/:alert_id
  → Sees alert landing page (no login required)
    → Session owner name and details
    → Who they were meeting
    → Location with Google Maps link
    → Time of alert
    → "Get Directions" button
    → "Call [Name]" button
    → "View Live Location" button → /alert/:id/location
```

---

## 14. API & Edge Function Reference

### Edge Function: `sos-trigger`

```
POST /functions/v1/sos-trigger
Authorization: Bearer <user_jwt>

Body:
{
  "alert_id": "uuid"
}

Response:
{
  "success": true,
  "contacts_notified": 3,
  "delivery_log": [
    { "contact_id": "uuid", "channel": "fcm", "delivered": true },
    { "contact_id": "uuid", "channel": "sms", "delivered": true }
  ]
}
```

### Edge Function: `checkin-reminder`

```
POST /functions/v1/checkin-reminder
Authorization: Bearer <service_role_key>   ← called by pg_cron only

Body: {}

Response:
{
  "sessions_checked": 12,
  "escalations_triggered": 1
}
```

### Edge Function: `notify`

```
POST /functions/v1/notify
Authorization: Bearer <service_role_key>   ← internal only

Body:
{
  "contact_id": "uuid",
  "alert_id": "uuid",
  "channel": "fcm" | "sms"
}
```

### Edge Function: `schedule-checkins`

```
POST /functions/v1/schedule-checkins
Authorization: Bearer <user_jwt>

Body:
{
  "session_id": "uuid",
  "interval_minutes": 30
}
```

---

## 15. Environment Variables

### Frontend (`apps/web/.env`)

```env
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key>
VITE_FIREBASE_API_KEY=<firebase_api_key>
VITE_FIREBASE_AUTH_DOMAIN=<project>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<project_id>
VITE_FIREBASE_MESSAGING_SENDER_ID=<sender_id>
VITE_FIREBASE_APP_ID=<app_id>
VITE_FIREBASE_VAPID_KEY=<vapid_key>
```

### Supabase Edge Functions (`supabase/.env`)

```env
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
FIREBASE_PROJECT_ID=<project_id>
FIREBASE_CLIENT_EMAIL=<service_account_email>
FIREBASE_PRIVATE_KEY=<service_account_private_key>
APP_URL=https://useanchor.app
```

---

## 16. Project Structure

```
useanchor/
│
├── apps/
│   └── web/                          # React + Vite PWA
│       ├── public/
│       │   └── icons/                # PWA icons (192, 512px)
│       ├── src/
│       │   ├── main.tsx              # App entry point
│       │   ├── App.tsx               # Router + auth guard
│       │   │
│       │   ├── components/
│       │   │   └── ui/               # Primitive design system components
│       │   │       ├── AnchorButton.tsx
│       │   │       ├── AnchorInput.tsx
│       │   │       ├── AnchorChip.tsx
│       │   │       ├── ContactAvatar.tsx
│       │   │       ├── ConfirmModal.tsx
│       │   │       ├── EmptyState.tsx
│       │   │       ├── AlertBanner.tsx
│       │   │       └── BottomNav.tsx
│       │   │
│       │   ├── features/
│       │   │   ├── auth/
│       │   │   │   ├── screens/
│       │   │   │   │   └── OnboardingScreen.tsx
│       │   │   │   └── hooks/
│       │   │   │       └── useAuth.ts
│       │   │   │
│       │   │   ├── session/
│       │   │   │   ├── screens/
│       │   │   │   │   ├── CreateSessionScreen.tsx
│       │   │   │   │   ├── ActiveSessionScreen.tsx
│       │   │   │   │   ├── SOSActivatedScreen.tsx
│       │   │   │   │   └── SessionTimelineScreen.tsx
│       │   │   │   ├── components/
│       │   │   │   │   ├── SessionCard.tsx
│       │   │   │   │   ├── SOSButton.tsx
│       │   │   │   │   ├── CheckinSheet.tsx
│       │   │   │   │   └── TimelineEvent.tsx
│       │   │   │   └── hooks/
│       │   │   │       ├── useSession.ts
│       │   │   │       ├── useCheckin.ts
│       │   │   │       └── useSOS.ts
│       │   │   │
│       │   │   ├── contacts/
│       │   │   │   ├── screens/
│       │   │   │   │   ├── ContactsManagerScreen.tsx
│       │   │   │   │   └── ContactOptInScreen.tsx
│       │   │   │   └── hooks/
│       │   │   │       └── useContacts.ts
│       │   │   │
│       │   │   ├── alert/
│       │   │   │   ├── screens/
│       │   │   │   │   ├── AlertLandingScreen.tsx
│       │   │   │   │   └── LiveLocationScreen.tsx
│       │   │   │   └── hooks/
│       │   │   │       └── useAlert.ts
│       │   │   │
│       │   │   ├── dashboard/
│       │   │   │   └── screens/
│       │   │   │       └── HomeScreen.tsx
│       │   │   │
│       │   │   └── settings/
│       │   │       └── screens/
│       │   │           └── SettingsScreen.tsx
│       │   │
│       │   ├── stores/
│       │   │   ├── sessionStore.ts
│       │   │   ├── locationStore.ts
│       │   │   └── contactStore.ts
│       │   │
│       │   ├── lib/
│       │   │   ├── supabase.ts       # Supabase singleton client
│       │   │   └── fcm.ts            # Firebase + FCM token setup
│       │   │
│       │   └── types/
│       │       └── index.ts          # Shared TypeScript interfaces
│       │
│       ├── vite.config.ts
│       ├── tailwind.config.ts
│       └── tsconfig.json
│
└── supabase/
    ├── functions/
    │   ├── sos-trigger/
    │   │   └── index.ts
    │   ├── checkin-reminder/
    │   │   └── index.ts
    │   ├── notify/
    │   │   └── index.ts
    │   └── schedule-checkins/
    │       └── index.ts
    │
    └── migrations/
        ├── 001_profiles.sql
        ├── 002_trusted_contacts.sql
        ├── 003_sessions.sql
        ├── 004_session_contacts.sql
        ├── 005_checkins.sql
        ├── 006_alerts.sql
        ├── 007_alert_deliveries.sql
        ├── 008_rls_policies.sql
        └── 009_pg_cron_schedule.sql
```

---

## 17. Development Setup

### Prerequisites

- Node.js 20+
- npm or pnpm
- Supabase CLI (`npm install -g supabase`)
- A Supabase project (free tier works for development)
- A Firebase project with Cloud Messaging enabled
- Supabase Phone Auth configured with dashboard Test OTPs for development

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/yourorg/useanchor.git
cd useanchor

# 2. Install dependencies
npm install

# 3. Copy and populate environment variables
cp apps/web/.env.example apps/web/.env
# Fill in Supabase and Firebase values

# 4. Link to your Supabase project
supabase login
supabase link --project-ref <your-project-ref>

# 5. Run database migrations
supabase db push

# 6. Deploy Edge Functions
supabase functions deploy sos-trigger
supabase functions deploy checkin-reminder
supabase functions deploy notify
supabase functions deploy schedule-checkins

# 7. Set Edge Function secrets
supabase secrets set FIREBASE_PROJECT_ID=<value>
supabase secrets set FIREBASE_CLIENT_EMAIL=<value>
supabase secrets set FIREBASE_PRIVATE_KEY=<value>
supabase secrets set APP_URL=https://useanchor.app

# 8. Start development server
npm run dev
```

---

## 18. Build & Deployment

### Frontend

```bash
npm run build
# Output: apps/web/dist/
```

Recommended deployment target: **Vercel** or **Netlify**

Both support PWA headers correctly. Ensure the following headers are set for the service worker to function:

```
Service-Worker-Allowed: /
Cache-Control: no-cache  (for sw.js only)
```

### Supabase

Edge Functions are deployed via the Supabase CLI (see Development Setup above). Database migrations run via `supabase db push`.

### PWA Checklist Before Production

- [ ] `manifest.webmanifest` has correct `start_url`, `scope`, and icons
- [ ] Service worker registers correctly on HTTPS
- [ ] FCM VAPID key is correctly set
- [ ] GPS permission prompt tested on real iOS and Android devices
- [ ] Offline SOS queue tested by disabling network during SOS trigger
- [ ] Supabase Phone Auth tested with dashboard Test OTPs

---

## 19. Post-MVP Roadmap

These features are explicitly out of MVP scope. They are documented here so future contributors understand intent and approach.

### Shared Incident Room

When an SOS fires, all notified contacts should land on a **shared live page** rather than individual alert pages. The shared page shows:

- Who else was notified
- Real-time acknowledgement status per contact ("A — Acknowledged", "B — En route")
- Shared location feed
- Session details visible to all

This requires an `incident_responses` table and Supabase Realtime subscriptions on the public alert page. No new infrastructure — extension of existing architecture.

### Power Button Trigger

Pressing the device power button multiple times to trigger SOS without unlocking the phone.

**Requires:** Capacitor native shell wrapping the React app. The `@capacitor/app` plugin provides hardware button access on iOS and Android. The React codebase transfers directly — no rewrite needed.

### Voice Safe Word

A user-configurable spoken phrase that triggers SOS when detected during an active session.

**Requires:** Native app shell. On iOS: `SFSpeechRecognizer` (on-device, battery-efficient, offline). On Android: `SpeechRecognizer`. Session-scoped only — listening starts when session activates, stops when session ends.

The Web Speech API is not suitable for this use case due to browser inconsistencies, battery drain, and lack of offline support.

### Contact Coordination

Allow trusted contacts to update their response status on the shared incident page (Acknowledged / En route / Called emergency services). Requires the Shared Incident Room feature above.

---

## 20. Decisions Log

This section documents architectural decisions and the reasoning behind them. Useful for understanding why things are built the way they are.

| Decision | Choice | Reason |
|---|---|---|
| Backend platform | Supabase over Express/NestJS | Realtime, RLS, auth, and pg_cron in one platform reduces infrastructure complexity for MVP |
| Auth method | Supabase Phone OTP | Mobile-first users; dashboard Test OTPs support development, TextLocal handles production OTP delivery; no password management needed |
| State management | Zustand over Redux | Lighter weight, simpler API, sufficient for this scope |
| GPS strategy | Cached location, not fresh fix | Fresh GPS during SOS introduces dangerous latency; cached location dispatches immediately |
| Trusted contacts | First-class table, not per-session | Users should not rebuild their safety network for every session |
| Alert page auth | UUID as access token, no login | Trusted contacts should never need to install the app to receive an alert |
| PWA over native | PWA for MVP | Faster to build; no app store approval; installable from browser. Native shell (Capacitor) deferred to post-MVP for power button and voice features |
| Check-in scheduler | pg_cron inside Supabase | Eliminates external job queue (no BullMQ/Redis); runs inside existing infrastructure |
| Notification fallback | Deferred provider queue | Keeps alert recipient delivery auditable in MVP while provider-specific SMS integration remains post-MVP |
| SOS confirmation | 2-second hold, not single tap | Prevents accidental activation without adding meaningful friction in a real emergency |

---

## 21. Backend Runtime TODO

The database RPC layer is implemented, but the runtime layer still needs workers, subscriptions, frontend hooks, and resilience hardening. Keep the following guidelines in mind:

* **E.164 Phone Format Storage**: The validated phone number must be submitted and stored in the database profiles and trusted contacts tables in **E.164 international format** (e.g. `+2348031234567` or `+15550000000`).
* **Why E.164**: This format ensures full compatibility with Supabase Auth OTP, SMS notification providers and Supabase Phone Auth providers such as TextLocal, and future messaging services without regional formatting conflicts.

---

*useAnchor MVP — Internal Technical Documentation*
*Status: Backend RPC engine implemented; Edge Function workers, realtime subscriptions, and frontend integration pending*
*Last updated: June 2026*
