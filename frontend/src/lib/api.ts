export const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

export type ApiErrorType = "network" | "cors" | "http" | "parse" | "unknown";

export class ApiError extends Error {
  type: ApiErrorType;
  url: string;
  endpoint: string;
  status?: number;
  detail?: string | Record<string, unknown>;
  raw?: unknown;

  constructor(opts: {
    message: string;
    type: ApiErrorType;
    url: string;
    endpoint: string;
    status?: number;
    detail?: string | Record<string, unknown>;
    raw?: unknown;
    cause?: unknown;
  }) {
    super(opts.message);
    this.name = "ApiError";
    this.type = opts.type;
    this.url = opts.url;
    this.endpoint = opts.endpoint;
    this.status = opts.status;
    this.detail = opts.detail;
    this.raw = opts.raw;
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

function logApiFailure(error: ApiError): void {
  console.error("[useAnchor API]", {
    type: error.type,
    message: error.message,
    url: error.url,
    endpoint: error.endpoint,
    status: error.status,
    detail: error.detail,
    frontendOrigin: window.location.origin,
    apiBase: API_URL,
    cause: error.raw ?? (error as Error & { cause?: unknown }).cause,
  });
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  const token = getAuthToken();

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let response: Response;

  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err) {
    const crossOrigin = isCrossOriginRequest(url);
    const apiError = new ApiError({
      type: crossOrigin ? "cors" : "network",
      message: crossOrigin
        ? `Cannot reach API at ${API_URL}. The server may be down, not deployed, or blocking CORS. Frontend origin: ${window.location.origin}. For local dev use VITE_API_URL=http://127.0.0.1:8000/api with backend2 running.`
        : `Network error — could not reach ${url}. Is backend2 running? (uvicorn main:app --reload)`,
      url,
      endpoint,
      raw: err,
      cause: err,
    });
    logApiFailure(apiError);
    throw apiError;
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  let data: Record<string, unknown> | null = null;
  try {
    data = await response.json();
  } catch (err) {
    if (!response.ok) {
      const apiError = new ApiError({
        type: "http",
        message: `HTTP ${response.status}: ${response.statusText || "Request failed"}`,
        url,
        endpoint,
        status: response.status,
        detail: response.statusText,
        raw: err,
        cause: err,
      });
      logApiFailure(apiError);
      throw apiError;
    }

    const apiError = new ApiError({
      type: "parse",
      message: `Server returned non-JSON response from ${endpoint}`,
      url,
      endpoint,
      status: response.status,
      raw: err,
      cause: err,
    });
    logApiFailure(apiError);
    throw apiError;
  }

  if (!response.ok) {
    const detail =
      typeof data?.detail === "string"
        ? data.detail
        : Array.isArray(data?.detail)
          ? (data.detail as Array<{ msg?: string }>).map((d) => d.msg).filter(Boolean).join("; ")
          : response.statusText;

    const apiError = new ApiError({
      type: "http",
      message: detail || `HTTP ${response.status}: Request failed`,
      url,
      endpoint,
      status: response.status,
      detail: data?.detail as string | Record<string, unknown> | undefined,
      raw: data,
    });
    logApiFailure(apiError);
    throw apiError;
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
        newObj[key] = forceUTC((obj as Record<string, unknown>)[key]);
      }
      return newObj;
    }
    return obj;
  };

  return forceUTC(data) as T;
}
