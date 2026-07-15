# Error Handling Security Audit Checklist

Use this checklist to review components for proper error handling and to ensure no sensitive information leaks to users.

## For Component Authors

### ✅ Checklist Items

- [ ] **Error imports** — Component imports `handleError` and/or `getValidationErrors` from `lib/errorHelpers`
- [ ] **Error display** — All user-facing errors pass through `handleError()` before display
- [ ] **No raw errors in UI** — No `error.message`, `error.stack`, `error.detail`, or `JSON.stringify(error)` displayed directly
- [ ] **Form validation** — Uses `getValidationErrors()` to extract field-specific errors
- [ ] **Authentication flow** — 401/403 errors redirect to login, not shown as generic error
- [ ] **Network errors** — Suggest checking internet connection, not show endpoint URLs
- [ ] **Console logging** — Only uses `console.error()` for debugging during development, not exposed in production
- [ ] **No database names** — Never shows constraint names like `uq_active_session_per_user`
- [ ] **No internal details** — Never shows:
  - API endpoint paths
  - Field validation logic
  - Server configuration
  - CORS configuration
  - Stack traces
  - Exception class names
- [ ] **Toast/alert messages** — All use the result of `handleError()` or `getValidationErrors()`
- [ ] **Error state** — Component state (`formError`, `errorMsg`) never set with raw error data
- [ ] **Type safety** — Error catch blocks properly typed (`catch (error: unknown)`)

### ❌ Common Issues to Fix

```typescript
// BEFORE - ❌ Security Issues
try {
  await apiFetch("/data");
} catch (error: any) {
  // ISSUE 1: Direct message display
  setError(error.message);
  
  // ISSUE 2: Stack trace exposure
  setError(error.stack);
  
  // ISSUE 3: Raw JSON display
  setError(JSON.stringify(error));
  
  // ISSUE 4: Console.error shows details to users
  console.error("Error:", error);
}
```

```typescript
// AFTER - ✅ Secure Error Handling
try {
  await apiFetch("/data");
} catch (error: unknown) {
  // Centralized error handling
  const userMessage = handleError(error);
  setError(userMessage);
  
  // Console logging for development only
  // (automatically suppressed in production by errorHelpers.ts)
}
```

### Common Patterns

#### Pattern 1: Simple Error Display
```typescript
import { handleError } from "../lib/errorHelpers";
import toast from "react-hot-toast";

try {
  await apiFetch("/endpoint");
} catch (error: unknown) {
  const message = handleError(error);
  toast.error(message);
}
```

#### Pattern 2: Form with Field Errors
```typescript
import { handleError, getValidationErrors } from "../lib/errorHelpers";

try {
  await apiFetch("/submit", { method: "POST", body: JSON.stringify(data) });
} catch (error: unknown) {
  const fieldErrors = getValidationErrors(error);
  if (fieldErrors) {
    Object.entries(fieldErrors).forEach(([field, msg]) => {
      setFieldError(field, msg);
    });
  } else {
    toast.error(handleError(error));
  }
}
```

#### Pattern 3: Authentication Error Handling
```typescript
import { ApiError } from "../lib/api";
import { handleError } from "../lib/errorHelpers";

try {
  await apiFetch("/protected");
} catch (error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    // Redirect to login for auth errors
    navigate("/login");
  } else {
    toast.error(handleError(error));
  }
}
```

#### Pattern 4: Loading States with Error Handling
```typescript
import { handleError } from "../lib/errorHelpers";

async function loadData() {
  setIsLoading(true);
  setError(null);
  try {
    const data = await apiFetch<Data>("/data");
    setData(data);
  } catch (error: unknown) {
    setError(handleError(error));
  } finally {
    setIsLoading(false);
  }
}
```

## Component Review Template

Copy this template and use it to review each component:

```typescript
// COMPONENT REVIEW: [ComponentName]

// 1. Imports
import { handleError, getValidationErrors } from "../lib/errorHelpers";
// ✅ Has error handling imports

// 2. Error State
const [formError, setFormError] = useState<string | null>(null);
// ✅ Error stored as plain string, not raw error object

// 3. Error Display
setFormError(handleError(error));
// ✅ Uses handleError() to transform before display

// 4. Form Errors (if applicable)
const fieldErrors = getValidationErrors(error);
if (fieldErrors) {
  Object.entries(fieldErrors).forEach(([field, msg]) => {
    setFieldError(field, msg);
  });
}
// ✅ Uses getValidationErrors() for form handling

// 5. Development Logging (if needed)
if (import.meta.env.DEV) {
  console.error("Debug context:", { endpoint, method });
}
// ✅ Only logs in development mode

// 6. No Sensitive Exposure
// ✅ No JSON.stringify(error)
// ✅ No error.stack
// ✅ No error.message displayed directly
// ✅ No error.detail
// ✅ No raw API responses
```

## Files to Review

Priority order for error handling audit:

