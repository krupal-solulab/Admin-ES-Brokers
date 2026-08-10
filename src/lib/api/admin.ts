/**
 * Typed client for AI-OS-BE's Admin Panel API (`/api/core/admin/*`, plus a
 * reuse of `/api/core/integrations/*` for AP-05). Every shape here matches
 * the real backend response models 1:1 (core/admin/schema.py) — nothing here
 * is a guessed/placeholder value the way the original Lovable-generated
 * Supabase layer was.
 */
import { api } from "./client";

export interface TenantOut {
  id: string;
  name: string;
  vertical: string;
  junior_premium_cap: number | null;
}

export interface UserOut {
  id: string;
  email: string;
  name: string | null;
  role: string;
  created_at: string;
}

export interface SettingOut {
  key: string;
  label: string;
  description: string;
  value: string;
  env_default: string;
  source: "env_default" | "admin_override";
  updated_at: string | null;
  updated_by: string | null;
}

export interface ConnectionOut {
  provider: string;
  status: string;
}

export interface AuditEntryOut {
  actor: string;
  who: string;
  what: string;
  workflow: string;
  at: string | null;
  detail: Record<string, unknown>;
}

export interface OverviewOut {
  tenant: TenantOut;
  connections: ConnectionOut[];
  recent_audit: AuditEntryOut[];
}

export const getOverview = () => api.get<OverviewOut>("/api/core/admin/overview");

export const getTenant = () => api.get<TenantOut>("/api/core/admin/tenant");
export const updateTenant = (body: { name?: string | null; junior_premium_cap?: number | null }) =>
  api.patch<TenantOut>("/api/core/admin/tenant", body);

export const listUsers = () => api.get<UserOut[]>("/api/core/admin/users");
export const createUser = (body: { email: string; name?: string | null; role: string }) =>
  api.post<UserOut>("/api/core/admin/users", body);
export const updateUser = (userId: string, body: { role?: string | null; name?: string | null }) =>
  api.patch<UserOut>(`/api/core/admin/users/${userId}`, body);

export const listSettings = () => api.get<SettingOut[]>("/api/core/admin/settings");
export const saveSetting = (key: string, value: string) =>
  api.patch<SettingOut>(`/api/core/admin/settings/${key}`, { value });
export const clearSetting = (key: string) =>
  api.delete<SettingOut>(`/api/core/admin/settings/${key}`);

export const listAudit = (params: { workflow?: string; actor?: string; limit?: number } = {}) => {
  const query = new URLSearchParams();
  if (params.workflow) query.set("workflow", params.workflow);
  if (params.actor) query.set("actor", params.actor);
  query.set("limit", String(params.limit ?? 50));
  return api.get<AuditEntryOut[]>(`/api/core/admin/audit?${query.toString()}`);
};

// AP-05 — pure reuse of the existing, already-real, already-tenant-scoped
// Integrations endpoints (core/integrations/router.py). No admin-specific
// backend route needed for reads; connect/disconnect are the same real Nango
// flow already live in IndustryAI-Insaurance-ES-Brokers's Foundation.tsx.
export const listConnections = () => api.get<ConnectionOut[]>("/api/core/integrations/connections");
export const createConnectSession = (provider: string) =>
  api.post<{ session_token: string; expires_at: string | null }>(
    "/api/core/integrations/connect-session",
    { provider },
  );
export const confirmConnection = (provider: string, nangoConnectionId: string) =>
  api.post<ConnectionOut>("/api/core/integrations/connections", {
    provider,
    nango_connection_id: nangoConnectionId,
  });
export const disconnectIntegration = (provider: string) =>
  api.post<ConnectionOut>(`/api/core/integrations/connections/${provider}/disconnect`);
