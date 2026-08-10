/**
 * Single fetch wrapper for calls to AI-OS-BE. Every real API call goes through
 * this — nothing else in the app calls fetch() against the backend directly.
 * Runs entirely in the browser (no TanStack Start server function involved) —
 * the backend's Phase-0 header-stub auth isn't a secret worth hiding behind a
 * server hop, and this is the same approach already proven in
 * IndustryAI-Insaurance-ES-Brokers.
 *
 * Attaches the Phase-0 header-stub auth (x-tenant-id / x-user-id / x-role —
 * see AI-OS-BE/src/core/tenancy/dependencies.py) and normalizes FastAPI's
 * `{"detail": ...}` error responses into a plain Error.
 *
 * Headers come from whoever is logged in this tab/window (see identity.ts,
 * sessionStorage-backed) — read fresh on every call, not computed once at
 * module load, so switching identity takes effect immediately without a
 * reload.
 */
import { getIdentity } from "./identity";

const API_BASE_URL = import.meta.env["VITE_API_BASE_URL"] as string | undefined;

function authHeaders(): Record<string, string> {
  const identity = getIdentity();
  const headers: Record<string, string> = {};
  if (identity?.tenantId) headers["x-tenant-id"] = identity.tenantId;
  if (identity?.userId) headers["x-user-id"] = identity.userId;
  if (identity?.role) headers["x-role"] = identity.role;
  return headers;
}

async function parseErrorDetail(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json();
    if (
      body &&
      typeof body === "object" &&
      "detail" in body &&
      typeof (body as { detail: unknown }).detail === "string"
    ) {
      return (body as { detail: string }).detail;
    }
  } catch {
    // response wasn't JSON — fall through to the status-based message
  }
  return `Request failed (${res.status} ${res.statusText})`;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error("VITE_API_BASE_URL is not set — see .env.local");
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      // No-op against a plain localhost backend; matters only if this ever
      // points at a free ngrok tunnel (see ES-Brokers's client.ts for why).
      "ngrok-skip-browser-warning": "true",
      ...authHeaders(),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (!res.ok) {
    throw new Error(await parseErrorDetail(res));
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, {
      method: "POST",
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, {
      method: "PATCH",
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
};
