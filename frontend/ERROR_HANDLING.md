# Security & Error Handling Guide

## Overview

The useAnchor frontend implements **centralized, security-first error handling** that prevents sensitive information from leaking to end users while maintaining detailed debugging capabilities in development.

### Security Principles

- ✅ **No sensitive details in UI** — Stack traces, database errors, API internals, endpoints never shown to users
- ✅ **User-friendly messages** — Clear, actionable feedback for what users can do
- ✅ **Full debugging in dev** — Complete error details in console for developers
- ✅ **Error categorization** — Distinguishes between validation, auth, network, and server errors
- ✅ **Consistent behavior** — All errors handled uniformly across the app

### What Gets Hidden (Production)

❌ Stack traces
❌ Database constraint names (`uq_active_session_per_user`, etc.)
❌ API endpoint paths and URLs
❌ Internal field names and validation logic
❌ Server diagnostic details
❌ Backend implementation specifics
❌ CORS configuration details
❌ Raw exception names or error codes

### What Users See

✅ "Please check your input and try again."
✅ "Unable to connect. Check your internet connection."
✅ "Your session has expired. Please sign in."
✅ "Too many requests. Please wait a moment."
✅ "This contact is already in your trusted circle."

## Error Categories

The system categorizes all errors into types for intelligent handling:

### 1. Validation Errors
**When:** User input fails validation (422 status, invalid phone format, etc.)
**User Message:** Field-specific guidance or "Please check your input and try again."
**Example:** "Please enter a valid phone number (e.g., +234... or +1...)"

### 2. Authentication Errors
**When:** User not authenticated, session expired, insufficient permissions (401/403)
**User Message:** "Your session has expired. Please sign in."
**Example:** "Your authentication credentials are invalid. Please sign in again."

### 3. Network Errors
**When:** Cannot reach backend, DNS failure, timeout
**User Message:** "Unable to connect. Check your internet connection and try again."
**Notes:** Includes failover retry information in logs

### 4. Server Errors
**When:** Backend returns 5xx (except 502/503/504 which trigger failover)
**User Message:** "The server is temporarily unavailable. Please try again in a moment."
**Notes:** Suggests temporary issue, encourages retry

### 5. Client Errors
**When:** Bad request, not found, etc. (4xx except 401/403)
**User Message:** "This action couldn't be completed. Please try again."
**Notes:** Generic since these shouldn't normally reach users

### 6. Timeout Errors
**When:** Request exceeds browser timeout (typically 30-60s)
**User Message:** "The request took too long. Check your connection and try again."

### 7. Parse Errors
**When:** Server returns invalid JSON or malformed response
**User Message:** "An unexpected response was received. Please try again."

## Usage in Components

### Basic Error Handling (Most Cases)

```typescript
import { handleError } from "../lib/errorHelpers";
import toast from "react-hot-toast";

async function handleAction() {
  try {
    const data = await apiFetch<Data>("/endpoint");
    // Success handling
  } catch (error: unknown) {
    // Use centralized error handling
    const userMessage = handleError(error, {
      action: "load data",
      endpoint: "/endpoint"
    });
    toast.error(userMessage);
  }
}
```

### Form Validation Error Handling

```typescript
import { getValidationErrors, handleError } from "../lib/errorHelpers";

async function handleSubmit(formData: FormData) {
  try {
    const result = await apiFetch("/submit", { method: "POST", body: JSON.stringify(formData) });
  } catch (error: unknown) {
    // Extract field-level validation errors if available
    const fieldErrors = getValidationErrors(error);
    
    if (fieldErrors) {
      // Highlight specific form fields
      Object.entries(fieldErrors).forEach(([field, msg]) => {
        setFieldError(field, msg);
      });
    } else {
      // Show general error message
      const userMessage = handleError(error);
      toast.error(userMessage);
    }
  }
}
```

### Development Debugging

The error handler automatically logs full technical details to the console in development:

```
[useAnchor Error] 2026-07-15T10:30:45.123Z VALIDATION
Category: validation
Endpoint: /contacts
Status: 422
API Error Details: {
  type: "http",
  message: "Validation error",
  url: "http://127.0.0.1:8000/api/contacts",
  detail: [
    { loc: ["body", "phone_number"], msg: "invalid phone format" },
    { loc: ["body", "name"], msg: "must be >= 2 characters" }
  ]
}
Stack Trace: Error: Validation error
  at apiFetch (api.ts:200)
  ...
Full Error Object: ApiError { ... }
```

## What NOT To Do

### ❌ Don't expose raw errors to users

```typescript
// BAD - User sees technical details
toast.error(error.message);
toast.error(JSON.stringify(error));
toast.error(`Database error: ${error.detail}`);
```

### ❌ Don't log to UI in production

```typescript
// BAD - Stack trace visible to users
<div className="error">{error.stack}</div>
<div className="error">{JSON.stringify(error)}</div>
```

### ❌ Don't display raw API responses

```typescript
// BAD - Exposes backend structure
toast.error(response.error.detail);
```

### ❌ Don't use console.error patterns that expose details

```typescript
// QUESTIONABLE - Shows implementation details in console
console.error("CORS error:", err);
console.error("Network error — check VITE_API_URL");
```

## What TO Do

### ✅ Use centralized error handling

```typescript
// GOOD - User sees friendly message, details in console (dev only)
const userMessage = handleError(error);
toast.error(userMessage);
```

### ✅ Log technical context in development

```typescript
// GOOD - Full details in console during development
if (import.meta.env.DEV) {
  console.error("Technical context:", {
    endpoint: "/endpoint",
    method: "POST",
    details: error
  });
}
```