### High Priority (Authentication, Sensitive Operations)
- [x] `src/features/auth/screens/PhoneNumberEntryScreen.tsx`
- [x] `src/features/auth/screens/OTPVerificationScreen.tsx`
- [x] `src/features/auth/screens/TrustedContactsScreen.tsx`
- [x] `src/features/dashboard/screens/HomeScreen.tsx` (SOS activation)

### Medium Priority (Data Operations)
- [ ] `src/features/session/screens/CreateSessionScreen.tsx`
- [ ] `src/features/session/screens/ActiveSessionScreen.tsx`
- [ ] `src/features/contacts/screens/ContactsManagerScreen.tsx`
- [ ] `src/features/alerts/screens/EmergencyAlertsScreen.tsx`

### Low Priority (Display-Only)
- [ ] `src/features/alert/screens/LiveLocationScreen.tsx`
- [ ] `src/features/session/screens/SessionHistoryScreen.tsx`

## Automated Checks

Run these searches to find potential issues:

### Find all console.error calls
```bash
cd frontend
grep -r "console\.error" src/ --include="*.tsx" --include="*.ts"
```

**Expected result:** Only development-guarded or internal lib errors
```typescript
if (import.meta.env.DEV) {
  console.error(...);
}
```

### Find direct error message displays
```bash
grep -r "error\.message" src/ --include="*.tsx"
```

**Expected result:** Should only appear in error handlers, not in UI display
```typescript
// Good - in error handler
const msg = handleError(error);

// Bad - displayed to user
toast.error(error.message);
```

### Find JSON.stringify of errors
```bash
grep -r "JSON\.stringify(error)" src/ --include="*.tsx"
```

**Expected result:** None found (all should use handleError())

### Find setError/setErrorMsg patterns
```bash
grep -r "setError.*error\." src/ --include="*.tsx"
```

**Check each result** to ensure it's using `handleError()` transformation

## Testing Error Handling

### Unit Test Template

```typescript
import { handleError, getValidationErrors } from "../lib/errorHelpers";
import { ApiError } from "../lib/api";

describe("Error Handling", () => {
  it("should show friendly message, not raw error", () => {
    const apiError = new ApiError({
      type: "http",
      status: 422,
      message: "Validation error",
      url: "http://api/endpoint",
      endpoint: "/endpoint",
      detail: [{
        loc: ["body", "phone_number"],
        msg: "invalid format"
      }]
    });

    const userMessage = handleError(apiError);
    
    // ✅ User sees friendly message
    expect(userMessage).toMatch(/phone number/i);
    
    // ✅ User does NOT see:
    expect(userMessage).not.toMatch(/invalid format/);
    expect(userMessage).not.toMatch(/constraint/);
  });

  it("should not expose database errors", () => {
    const apiError = new ApiError({
      type: "http",
      status: 409,
      message: "Duplicate key value violates unique constraint",
      url: "http://api/contacts",
      endpoint: "/contacts",
      detail: "uq_active_user_id_phone"
    });

    const userMessage = handleError(apiError);
    
    // ✅ User sees generic/context-aware message
    expect(userMessage).toMatch(/already/i);
    
    // ✅ User does NOT see constraint name
    expect(userMessage).not.toMatch(/uq_active/);
    expect(userMessage).not.toMatch(/constraint/);
  });

  it("should extract validation errors for forms", () => {
    const apiError = new ApiError({
      type: "http",
      status: 422,
      message: "Validation error",
      url: "http://api/endpoint",
      endpoint: "/endpoint",
      detail: [
        { loc: ["body", "name"], msg: "must be >= 2 characters" },
        { loc: ["body", "phone"], msg: "invalid format" }
      ]
    });

    const fieldErrors = getValidationErrors(apiError);
    
    expect(fieldErrors).toHaveProperty("name");
    expect(fieldErrors).toHaveProperty("phone");
  });
});
```

## Production Deployment Verification

Before deploying to production:

- [ ] Run audit across all components: `grep -r "error\.message\|error\.stack\|JSON\.stringify(error)" src/`
- [ ] Verify no `console.error` calls without `if (import.meta.env.DEV)` guard
- [ ] Test in production build locally: `npm run build && npm run preview`
- [ ] Open DevTools Console and verify no error details leak during normal operations
- [ ] Trigger various error scenarios (network, validation, auth) and verify user messages
- [ ] Verify error logging integrations (Sentry, DataDog, etc.) still work

## Questions & Answers

**Q: Should I remove all console.error calls?**
A: No. Use them for debugging, but guard them with `if (import.meta.env.DEV)` so they don't run in production.

**Q: Can I show error details to specific users?**
A: Only in development mode. Use `if (import.meta.env.DEV)` guards.

**Q: What if I need stack traces for debugging?**
A: They're automatically captured in `console.error` by `logApiFailure()` (dev only) or sent to monitoring services.

**Q: How do I test that errors are hidden properly?**
A: Build production bundle (`npm run build`) and preview it (`npm run preview`), then trigger errors and check DevTools Console.

**Q: What about custom error messages for specific users?**
A: Implement error categorization based on user role using the `ErrorContext` in `errorHelpers.ts`.
