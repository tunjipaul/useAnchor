const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

function getAuthToken(): string | null {
  return localStorage.getItem("useanchor_access_token");
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

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    data = null;
  }

  if (!response.ok) {
    const error = new Error(data?.detail || response.statusText);
    (error as any).status = response.status;
    (error as any).data = data;
    throw error;
  }

  // Recursively add 'Z' to naive datetime strings to force UTC interpretation
  const forceUTC = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') {
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(obj)) {
        return obj + 'Z';
      }
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(forceUTC);
    }
    if (typeof obj === 'object') {
      const newObj: any = {};
      for (const key in obj) {
        newObj[key] = forceUTC(obj[key]);
      }
      return newObj;
    }
    return obj;
  };

  return forceUTC(data) as T;
}
