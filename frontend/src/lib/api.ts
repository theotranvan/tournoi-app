import { getApiUrl } from "@/lib/capacitor";

const API_URL = getApiUrl();

interface FetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  params?: Record<string, string>;
}

class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
    public errors?: Record<string, string[]>
  ) {
    super(detail);
    this.name = "ApiError";
  }
}

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  // Mutex: if a refresh is already in progress, wait for it
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refresh = localStorage.getItem("refresh_token");
    if (!refresh) return null;

    try {
      const res = await fetch(`${API_URL}/auth/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });

      if (!res.ok) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        return null;
      }

      const data = await res.json();
      localStorage.setItem("access_token", data.access);
      if (data.refresh) {
        localStorage.setItem("refresh_token", data.refresh);
      }
      return data.access as string;
    } catch {
      return null;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { body, params, headers: customHeaders, ...rest } = options;

  const url = new URL(`${API_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(customHeaders as Record<string, string>),
  };

  const token = getAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const serializedBody = isFormData
    ? (body as FormData)
    : body != null
      ? JSON.stringify(body)
      : undefined;

  let res = await fetch(url.toString(), {
    ...rest,
    headers,
    body: serializedBody,
  });

  // Auto-refresh on 401 or 403 (token expired or missing)
  if ((res.status === 401 || res.status === 403) && typeof window !== "undefined") {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(url.toString(), {
        ...rest,
        headers,
        body: serializedBody,
      });
    } else if (res.status === 401 || res.status === 403) {
      // Redirect to login if refresh failed
      if (window.location.pathname !== "/admin/login") {
        window.location.href = "/admin/login";
      }
    }
  }

  if (!res.ok) {
    let detail = "Une erreur est survenue";
    let errors: Record<string, string[]> | undefined;
    try {
      const err = await res.json();
      detail = err.detail ?? err.message ?? detail;
      errors = err.errors;
    } catch {
      // non-JSON error
    }
    throw new ApiError(res.status, detail, errors);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// Convenience methods
const api = {
  get: <T = unknown>(path: string, params?: Record<string, string>) =>
    apiFetch<T>(path, { method: "GET", params }),

  post: <T = unknown>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "POST", body }),

  put: <T = unknown>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "PUT", body }),

  patch: <T = unknown>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "PATCH", body }),

  delete: <T = unknown>(path: string) =>
    apiFetch<T>(path, { method: "DELETE" }),
};

export { api, apiFetch, ApiError, API_URL };
