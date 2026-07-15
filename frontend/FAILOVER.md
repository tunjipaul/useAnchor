# Backend Failover Implementation Guide

## Overview

The useAnchor frontend now includes **automatic backend failover** capabilities. If your primary backend becomes unavailable, all API requests will automatically retry against a secondary backend without requiring any changes to your React components.

This is implemented at the API layer (`src/lib/api.ts`), making it transparent to all components using the `apiFetch()` function.

## Configuration

### Environment Variables

Two environment variables control the failover system:

- **`VITE_PRIMARY_API_URL`** (Required) — Your main backend URL
  - Example: `https://api.useanchor.com/api`

- **`VITE_SECONDARY_API_URL`** (Optional) — Your backup backend URL
  - Example: `https://backup-api.useanchor.com/api`
  - Leave empty to disable secondary backend

### Local Development

For local development, edit `.env.development`:

```env
VITE_PRIMARY_API_URL=http://127.0.0.1:8000/api
VITE_SECONDARY_API_URL=http://127.0.0.1:8001/api  # Optional secondary backend
```

Then run:
```bash
npm run dev
```

### Production (Vercel)

1. Go to your Vercel project dashboard
2. Navigate to **Settings > Environment Variables**
3. Add/update the variables:
   - `VITE_PRIMARY_API_URL`: Your primary production backend
   - `VITE_SECONDARY_API_URL`: Your backup production backend (optional)
4. Set environment to: **Production**
5. Redeploy your application

## How Failover Works

### Request Flow

```
User makes API call via apiFetch()
        ↓
Try PRIMARY backend
        ↓
    ┌─── Success? ───→ Return response
    │
    ├─ No, Network error?
    │
    ├─ No, Status 502/503/504?
    │
    └─ Yes, Secondary configured?
            ↓
        Try SECONDARY backend
            ↓
        Success? → Return response or throw error
```

### When Failover Triggers

Failover to the secondary backend occurs only when:

✅ **Network errors** (connection refused, timeout, DNS failure)
✅ **CORS errors** (cross-origin request failures)
✅ **HTTP 502** (Bad Gateway)
✅ **HTTP 503** (Service Unavailable)
✅ **HTTP 504** (Gateway Timeout)

### When Failover Does NOT Trigger

❌ **HTTP 4xx** (client errors like 400, 404, 401, 403)
❌ **HTTP 5xx** (other server errors like 500, 501)
❌ **Successful responses** (2xx, 3xx)
❌ **Parse errors** (malformed JSON from server)

## Request Preservation

During failover, all request properties are **exactly preserved**:

- **HTTP Method** (GET, POST, PUT, DELETE, etc.)
- **Headers** (Content-Type, Accept, custom headers)
- **Request Body** (JSON payload, form data)
- **Authentication Token** (Bearer token from localStorage)
- **Query Parameters** (in URL)

This means failover is **completely transparent** to your backend — it receives an identical request.

## API Usage in Components

No changes needed! Your existing component code works as-is:

```typescript
// In any component - failover happens automatically
try {
  const sessions = await apiFetch<Session[]>('/sessions');
  // This request automatically retries on secondary if primary fails
} catch (error: unknown) {
  if (error instanceof ApiError) {
    if (error.isFailoverExhausted) {
      // Both primary and secondary failed
      showError('Both backend servers are unavailable');
    } else if (error.type === 'network') {
      showError('Network error occurred');
    }
  }
}
```

## Error Handling

The `ApiError` class now includes failover information:

```typescript
export class ApiError extends Error {
  type: ApiErrorType;           // "network" | "cors" | "http" | "parse" | "unknown" | "failover"
  url: string;                  // URL that was attempted
  endpoint: string;             // Endpoint path (e.g., "/sessions")
  status?: number;              // HTTP status code
  detail?: string | object;     // Error details from server
  failedUrls?: string[];        // All URLs that were tried
  isFailoverExhausted?: boolean; // true if all backends failed
}
```

## Logging

When failover occurs, detailed logs are output to the browser console:

