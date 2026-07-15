/**
 * Primary and secondary backend URLs for failover support.
 * Configured via environment variables in Vercel or local .env files.
 * Fallback to localhost for local development.
 * Note: Base URLs should NOT include /api — endpoints will add it explicitly.
 */
export const PRIMARY_API_URL =
  import.meta.env.VITE_PRIMARY_API_URL || "http://127.0.0.1:8000";

export const SECONDARY_API_URL = import.meta.env.VITE_SECONDARY_API_URL || null;

/**
 * Legacy API_URL for backward compatibility.
 * Uses primary URL if available, otherwise uses legacy env var.
 */
export const API_URL = PRIMARY_API_URL;

export type ApiErrorType =
  | "network"
  | "cors"
  | "http"
  | "parse"
  | "unknown"
  | "failover";

export class ApiError extends Error {
  type: ApiErrorType;
  url: string;
  endpoint: string;
  status?: number;
  detail?: string | Record<string, unknown>;
  raw?: unknown;
  failedUrls?: string[];
  isFailoverExhausted?: boolean;

  constructor(opts: {
    message: string;
    type: ApiErrorType;
    url: string;
    endpoint: string;
    status?: number;
    detail?: string | Record<string, unknown>;
    raw?: unknown;
    cause?: unknown;
    failedUrls?: string[];
    isFailoverExhausted?: boolean;
  }) {
    super(opts.message);
    this.name = "ApiError";
    this.type = opts.type;
    this.url = opts.url;
    this.endpoint = opts.endpoint;
    this.status = opts.status;
    this.detail = opts.detail;
    this.raw = opts.raw;
    this.failedUrls = opts.failedUrls;
    this.isFailoverExhausted = opts.isFailoverExhausted;
    if (opts.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = opts.cause;
    }
  }
}

function getAuthToken(): string | null {
  return localStorage.getItem("useanchor_access_token");
}

function isCrossOriginRequest(url: string): boolean {
  try {
    return new URL(url).origin !== window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Development-only logging for API errors.
 * Logs full technical details only in development mode.
 * In production, logs are suppressed to prevent leaking sensitive info to users.
 */
function logApiFailure(error: ApiError): void {
  if (!import.meta.env.DEV) {
    // In production, don't log to console to avoid exposure in browser dev tools
    return;
  }

  // Development logging - full technical details
  console.error("[useAnchor API Error]", {
    type: error.type,
    message: error.message,
    endpoint: error.endpoint,
    url: error.url,
    status: error.status,
    detail: error.detail,
    failedUrls: error.failedUrls,
    isFailoverExhausted: error.isFailoverExhausted,
    frontendOrigin: window.location.origin,
    primaryApi: PRIMARY_API_URL,
    secondaryApi: SECONDARY_API_URL,
    cause: error.raw ?? (error as Error & { cause?: unknown }).cause,
  });
}

/**
 * Logs failover attempts in development.
 * Helps developers understand when and why failover is triggered.
 */
function logFailoverAttempt(context: {
  endpoint: string;
  primaryUrl: string;
  error?: string;
  reason?: string;
}): void {
  if (!import.meta.env.DEV) return;

  console.warn(
    `[useAnchor API] Failover attempt from primary backend`,
    {
      endpoint: context.endpoint,
      primaryUrl: context.primaryUrl,
      reason: context.reason || "Unknown",
      error: context.error,
      timestamp: new Date().toISOString(),
    }
  );
}

/**
 * Determines if an error should trigger failover to secondary backend.
 * Failover occurs on network errors, timeouts, and server errors (502, 503, 504).
 * Client errors (4xx) do not trigger failover.
 */
function shouldFailover(error: ApiError | null, status?: number): boolean {
  // Network/CORS errors trigger failover
  if (error?.type === "network" || error?.type === "cors") {
    return true;
  }

  // Check HTTP status codes
  if (status !== undefined) {
    // Retry on server errors that indicate backend issues
    return status === 502 || status === 503 || status === 504;
  }

  return false;
}

/**
 * Attempts to fetch from a single backend URL.
 * Returns both the response and any error that occurred.
 */
async function attemptFetch(
  url: string,
  endpoint: string,
  headers: Record<string, string>,
  options: RequestInit
): Promise<{ response?: Response; error?: ApiError }> {
  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });
    return { response };
  } catch (err) {
    const crossOrigin = isCrossOriginRequest(url);
    const apiError = new ApiError({
      type: crossOrigin ? "cors" : "network",
      message: crossOrigin
        ? `Cannot reach API at ${url}. The server may be down, not deployed, or blocking CORS. Frontend origin: ${window.location.origin}.`
        : `Network error — could not reach ${url}.`,
      url,
      endpoint,
      raw: err,
      cause: err,
    });
    return { error: apiError };
  }
}