### ✅ Distinguish error types for better UX

```typescript
// GOOD - Context-aware error handling
try {
  await apiFetch("/action");
} catch (error: unknown) {
  const category = categorizeError(error); // From error helpers
  
  if (category === "auth") {
    // Redirect to login
    navigate("/login");
  } else if (category === "network") {
    // Suggest checking connection
    toast.error("Check your internet connection");
  } else if (category === "validation") {
    // Show form errors
    displayFormErrors(error);
  }
}
```

### ✅ Use validation helpers for forms

```typescript
import { getValidationErrors } from "../lib/errorHelpers";

const fieldErrors = getValidationErrors(error);
if (fieldErrors) {
  // fieldErrors = { phone_number: "Invalid format", name: "Too short" }
  // Apply to form fields
}
```

## API Error Logging (Backend Failover Context)

When backend failover occurs, the error handler preserves context:

```typescript
// Error context from failover attempts
{
  category: "network",
  endpoint: "/sessions",
  statusCode: undefined,
  failedUrls: [
    "https://primary-api.example.com/api/sessions",
    "https://secondary-api.example.com/api/sessions"
  ],
  isFailoverExhausted: true
}
```

**User sees:** "Unable to connect. Please check your internet connection and try again."
**Console (dev) shows:** Full failover attempt details with both URLs

## Production Build Checklist

- ✅ All user-facing errors go through `handleError()`
- ✅ No `console.error` outputs sensitive details to production users
- ✅ Stack traces never appear in the UI
- ✅ Raw API responses never displayed
- ✅ Database error messages never shown
- ✅ All `import.meta.env.DEV` guards are in place
- ✅ Validation errors show field guidance, not constraint names

## Monitoring in Production

For production error monitoring, integrate with an error tracking service:

```typescript
// In src/lib/errorHelpers.ts or error-tracking.ts
function reportErrorToService(context: ErrorContext): void {
  if (import.meta.env.PROD) {
    // Send to Sentry, LogRocket, DataDog, etc.
    trackingService.captureException(context.originalError, {
      level: context.category === "auth" ? "warning" : "error",
      tags: {
        category: context.category,
        endpoint: context.endpoint,
        environment: "production"
      },
      extra: {
        timestamp: context.timestamp.toISOString(),
        userAgent: navigator.userAgent
      }
    });
  }
}
```

Then call in development logging:

```typescript
function logErrorInDevelopment(context: ErrorContext): void {
  if (!import.meta.env.DEV) {
    reportErrorToService(context); // Send to monitoring in production
    return;
  }
  // ... existing console logging for development
}
```

## Common Scenarios

### Scenario 1: User Enters Invalid Phone Number

```
Backend: Returns 422 with validation error
Error Handler: Extracts field-specific message
User Sees: "Please enter a valid phone number (e.g., +234... or +1...)"
Dev Console: Full validation error details with field location
```

### Scenario 2: Backend Database Constraint Violation

```
Backend: Returns 409 with constraint name (e.g., uq_active_session_per_user)
Error Handler: Maps to user-friendly message
User Sees: "You already have an active session in progress."
Dev Console: Full constraint and database context
```

### Scenario 3: Network Connectivity Loss

```
Frontend: Network error during fetch
Error Handler: Categorizes as network
User Sees: "Unable to connect. Check your internet connection and try again."
Dev Console: Full network error with failover attempt details
```

### Scenario 4: Authentication Token Expired

```
Backend: Returns 401 Unauthorized
Error Handler: Categorizes as auth
User Sees: "Your session has expired. Please sign in again."
Dev Console: Full auth error details
Action: Component redirects to login
```

## Testing Error Handling

### Test Scenario: Invalid Form Submission

```typescript
// src/features/auth/screens/__tests__/TrustedContactsScreen.test.ts
test("shows friendly error on validation failure", async () => {
  const { getByText } = render(<TrustedContactsScreen />);
  
  // Trigger validation error from API
  mockApiFetch.mockRejectedValueOnce(
    new ApiError({
      type: "http",
      status: 422,
      message: "Validation error",
      url: "http://api/contacts",
      endpoint: "/contacts",
      detail: [
        { loc: ["body", "phone_number"], msg: "invalid format" }
      ]
    })
  );
  
  // User should see friendly message, NOT constraint names
  await userEvent.click(getByText("Add Contact"));
  expect(getByText(/valid phone number/i)).toBeInTheDocument();
  expect(queryByText(/invalid format/i)).not.toBeInTheDocument();
});
```

## FAQ

**Q: Where do sensitive error details go?**
A: Only to the browser console in development mode (`import.meta.env.DEV`). They never reach production builds or the UI.

**Q: Can I customize error messages?**
A: Yes. Edit the mapping functions in `errorHelpers.ts`: `getSpecificUserMessage()`, `getCategoryUserMessage()`.

**Q: What about backend validation error details?**
A: The `getValidationErrors()` function safely extracts field-level errors for form handling. The function filters out constraint names and implementation details.

**Q: How do I log errors for monitoring?**
A: Use the `ErrorContext` created by `handleError()` and send it to your monitoring service (Sentry, DataDog, etc.). See "Monitoring in Production" section.

**Q: Should components ever show raw error messages?**
A: No. Always use `handleError()` to map errors to user-friendly messages. Only show raw errors in development tools/logs.

**Q: What about internationalization?**
A: Messages are English by default. To support multiple languages, create a message catalog that maps error categories to i18n keys.

## Related Documentation

- [API Layer & Failover](./FAILOVER.md) — Backend failover configuration
- [Deployment Guide](./DEPLOY.md) — Production deployment