```javascript
// Primary failed, retrying on secondary
[useAnchor API] network error from primary backend. Attempting failover to secondary backend.
{
  endpoint: "/sessions",
  primaryUrl: "https://api.example.com/api",
  error: "Network error — could not reach https://api.example.com/api"
}

// Server error, retrying on secondary
[useAnchor API] Server error 503 from https://api.example.com/api. Attempting failover to secondary backend.
{
  endpoint: "/sessions",
  status: 503
}

// All backends failed
[useAnchor API] {
  type: "failover",
  message: "All backends failed for /sessions",
  endpoint: "/sessions",
  failedUrls: ["https://api.example.com/api", "https://backup-api.example.com/api"],
  isFailoverExhausted: true
}
```

## Monitoring and Observability

To monitor failover events in your application:

```typescript
// Override console.warn to capture failover attempts
const originalWarn = console.warn;
console.warn = (message, ...args) => {
  if (message?.includes?.('[useAnchor API]') && message?.includes?.('failover')) {
    // Send to your analytics/monitoring service
    trackEvent('backend_failover_attempt', {
      message,
      details: args[0],
      timestamp: new Date().toISOString()
    });
  }
  originalWarn(message, ...args);
};
```

## Testing Failover Locally

### Test 1: Primary Backend Down
```bash
# Terminal 1 - Start secondary backend on port 8001
cd backend2
uvicorn main:app --reload --port 8001

# Terminal 2 - Configure frontend
# Edit .env.development:
VITE_PRIMARY_API_URL=http://127.0.0.1:8000/api
VITE_SECONDARY_API_URL=http://127.0.0.1:8001/api

# Terminal 3 - Start frontend
npm run dev

# Now try an API call in your browser - it should work even though primary is down
```

### Test 2: Both Backends Down
```bash
# Stop all backend servers and verify error handling works correctly
```

## Performance Considerations

- **Failover adds minimal overhead**: Only invoked when primary fails
- **Request retried exactly once**: No exponential backoff loops
- **Timeout duration**: Uses browser's default fetch timeout (typically 30-60 seconds)
- **No caching between attempts**: Each attempt is a fresh HTTP request

## Architecture

```
src/lib/api.ts (Core implementation)
├── PRIMARY_API_URL          ← From VITE_PRIMARY_API_URL env var
├── SECONDARY_API_URL        ← From VITE_SECONDARY_API_URL env var
├── shouldFailover()         ← Decides if failover should occur
├── attemptFetch()           ← Single fetch attempt helper
└── apiFetch()               ← Main function with failover logic
    └── Loops through backends, trying each until success
        └── Preserves all request properties during retry
```

## Compatibility

- ✅ TypeScript (fully type-safe)
- ✅ React components (no changes needed)
- ✅ Vite build system (uses import.meta.env)
- ✅ Vercel deployment (environment variables supported)
- ✅ Browser fetch API (no external dependencies)
- ✅ All HTTP methods (GET, POST, PUT, DELETE, PATCH)
- ✅ Authentication tokens (via Bearer in Authorization header)
- ✅ Form data uploads (preserves FormData in retries)

## FAQ

**Q: Do I need to change my React components?**
A: No. Failover works transparently at the API layer. All existing code continues to work.

**Q: What if I only have one backend?**
A: Leave `VITE_SECONDARY_API_URL` empty. Failover is disabled and behaves like before.

**Q: Does failover slow down requests?**
A: No measurable impact on successful requests. Only retried requests go through both attempts.

**Q: Can I customize the failover behavior?**
A: Edit `src/lib/api.ts` and modify the `shouldFailover()` function or retry logic as needed.

**Q: What about WebSocket connections?**
A: Failover only applies to HTTP requests via `apiFetch()`. WebSockets would need separate handling.

**Q: Will 4xx errors trigger failover?**
A: No. Client errors (4xx) always fail immediately without trying secondary backend.

## Support

For issues or questions:
1. Check browser console logs (look for `[useAnchor API]` messages)
2. Verify environment variables are set correctly
3. Test connectivity to both backends directly
4. Review error details in the `ApiError` object
