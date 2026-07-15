# Error Handling Quick Reference

For developers implementing error handling in components.

## Import

```typescript
import { 
  handleError,           // Main error handler - use this!
  getValidationErrors,   // Extract form field errors
  ErrorCategory          // Type for error categorization
} from "../lib/errorHelpers";
```

## Basic Usage

### Display Error Toast

```typescript
try {
  await apiFetch("/endpoint");
} catch (error: unknown) {
  const message = handleError(error);
  toast.error(message);
}
```

### Extract Form Errors

```typescript
try {
  await apiFetch("/submit", { method: "POST", body: JSON.stringify(data) });
} catch (error: unknown) {
  const fieldErrors = getValidationErrors(error);
  if (fieldErrors) {
    // { phone_number: "Invalid format", name: "Too short" }
    Object.entries(fieldErrors).forEach(([field, msg]) => {
      setFieldError(field, msg);
    });
  } else {
    toast.error(handleError(error));
  }
}
```

### Authentication Error Handling

```typescript
try {
  await apiFetch("/protected");
} catch (error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    // Session expired - redirect to login
    navigate("/login");
  } else {
    toast.error(handleError(error));
  }
}
```

## Error Messages by Category

| Category | Message | When |
|----------|---------|------|
| `validation` | Field-specific guidance | Input fails validation |
| `auth` | "Your session has expired..." | 401/403 status |
| `network` | "Unable to connect..." | No connectivity |
| `server` | "Server unavailable..." | 5xx errors |
| `client` | "Action couldn't be completed..." | 4xx (non-auth) |
| `timeout` | "Request took too long..." | Timeout |
| `parse` | "Unexpected response..." | Invalid JSON |

## What NOT to Do

```typescript
// ❌ BAD
toast.error(error.message);
toast.error(JSON.stringify(error));
<div>{error.stack}</div>

// ✅ GOOD
const message = handleError(error);
toast.error(message);
```

## Development Debugging

In development, `handleError()` automatically logs full technical details:

```javascript
[useAnchor Error] 2026-07-15T10:30:45.123Z VALIDATION
Category: validation
Endpoint: /contacts
Status: 422
API Error Details: { ... }
Stack Trace: ...
```

## Real-World Examples

### Phone Number Entry Form

```typescript
try {
  await apiFetch("/verify-phone", {
    method: "POST",
    body: JSON.stringify({ phone })
  });
} catch (error: unknown) {
  // User sees: "Please enter a valid phone number..."
  // Dev console shows: Full validation details
  toast.error(handleError(error));
}
```

### Trusted Contacts Addition

```typescript
try {
  await apiFetch("/contacts", {
    method: "POST",
    body: JSON.stringify({ name, phone })
  });
} catch (error: unknown) {
  if (error instanceof ApiError && error.status === 409) {
    // Conflict - contact already exists
    toast.error("This contact is already in your trusted circle.");
  } else {
    toast.error(handleError(error));
  }
}
```

### Failover-Protected Session Creation

```typescript
try {
  // Automatically retries on secondary backend if primary fails
  const session = await apiFetch("/sessions", {
    method: "POST",
    body: JSON.stringify(sessionData)
  });
} catch (error: unknown) {
  // If both backends fail:
  // User sees: "The server is temporarily unavailable..."
  // Dev console shows: Both failed URLs, failover attempts
  toast.error(handleError(error));
}
```

## For Testing

When writing tests, verify that **users see friendly messages, not technical details**:

```typescript
test("shows friendly message on form validation error", () => {
  // Mock validation error
  mockApiFetch.mockRejectedValueOnce(
    new ApiError({ /* ... */ })
  );
  
  // Verify user-friendly message
  expect(screen.getByText(/check your input/i)).toBeInTheDocument();
  
  // Verify NO technical details
  expect(screen.queryByText(/constraint/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/database/i)).not.toBeInTheDocument();
});
```

## Backward Compatibility

Old code using `getFriendlyErrorMessage()` still works:

```typescript
// Still works, but maps to new system
const msg = getFriendlyErrorMessage(error, "Failed");

// Recommended: Use handleError() instead
const msg = handleError(error);
```

## Tips

1. **Always use `handleError()`** for user-facing errors
2. **Use `getValidationErrors()`** for form-specific handling
3. **Check `error instanceof ApiError`** for API-specific logic
4. **Let console logging handle debugging** - don't manually log sensitive info
5. **Test with real error responses** from your backend
