/**
 * Client-side metadata for the six admin-editable platform settings (PRD
 * §5.4) that the real backend (AI-OS-BE's core/admin/service.py) can't send
 * over the wire: what kind of input control each one needs. Everything else
 * — label, description, current value, env default, override provenance —
 * comes live from `GET /api/core/admin/settings` (see lib/api/admin.ts's
 * `SettingOut`). Do not hardcode a label/description/default here again —
 * that's exactly the "guessed value that drifted from the real backend" bug
 * this rewiring fixed (e.g. this file used to claim `connectors_mode`
 * defaulted to "live" with options mock/sandbox/replay; the real backend
 * default is "mock" and the only two real modes are mock/live).
 */

export type SettingType = "currency" | "number" | "integer" | "text" | "enum";

export interface SettingTypeDef {
  key: string;
  type: SettingType;
  options?: string[];
}

export const SETTING_TYPES: SettingTypeDef[] = [
  { key: "junior_premium_cap", type: "currency" },
  { key: "connectors_mode", type: "enum", options: ["mock", "live"] },
  { key: "nango_inbox_query", type: "text" },
  { key: "quote_rank_price_weight", type: "number" },
  { key: "quote_rank_subjectivity_penalty", type: "number" },
  { key: "carrier_appetite_min_total_outcomes", type: "integer" },
];

export function getSettingType(key: string): SettingTypeDef {
  return SETTING_TYPES.find((definition) => definition.key === key) ?? { key, type: "text" };
}

/** Returns an error message, or null when the value is acceptable. Mirrors
 * (but doesn't replace) the real validation in core/admin/service.py's
 * `_validate_setting_value` — this is a client-side nicety, not the source
 * of truth; the backend rejects an invalid value regardless. */
export function validateSettingValue(definition: SettingTypeDef, raw: string): string | null {
  const value = raw.trim();
  if (value === "") return "Value is required.";

  if (definition.type === "enum") {
    return definition.options?.includes(value)
      ? null
      : `Must be one of: ${definition.options?.join(", ")}.`;
  }

  if (definition.type === "text") {
    return value.length <= 240 ? null : "Must be 240 characters or fewer.";
  }

  if (!/^-?\d+(\.\d+)?$/.test(value)) return "Must be a number.";
  const parsed = Number(value);

  if (definition.type === "integer") {
    if (!Number.isInteger(parsed)) return "Must be a whole number.";
    if (parsed < 0) return "Must be zero or greater.";
    return null;
  }

  if (definition.type === "currency") {
    if (parsed < 0) return "Must be zero or greater.";
    if (parsed > 100_000_000) return "Unrealistically large cap.";
    return null;
  }

  if (parsed < 0) return "Must be zero or greater.";
  return null;
}

export const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatSettingValue(type: SettingType, value: string): string {
  if (type === "currency") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? currencyFormatter.format(parsed) : value;
  }
  return value;
}

// Real Nango provider keys (AI-OS-BE core/config.py's nango_integration_*) —
// must match exactly what GET /api/core/integrations/connections returns.
export const CONNECTORS = [
  { id: "google-mail", label: "Gmail", description: "Real inbox access for Market Matching." },
  {
    id: "google-sheet",
    label: "Google Sheets",
    description: "Connect/disconnect only for now — no data is read or written yet.",
  },
  {
    id: "google-drive",
    label: "Google Drive",
    description: "Connect/disconnect only for now — no data is read or written yet.",
  },
  {
    id: "google-calendar",
    label: "Google Calendar",
    description: "Connect/disconnect only for now — no data is read or written yet.",
  },
] as const;

export const WORKFLOWS = [
  "market_matching",
  "package_assembly",
  "agent_communication",
  "quote_comparison",
  "binder_issuance",
  "endorsement",
  "renewal_remarketing",
  "diligent_search",
  "carrier_appetite_intelligence",
  "pipeline_reporting",
] as const;

export const ROLES = ["junior", "senior", "admin"] as const;
export type Role = (typeof ROLES)[number];