/**
 * Fetches data from the API with automatic failover to secondary backend.
 * 
 * Failover logic:
 * 1. Attempts request to primary backend first
 * 2. If primary fails due to network error, timeout, or 502/503/504, retries on secondary
 * 3. Does NOT retry on client errors (4xx)
 * 4. Preserves all request properties during retry (method, headers, body, auth, params)
 * 
 * @param endpoint - API endpoint path (e.g., "/sessions")
 * @param options - Fetch options (method, body, headers, etc.)
 * @returns Parsed response data
 * @throws ApiError with failover information if both backends fail
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();

  // Build headers once to reuse across failover attempts
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const failedUrls: string[] = [];
  let lastError: ApiError | null = null;
  const backends = [PRIMARY_API_URL, SECONDARY_API_URL].filter(
    (url) => url !== null
  ) as string[];

  // Try each backend in order
  for (const baseUrl of backends) {
    const url = `${baseUrl}${endpoint}`;

    const { response, error } = await attemptFetch(
      url,
      endpoint,
      headers,
      options
    );

    // If fetch succeeded, process the response
    if (response) {
      // Handle 204 No Content
      if (response.status === 204) {
        return {} as T;
      }

      let data: Record<string, unknown> | null = null;
      try {
        data = await response.json();
      } catch (err) {
        if (!response.ok) {
          lastError = new ApiError({
            type: "http",
            message: `HTTP ${response.status}: ${response.statusText || "Request failed"}`,
            url,
            endpoint,
            status: response.status,
            detail: response.statusText,
            raw: err,
            cause: err,
            failedUrls,
          });

          // Check if we should failover for this status code
          if (
            shouldFailover(null, response.status) &&
            baseUrl === backends[0]
          ) {
            failedUrls.push(url);
            continue; // Try next backend
          }

          logApiFailure(lastError);
          throw lastError;
        }

        lastError = new ApiError({
          type: "parse",
          message: `Server returned non-JSON response from ${endpoint}`,
          url,
          endpoint,
          status: response.status,
          raw: err,
          cause: err,
          failedUrls,
        });
        logApiFailure(lastError);
        throw lastError;
      }

      if (!response.ok) {
        const detail =
          typeof data?.detail === "string"
            ? data.detail
            : Array.isArray(data?.detail)
              ? (data.detail as Array<{ msg?: string }>)
                  .map((d) => d.msg)
                  .filter(Boolean)
                  .join("; ")
              : response.statusText;

        lastError = new ApiError({
          type: "http",
          message: detail || `HTTP ${response.status}: Request failed`,
          url,
          endpoint,
          status: response.status,
          detail: data?.detail as
            | string
            | Record<string, unknown>
            | undefined,
          raw: data,
          failedUrls,
        });

        // Check if we should failover for this status code
        if (shouldFailover(null, response.status) && baseUrl === backends[0]) {
          failedUrls.push(url);
          logFailoverAttempt({
            endpoint,
            primaryUrl: baseUrl,
            reason: `Server error ${response.status}`,
          });
          continue; // Try next backend
        }

        logApiFailure(lastError);
        throw lastError;
      }

      // Recursively add 'Z' to naive datetime strings to force UTC interpretation
      const forceUTC = (obj: unknown): unknown => {
        if (obj === null || obj === undefined) return obj;
        if (typeof obj === "string") {
          if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(obj)) {
            return obj + "Z";
          }
          return obj;
        }
        if (Array.isArray(obj)) {
          return obj.map(forceUTC);
        }
        if (typeof obj === "object") {
          const newObj: Record<string, unknown> = {};
          for (const key in obj as Record<string, unknown>) {
            newObj[key] = forceUTC(
              (obj as Record<string, unknown>)[key]
            );
          }
          return newObj;
        }
        return obj;
      };

      return forceUTC(data) as T;
    }

    // Fetch failed with a network/CORS error
    if (error) {
      failedUrls.push(url);
      lastError = error;

      // If this was the primary backend and we should failover, try the next one
      if (shouldFailover(error) && baseUrl === backends[0]) {
        logFailoverAttempt({
          endpoint,
          primaryUrl: baseUrl,
          reason: `${error.type} error`,
          error: error.message,
        });
        continue; // Try next backend
      }

      logApiFailure(error);
      throw error;
    }
  }

  // All backends exhausted
  if (lastError) {
    lastError.failedUrls = failedUrls;
    lastError.isFailoverExhausted = true;
    logApiFailure(lastError);
    throw lastError;
  }

  // Should not reach here, but handle edge case
  const finalError = new ApiError({
    message: `All backends failed for ${endpoint}`,
    type: "failover",
    url: backends[0],
    endpoint,
    failedUrls,
    isFailoverExhausted: true,
  });
  logApiFailure(finalError);
  throw finalError;
}
