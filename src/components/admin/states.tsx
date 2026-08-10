import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span className="flex size-10 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground">
        <Inbox className="size-4" />
      </span>
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="panel flex items-center gap-3 px-6 py-12 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin text-primary" />
      {label}…
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return (
    <div className="panel space-y-3 border-destructive/40 px-6 py-8">
      <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
        <AlertTriangle className="size-4" />
        Could not load this view
      </div>
      <p className="numeric text-xs text-muted-foreground">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-surface"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
