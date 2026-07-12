const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

function getAuthToken(): string | null {
  return localStorage.getItem("useanchor_access_token");
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  const token = getAuthToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

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

  return data as T;
}
