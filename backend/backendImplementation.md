# useAnchor Backend Implementation Notes

## Authentication Decision

### Development Authentication

Development uses Supabase Test Phone Numbers & OTPs. Test numbers and fixed OTP codes are configured directly in the Supabase dashboard under Authentication -> Providers -> Phone -> Test OTPs.

This bypasses real SMS delivery entirely while keeping the auth code path identical to production. There is no mock auth service layer.

### Production Authentication

Production uses Supabase Phone Auth with TextLocal configured as the SMS provider in the Supabase dashboard.

When development is complete, test phone numbers are removed from the dashboard and real OTPs are sent through TextLocal automatically. No frontend code changes are required.

### Auth Architecture

The frontend auth flow is abstracted behind one `AuthService` interface and one implementation:

```text
auth/
|-- services/
|   |-- AuthService.ts
|   `-- SupabaseAuthService.ts
```

`SupabaseAuthService` calls Supabase native phone auth methods:

- `signInWithOtp`
- `verifyOtp`

Supabase owns the dev/prod distinction through dashboard configuration. The app does not maintain a separate mock implementation.

Future SMS provider swaps for auth, such as Twilio or Termii, should be handled by changing the provider setting in Supabase. Frontend auth code should not change.

## Current Backend Direction

The database layer is the safety engine. Business-critical changes should continue to flow through Supabase RPCs rather than direct table mutation from the frontend.

Current backend priorities:

1. Keep auth behind `AuthService` with Supabase as the only implementation.
2. Keep notification providers out of MVP runtime until product requirements are finalized.
3. Use Edge Function workers for scheduling and queue orchestration.
4. Preserve audit logging and deterministic state transitions in the database.