/**
 * Password-checked admin login (AI-OS-BE, `POST /api/core/auth/admin-login`).
 * This is a separate endpoint from the rest of the platform's email-only
 * login (`POST /api/core/auth/login`, still used by
 * IndustryAI-Insaurance-ES-Brokers for junior/senior/admin alike) — only
 * `Role.ADMIN` users can ever succeed here, and only with the right
 * password, since this whole app is the internal admin surface and nothing
 * else should be able to sign into it.
 */
import { apiFetch } from "./client";
import { setIdentity, type Identity } from "./identity";

interface LoginResponse {
  tenant_id: string;
  user_id: string;
  email: string;
  name: string | null;
  role: string;
  vertical: string;
}

export async function login(email: string, password: string): Promise<Identity> {
  const res = await apiFetch<LoginResponse>("/api/core/auth/admin-login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const identity: Identity = {
    tenantId: res.tenant_id,
    userId: res.user_id,
    email: res.email,
    name: res.name,
    role: res.role,
    vertical: res.vertical,
  };
  setIdentity(identity);
  return identity;
}

export { getIdentity, clearIdentity, type Identity } from "./identity";
