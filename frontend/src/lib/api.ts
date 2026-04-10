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
    public errors?: Record<string, string[]>,
    public code?: string
  ) {
    super(detail);
    this.name = "ApiError";
  }
}

// ─── Friendly error mapping ────────────────────────────────────────────────
const FRIENDLY_MESSAGES: Record<string, string> = {
  permission_denied:
    "Vous avez atteint la limite de votre forfait gratuit. Passez au Pro pour créer davantage de tournois 🚀",
  authentication_failed:
    "Session expirée — veuillez vous reconnecter.",
  not_authenticated:
    "Session expirée — veuillez vous reconnecter.",
  token_not_valid:
    "Session expirée — veuillez vous reconnecter.",
  throttled:
    "Trop de requêtes. Patientez quelques instants avant de réessayer.",
  not_found:
    "La ressource demandée n'existe pas ou a été supprimée.",
  schedule_generation_failed:
    "Impossible de régénérer le planning pour l'instant. Vérifiez que toutes les catégories ont une durée de match configurée.",
};

const FRIENDLY_STATUS: Record<number, string> = {
  400: "Données invalides. Vérifiez les champs du formulaire.",
  403: "Vous n'avez pas les droits pour effectuer cette action.",
  404: "La ressource demandée n'existe pas.",
  409: "Un conflit a été détecté. Rechargez la page et réessayez.",
  429: "Trop de requêtes. Patientez quelques instants.",
  500: "Erreur serveur. Réessayez dans quelques instants.",
  502: "Serveur temporairement indisponible. Réessayez dans quelques instants.",
  503: "Service en maintenance. Réessayez dans quelques instants.",
  0: "Impossible de contacter le serveur. Vérifiez votre connexion internet.",
};

/**
 * Returns a user-friendly error message from any error.
 * Maps backend error codes and HTTP statuses to French messages.
 */
export function friendlyError(
  error: unknown,
  fallback = "Une erreur est survenue."
): string {
  if (error instanceof ApiError) {
    // Try code-based mapping first
    if (error.code && FRIENDLY_MESSAGES[error.code]) {
      return FRIENDLY_MESSAGES[error.code];
    }
    // Try detail-based mapping (some backends return code as detail)
    const detailKey = error.detail?.toLowerCase().replace(/[\s.]/g, "_");
    if (detailKey && FRIENDLY_MESSAGES[detailKey]) {
      return FRIENDLY_MESSAGES[detailKey];
    }
    // Try status-based mapping
    if (FRIENDLY_STATUS[error.status]) {
      return FRIENDLY_STATUS[error.status];
    }
    return error.detail || fallback;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

/** @deprecated Use friendlyError() instead */
export function getApiErrorMessage(
  error: unknown,
  fallback = "Une erreur est survenue."
): string {
  return friendlyError(error, fallback);
}

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

function buildApiUrl(path: string): URL {
  const baseOrigin = typeof window !== "undefined" ? window.location.origin : "http://localhost";
  const apiBase = API_URL.endsWith("/") ? API_URL : `${API_URL}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  const url = new URL(normalizedPath, new URL(apiBase, baseOrigin));

  // Django expects APPEND_SLASH-compatible endpoints, force a trailing slash.
  if (!url.pathname.endsWith("/")) {
    url.pathname = `${url.pathname}/`;
  }

  return url;
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

  const url = buildApiUrl(path);
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

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      ...rest,
      headers,
      body: serializedBody,
    });
  } catch (networkErr) {
    throw new ApiError(0, `Erreur réseau — impossible de contacter le serveur (${url.toString()})`);
  }

  // Auto-refresh on 401 (token expired) — NOT 403 (permission denied)
  if (res.status === 401 && typeof window !== "undefined") {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(url.toString(), {
        ...rest,
        headers,
        body: serializedBody,
      });
    }
    // If still 401 after refresh, throw — let the UI (layout / query provider) handle it.
    // NEVER hard-redirect here: it wipes React state and causes "tournament disappeared" bugs.
  }

  if (!res.ok) {
    let detail = `Erreur ${res.status}`;
    let errors: Record<string, string[]> | undefined;
    let code: string | undefined;
    try {
      const err = await res.json();
      detail = err.detail ?? err.error ?? err.message ?? detail;
      errors = err.errors ?? err.details;
      code = err.code;
    } catch {
      // non-JSON error — try reading as text for debugging
      try {
        const text = await res.text();
        if (text) detail = `Erreur ${res.status}: ${text.slice(0, 200)}`;
      } catch {
        // completely opaque response (likely CORS)
        detail = `Erreur ${res.status} (réponse bloquée — vérifier CORS)`;
      }
    }
    throw new ApiError(res.status, detail, errors, code);
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json() as T;

  // Cache successful GET responses for public/match routes in localStorage
  if (
    typeof window !== "undefined" &&
    (!options.method || options.method === "GET") &&
    (path.startsWith("/public/") || path.includes("/matches"))
  ) {
    try {
      const cacheKey = `offline:${path}${params ? "?" + new URLSearchParams(params).toString() : ""}`;
      localStorage.setItem(cacheKey, JSON.stringify(data));
    } catch {
      // localStorage full — ignore
    }
  }

  return data;
}

function getOfflineCache<T>(path: string, params?: Record<string, string>): T | null {
  if (typeof window === "undefined") return null;
  try {
    const cacheKey = `offline:${path}${params ? "?" + new URLSearchParams(params).toString() : ""}`;
    const cached = localStorage.getItem(cacheKey);
    return cached ? (JSON.parse(cached) as T) : null;
  } catch {
    return null;
  }
}

// Convenience methods
const api = {
  get: async <T = unknown>(path: string, params?: Record<string, string>): Promise<T> => {
    try {
      return await apiFetch<T>(path, { method: "GET", params });
    } catch (err) {
      // On network failure for public/match routes, try localStorage cache
      if (
        (path.startsWith("/public/") || path.includes("/matches")) &&
        !(err instanceof ApiError)
      ) {
        const cached = getOfflineCache<T>(path, params);
        if (cached !== null) return cached;
      }
      throw err;
    }
  },

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
