# useAnchor — Personal Safety Companion

> **"Because someone should always know where you are."**

useAnchor is a Progressive Web App (PWA) designed to act as an automated personal safety companion. It is built to support individuals entering uncertain situations (e.g., a first date, marketplace meetup, traveling, or late-night transit) by establishing an active safety session that automatically checks in on the user and escalates alerts to trusted contacts if they go unresponsive.

For a full technical design overview, refer to the [useAnchor Technical Specification](file:///c:/Users/HP/Music/useAnchor/documentation/useAnchor_README.md).

---

## 📖 Table of Contents

1. [Product Philosophy](#1-product-philosophy)
2. [MVP Feature Scope](#2-mvp-feature-scope)
3. [Technology Stack](#3-technology-stack)
4. [Routing & Screen Directory](#4-routing--screen-directory)
5. [System Architecture Overview](#5-system-architecture-overview)
6. [Database Schema](#6-database-schema)
7. [Environment Variables](#7-environment-variables)
8. [Project Structure](#8-project-structure)
9. [Development Setup](#9-development-setup)
10. [Future Backend Integration Guidelines](#10-future-backend-integration-guidelines)

---

## 1. Product Philosophy

Traditional safety applications are **reactive**—they are triggered after danger has occurred (e.g., pressing an emergency button). useAnchor is **preventative** and built for the **uncertainty phase**. 

Instead of routing immediately to emergency services, useAnchor focuses on a user's **Trusted Contacts Network**. The app establishes a "dead-man-switch" pattern that checks in automatically at predefined intervals. If the user fails to respond within a grace period, the application triggers a workflow that shares the user's last known cached location with their selected contacts.

| Traditional Safety Apps | useAnchor |
|---|---|
| Activates **after** danger occurs | Activates **before** entering uncertainty |
| Reactive emergency trigger | Preventative automated workflows |
| Immediate emergency services focus | Trusted contacts escalations |
| Single-tap alert | Periodic automated safety check-ins |

---

## 2. MVP Feature Scope

### 🔒 Onboarding & Setup
- **Onboarding Flow**: A multi-slide introduction highlighting the app's features with fluid screen transitions.
- **International Verification**: Phone entry support powered by `react-phone-number-input` and validated using `libphonenumber-js`.
- **Profile Customization**: Local image upload previewing for customizable avatars.
- **Trusted Contacts Configuration**: Reusable circle of trust cards (preconfigured defaults and manual add/delete).
- **System Permissions**: Diagnostic flow requesting access to GPS Location, Push Notifications, and Microphone.

### ⚓ Safety Session Management
- **Session Initiation**: Define who you are meeting, location parameters, expected end times, and specific trusted contacts.
- **Periodic Check-Ins**: Interactive "Are you safe?" sheets checking in on users.
- **Dead-Man Switch Escalation**: Backend `pg_cron` jobs monitoring active sessions that automatically alert contacts when a return window is missed.
- **One-Tap SOS Ring**: Press-and-hold (2 seconds) instant trigger with zero-latency cached GPS dispatch.

### 📱 Dual-Viewport Layouts
- **Mobile Viewport (`< md`)**: Compact dashboard with a status banner, quick launch CTAs, log panels, and bottom navigation.
- **Desktop/Laptop Viewport (`>= md`)**: Advanced dashboard showing left sidebar navigation, top monitoring banners, active map simulation timers, safety log lists, and an interactive emergency SOS trigger.

---

## 3. Technology Stack

- **Frontend Core**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vite.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) with native CSS theme extensions
- **Routing**: [React Router v7 (`react-router-dom`)](https://reactrouter.com/)
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/) for global reactive state
- **Animations**: [Framer Motion](https://www.framer.com/motion/) for micro-interactions and transitions
- **Validation & Math**: [Zod](https://zod.dev/) & [react-hook-form](https://react-hook-form.com/)
- **Phone Processing**: `react-phone-number-input` & `libphonenumber-js`
- **Target Backend**: [Supabase](https://supabase.com/) (PostgreSQL + RLS + pg_cron + Edge Functions + Realtime subscriptions)
- **Notification Services**: Firebase Cloud Messaging (FCM) & Twilio SMS API fallback

---

## 4. Routing & Screen Directory

All frontend screens are mapped to distinct React Router paths inside [App.tsx](file:///c:/Users/HP/Music/useAnchor/frontend/src/App.tsx):

| Screen Name | Target Path | Auth Required | Scope / Actor |
|---|---|---|---|
| **Onboarding Flow** | `/` | No | New User Setup |
| **Phone Number Entry** | `/auth/phone` | No | Verification Start |
| **OTP Verification** | `/auth/verify` | No | Verification Code |
| **Profile Setup** | `/auth/profile-setup` | Yes | Profile Details |
| **Trusted Contacts** | `/auth/trusted-contacts` | Yes | Circle Management |
| **Permissions Check** | `/auth/permissions` | Yes | API Authorizations |
| **Home Dashboard** | `/dashboard` | Yes | User Main Screen |
| **Create Session** | `/session/new` | Yes | Pre-meetup Form |
| **Active Session Monitor** | `/session/active` | Yes | Live Timer & Check-in |
| **Session Timeline Logs** | `/session/timeline/:id` | Yes | Event History |
| **SOS Activated State** | `/session/sos` | Yes | Alarm Mode |
| **Contacts Manager** | `/contacts` | Yes | Network Manager |
| **Contact Opt-in Invite** | `/contacts/opt-in` | No | Contact Registration |
| **Alert Landing Page** | `/alert` | No | Public Safety Link |
| **Live Location Map** | `/alert/live` | No | Public Coordinates |
| **Settings Screen** | `/settings` | Yes | User Settings |

---

## 5. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        USER DEVICE                          │
│                                                             │
│   React 19 + TypeScript + Tailwind v4 PWA (Vite)            │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐  │
│   │ Session  │ │ Check-in │ │   SOS    │ │  Contacts   │  │
│   │   UI     │ │   UI     │ │  Button  │ │  Manager    │  │
│   └──────────┘ └──────────┘ └──────────┘ └─────────────┘  │
│                                                             │
│   Zustand (stores)          Service Worker (offline queue)  │
└───────────────────┬─────────────────────────────────────────┘
                    │  HTTPS / WebSockets (Supabase JS)
┌───────────────────▼─────────────────────────────────────────┐
│                     SUPABASE BACKEND                        │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │   Auth   │  │Postgres  │  │Realtime  │  │  Edge     │  │
│  │ Phone OTP│  │   DB     │  │  Engine  │  │ Functions │  │
│  └──────────┘  └──────────┘  └──────────┘  └─────┬─────┘  │
│                                                   │        │
│  ┌────────────────────────────────────────────┐   │        │
│  │  pg_cron (Scheduler / Escalations)         │   │        │
│  └────────────────────────────────────────────┘   │        │
└───────────────────────────────────────────────────┼─────────┘
                                                    │
              ┌─────────────────────────────────────┤
              │                                     │
┌─────────────▼──────────┐           ┌──────────────▼────────┐
│   Firebase FCM          │           │   Twilio SMS          │
│   Push Notifications    │           │   Fallback Channel    │
│   (Primary Route)       │           │   (Direct SMS Links)  │
└────────────────────────┘           └───────────────────────┘
```

### 🛰️ Low-Latency GPS Location Strategy
To prevent high battery drain and eliminate startup latency during critical SOS moments, the application tracks and updates location in the background:
1. **Background Caching**: When a session goes `/session/active`, `navigator.geolocation.watchPosition` caches coordinates inside the Zustand location store.
2. **Immediate SOS Dispatch**: Pressing SOS reads from this cache *instantly* instead of initiating a cold GPS lock.
3. **Accuracy Refinement**: Parallel async queries update the alert with fresh location fixes if they return within 5 seconds.

---

## 6. Database Schema

For backend deployment, useAnchor relies on the following schema structures:

### `profiles` (extends Supabase auth.users)
- `id` (uuid, PK) — references `auth.users.id`
- `name` (text, not null)
- `phone` (text) — stored in E.164 format
- `fcm_token` (text) — FCM push register key
- `created_at` / `updated_at` (timestamptz)

### `trusted_contacts` (reusable safety circles)
- `id` (uuid, PK)
- `user_id` (uuid) — references `profiles.id`
- `name` (text, not null)
- `phone` (text, not null) — stored in E.164 format
- `fcm_token` (text)
- `opted_in` (boolean)
- `created_at` (timestamptz)

### `sessions` (active timers)
- `id` (uuid, PK)
- `user_id` (uuid) — references `profiles.id`
- `title` (text, not null)
- `meet_person` (text, not null)
- `meet_phone` (text)
- `location_text` (text)
- `location_lat` / `location_lng` (double precision)
- `starts_at` (timestamptz)
- `expected_end` (timestamptz) — checked by `pg_cron`
- `status` (text) — `active` | `ended` | `sos`
- `checkin_interval_minutes` (integer)

---

## 7. Environment Variables

### Frontend Environment (`frontend/.env`)
Create a `.env` file in the frontend root to connect services:
```env
VITE_SUPABASE_URL=https://<your-supabase-project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
VITE_FIREBASE_API_KEY=<your-firebase-api-key>
VITE_FIREBASE_AUTH_DOMAIN=<project>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<project-id>
VITE_FIREBASE_MESSAGING_SENDER_ID=<sender-id>
VITE_FIREBASE_APP_ID=<app-id>
```

### Backend Secrets (`supabase secrets set ...`)
Provide these variables to Supabase Edge Functions:
```env
TWILIO_ACCOUNT_SID=<twilio-account-sid>
TWILIO_AUTH_TOKEN=<twilio-auth-token>
TWILIO_PHONE_NUMBER=<twilio-phone-number>
FIREBASE_PROJECT_ID=<firebase-project-id>
FIREBASE_CLIENT_EMAIL=<firebase-service-account-email>
FIREBASE_PRIVATE_KEY=<firebase-private-key>
```

---

## 8. Project Structure

```
useAnchor/
├── documentation/                    # Technical architecture design
│   └── useAnchor_README.md           # Master documentation file
│
├── backend/                          # Backend components (future migrations)
│
├── UI/                               # Design files and screen references
│
└── frontend/                         # Vite PWA React codebase
    ├── public/
    │   ├── favicon.png               # Brand Favicon asset
    │   └── manifest.webmanifest      # Progressive Web App configuration
    │
    ├── src/
    │   ├── main.tsx                  # Mounting entry point
    │   ├── App.tsx                   # Routes config
    │   ├── App.css
    │   ├── index.css                 # Tailwind CSS v4 styling rules
    │   │
    │   ├── assets/                   # Image assets (logos, icons)
    │   │
    │   ├── components/               # Custom design system components
    │   │
    │   └── features/                 # Modular design domains
    │       ├── auth/                 # OTP entry, profile, permissions
    │       ├── dashboard/            # Dual-viewport home screen
    │       ├── session/              # Creator forms, timers, timelines
    │       ├── contacts/             # Network addition/removal
    │       ├── alert/                # Alert mapping & layouts
    │       └── settings/             # User customizations
```

---

## 9. Development Setup

### ⚙️ Prerequisites
- [Node.js](https://nodejs.org/) v20 or higher
- [npm](https://www.npmjs.com/) or alternative package managers

### 🚀 Running the Frontend
1. Navigate into the frontend folder:
   ```bash
   cd frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Boot the Vite hot-reloading development server:
   ```bash
   npm run dev
   ```
   *The app runs on [http://localhost:5173](http://localhost:5173) by default.*
4. Build for production compilation checks:
   ```bash
   npm run build
   ```

---

## 10. Future Backend Integration Guidelines

Keep the following database requirements in mind when transitioning from client storage to live database configurations:

### 🌍 E.164 Phone Formatting Standard
- **Enforced Format**: All phone numbers stored in the `profiles` or `trusted_contacts` tables must conform strictly to the international **E.164 standard** (e.g. `+2348031234567` for Nigeria, or `+15550000000` for North America).
- **Validation**: Ensure the validation layer validates and converts input numbers to standard strings before posting to Supabase tables.
- **Why it matters**: Direct integrations (Twilio Verify, Twilio SMS fallback channels, Firebase verification payloads) will fail or route incorrectly if dial codes are omitted or spaces/hyphens remain.
