# Quick Deployment Reference

## For Vercel Production Deployment

### Step 1: Add Environment Variables to Vercel
Navigate to your Vercel project dashboard:
1. **Settings** → **Environment Variables**
2. Add these variables for **Production**:

```
Name: VITE_PRIMARY_API_URL
Value: https://api.useanchor.com/api
Environments: Production

Name: VITE_SECONDARY_API_URL
Value: https://backup-api.useanchor.com/api
Environments: Production
```

3. Click **Save**
4. Redeploy your application

### Step 2: Verify Configuration
After deployment, open browser DevTools Console and look for:
- `[useAnchor API]` log messages showing both URLs are loaded
- No errors about undefined environment variables

### Environment Variable Naming

The API layer reads these exact environment variable names:
- `VITE_PRIMARY_API_URL` (required, falls back to `http://127.0.0.1:8000/api`)
- `VITE_SECONDARY_API_URL` (optional, leave empty to disable failover)

**Important:** Variable names must start with `VITE_` for Vite to include them in the frontend build.

### Local Development Testing

Edit `.env.development`:
```env
VITE_PRIMARY_API_URL=http://127.0.0.1:8000/api
VITE_SECONDARY_API_URL=http://127.0.0.1:8001/api
```

Then run:
```bash
npm run dev
```

## Backwards Compatibility

Existing code works without changes. The new failover logic is transparent to all React components.

If components were accessing `API_URL` directly, it still works:
- `API_URL` = `PRIMARY_API_URL` (for compatibility)
- Use `PRIMARY_API_URL` / `SECONDARY_API_URL` for new code
- Use `apiFetch()` function (already updated)

## No Code Changes Required

Your existing components work as-is:
```typescript
const data = await apiFetch<T>('/endpoint');
```

Failover happens automatically inside the `apiFetch()` function.
