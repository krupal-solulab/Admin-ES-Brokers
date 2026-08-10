import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getTenant, updateTenant } from "@/lib/api/admin";
import { PageHeader } from "@/components/admin/page-header";
import { ErrorState, LoadingState } from "@/components/admin/states";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { currencyFormatter } from "@/lib/admin-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/admin/tenant")({
  head: () => ({
    meta: [
      { title: "Tenant Settings — Coverline OS Admin" },
      {
        name: "description",
        content: "Edit the firm name and the per-tenant junior premium cap.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TenantScreen,
});

function TenantScreen() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin", "tenant"], queryFn: getTenant });
  const tenant = query.data ?? null;

  const [name, setName] = useState("");
  const [cap, setCap] = useState("");
  const [capError, setCapError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (tenant) {
      setName(tenant.name);
      setCap(tenant.junior_premium_cap != null ? String(tenant.junior_premium_cap) : "");
    }
  }, [tenant]);

  const currentCapNumber = tenant?.junior_premium_cap ?? null;
  const dirty = Boolean(
    tenant && (name !== tenant.name || Number(cap || 0) !== Number(currentCapNumber ?? 0)),
  );

  const mutation = useMutation({
    mutationFn: () => updateTenant({ name: name.trim(), junior_premium_cap: Number(cap) }),
    onSuccess: async () => {
      toast.success("Tenant saved");
      setConfirming(false);
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (error) => {
      setConfirming(false);
      toast.error(error instanceof Error ? error.message : "Save failed");
    },
  });

  const attemptSave = () => {
    if (!/^\d+(\.\d{1,2})?$/.test(cap.trim())) {
      setCapError("Enter a positive amount, e.g. 75000.");
      return;
    }
    if (name.trim().length < 2) {
      setCapError(null);
      toast.error("Firm name must be at least 2 characters.");
      return;
    }
    setCapError(null);
    setConfirming(true);
  };

  return (
    <>
      <PageHeader
        eyebrow="AP-02"
        title="Tenant Settings"
        description="This is the firm record every workflow is scoped to. The junior premium cap drives real approval behaviour — it takes precedence over the global Platform Settings default."
      />

      {query.isPending ? <LoadingState label="Loading tenant" /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}

      {tenant ? (
        <section className="panel divide-y divide-border">
          <div className="grid gap-2 px-6 py-5 md:grid-cols-[220px_1fr] md:items-center">
            <p className="label-caps">Tenant ID</p>
            <p className="numeric text-xs text-muted-foreground">{tenant.id}</p>
          </div>

          <div className="grid gap-2 px-6 py-5 md:grid-cols-[220px_1fr] md:items-center">
            <Label htmlFor="tenant-name" className="label-caps">
              Firm name
            </Label>
            <Input
              id="tenant-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="max-w-md bg-background"
            />
          </div>

          <div className="grid gap-2 px-6 py-5 md:grid-cols-[220px_1fr] md:items-center">
            <p className="label-caps">Vertical</p>
            <p className="numeric text-sm text-muted-foreground">{tenant.vertical}</p>
          </div>

          <div className="grid gap-2 px-6 py-5 md:grid-cols-[220px_1fr] md:items-start">
            <Label htmlFor="tenant-cap" className="label-caps">
              junior_premium_cap
            </Label>
            <div className="max-w-md space-y-1.5">
              <Input
                id="tenant-cap"
                inputMode="decimal"
                value={cap}
                placeholder="unset — falls back to Platform Settings"
                onChange={(event) => setCap(event.target.value)}
                className="numeric bg-background"
              />
              <p className="text-xs text-muted-foreground">
                {currentCapNumber != null
                  ? `Currently ${currencyFormatter.format(currentCapNumber)}, overriding the global default.`
                  : "Currently unset — this tenant falls back to Platform Settings' junior_premium_cap."}{" "}
                Read by the approval check on every submission a junior sends.
              </p>
              {capError ? <p className="text-xs font-medium text-destructive">{capError}</p> : null}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 px-6 py-4">
            <Button
              variant="outline"
              disabled={!dirty}
              onClick={() => {
                setName(tenant.name);
                setCap(tenant.junior_premium_cap != null ? String(tenant.junior_premium_cap) : "");
                setCapError(null);
              }}
            >
              Cancel
            </Button>
            <Button disabled={!dirty || mutation.isPending} onClick={attemptSave}>
              Save changes
            </Button>
          </div>
        </section>
      ) : null}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Save tenant changes?"
        confirmLabel="Save changes"
        pending={mutation.isPending}
        description={
          <>
            <p>
              Firm name becomes <span className="font-semibold text-foreground">{name}</span> and
              the junior premium cap becomes{" "}
              <span className="numeric font-semibold text-foreground">
                {currencyFormatter.format(Number(cap) || 0)}
              </span>
              .
            </p>
            <p>The cap change alters what juniors can approve on their next submission.</p>
          </>
        }
        onConfirm={() => mutation.mutate()}
      />
    </>
  );
}
