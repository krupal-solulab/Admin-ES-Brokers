import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { clearSetting, listSettings, saveSetting, type SettingOut } from "@/lib/api/admin";
import { PageHeader } from "@/components/admin/page-header";
import { ErrorState, LoadingState } from "@/components/admin/states";
import { StatusPill } from "@/components/admin/status-pill";
import { InlineEditField } from "@/components/admin/inline-edit-field";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { formatSettingValue, getSettingType, validateSettingValue } from "@/lib/admin-settings";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({
    meta: [
      { title: "Platform Settings — Coverline OS Admin" },
      {
        name: "description",
        content:
          "Six live platform tunables with their default value, current value, and override provenance.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsScreen,
});

function SettingsScreen() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin", "settings"], queryFn: listSettings });
  const [reverting, setReverting] = useState<SettingOut | null>(null);

  const saveMutation = useMutation({
    mutationFn: (input: { key: string; value: string }) => saveSetting(input.key, input.value),
    onSuccess: async () => {
      toast.success("Setting saved — used by the next workflow run, no restart.");
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Save failed"),
  });

  const clearMutation = useMutation({
    mutationFn: (key: string) => clearSetting(key),
    onSuccess: async () => {
      toast.success("Reverted to the environment default.");
      setReverting(null);
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (error) => {
      setReverting(null);
      toast.error(error instanceof Error ? error.message : "Revert failed");
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="AP-04"
        title="Platform Settings"
        description="Each row shows the default, the value in force, and where that value came from. Saving takes effect on the next workflow run — no redeploy."
      />

      {query.isPending ? <LoadingState label="Loading settings" /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}

      {query.data ? (
        <div className="panel divide-y divide-border">
          {query.data.map((row) => {
            const typeDef = getSettingType(row.key);
            const sourceLabel = row.source === "admin_override" ? "admin override" : "env default";
            return (
              <article key={row.key} className="grid gap-4 px-6 py-5 lg:grid-cols-[1fr_320px]">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="numeric text-sm font-semibold">{row.label}</h2>
                    <StatusPill status={row.source} label={sourceLabel} />
                  </div>
                  <p className="text-sm text-muted-foreground">{row.description}</p>
                  <p className="numeric text-xs text-muted-foreground">
                    default {formatSettingValue(typeDef.type, row.env_default)}
                    {row.updated_at
                      ? ` · overridden ${new Date(row.updated_at).toLocaleString()}${
                          row.updated_by ? ` by ${row.updated_by}` : ""
                        }`
                      : ""}
                  </p>
                  {row.source === "admin_override" ? (
                    <button
                      type="button"
                      onClick={() => setReverting(row)}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Revert to default
                    </button>
                  ) : null}
                </div>

                <div className="lg:pt-1">
                  {typeDef.type === "enum" ? (
                    <Select
                      value={row.value}
                      onValueChange={(value) => saveMutation.mutate({ key: row.key, value })}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {typeDef.options?.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <InlineEditField
                      label={row.label}
                      value={row.value}
                      display={formatSettingValue(typeDef.type, row.value)}
                      inputMode={typeDef.type === "text" ? "text" : "decimal"}
                      validate={(next) => validateSettingValue(typeDef, next)}
                      pending={saveMutation.isPending}
                      onSave={(next) => saveMutation.mutate({ key: row.key, value: next })}
                    />
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(reverting)}
        onOpenChange={(open) => {
          if (!open) setReverting(null);
        }}
        title="Revert to the environment default?"
        confirmLabel="Revert"
        pending={clearMutation.isPending}
        description={
          reverting ? (
            <>
              <p>
                <span className="numeric font-semibold text-foreground">{reverting.key}</span> goes
                back to{" "}
                <span className="numeric font-semibold text-foreground">
                  {reverting.env_default}
                </span>
                .
              </p>
              <p>The override is deleted and the change is recorded in the audit log.</p>
            </>
          ) : null
        }
        onConfirm={() => reverting && clearMutation.mutate(reverting.key)}
      />
    </>
  );
}
