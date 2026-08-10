import { cn } from "@/lib/utils";

type PillTone = "ok" | "muted" | "info" | "neutral" | "admin";

const TONE_CLASS: Record<PillTone, string> = {
  ok: "border-ok/40 bg-ok/12 text-ok",
  muted: "border-border bg-muted text-muted-foreground",
  info: "border-info/40 bg-info/12 text-info",
  neutral: "border-border bg-secondary text-secondary-foreground",
  admin: "border-admin/40 bg-admin/12 text-admin",
};

const STATUS_TONE: Record<string, PillTone> = {
  connected: "ok",
  disconnected: "muted",
  "env default": "muted",
  "admin override": "info",
  junior: "neutral",
  senior: "neutral",
  admin: "neutral",
  pending: "admin",
};

export function StatusPill({
  status,
  className,
  label,
}: {
  status: string;
  className?: string;
  label?: string;
}) {
  const tone = STATUS_TONE[status] ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide",
        TONE_CLASS[tone],
        className,
      )}
    >
      {tone === "ok" || tone === "info" || tone === "admin" ? (
        <span className="size-1.5 rounded-full bg-current" aria-hidden />
      ) : null}
      {label ?? status}
    </span>
  );
}
