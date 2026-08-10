import { useEffect, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function InlineEditField({
  value,
  display,
  onSave,
  validate,
  pending,
  inputMode = "text",
  label,
  className,
}: {
  value: string;
  display?: string;
  onSave: (next: string) => void;
  validate?: (next: string) => string | null;
  pending?: boolean;
  inputMode?: "text" | "decimal";
  label: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  if (!editing) {
    return (
      <div className={cn("flex items-center justify-between gap-3", className)}>
        <span className={cn(inputMode === "decimal" && "numeric", "text-sm text-foreground")}>
          {display ?? value}
        </span>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setEditing(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
        >
          <Pencil className="size-3" />
          Edit
        </button>
      </div>
    );
  }

  const commit = () => {
    const message = validate?.(draft) ?? null;
    setError(message);
    if (message) return;
    onSave(draft.trim());
    setEditing(false);
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-2">
        <Input
          aria-label={label}
          autoFocus
          value={draft}
          inputMode={inputMode}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
            if (event.key === "Escape") {
              setEditing(false);
              setError(null);
            }
          }}
          className={cn(
            "h-8 bg-background text-sm",
            inputMode === "decimal" && "numeric",
            error && "border-destructive",
          )}
        />
        <button
          type="button"
          onClick={commit}
          disabled={pending}
          aria-label="Save"
          className="inline-flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Check className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setError(null);
            setDraft(value);
          }}
          aria-label="Cancel"
          className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-surface"
        >
          <X className="size-4" />
        </button>
      </div>
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
