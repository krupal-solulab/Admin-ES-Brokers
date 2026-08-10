import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Nango from "@nangohq/frontend";
import { toast } from "sonner";
import {
  confirmConnection,
  createConnectSession,
  disconnectIntegration,
  listConnections,
} from "@/lib/api/admin";
import { PageHeader } from "@/components/admin/page-header";
import { ErrorState, LoadingState } from "@/components/admin/states";
import { StatusPill } from "@/components/admin/status-pill";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { CONNECTORS } from "@/lib/admin-settings";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/integrations")({
  head: () => ({
    meta: [
      { title: "Integrations — Coverline OS Admin" },
      {
        name: "description",
        content: "Connector status per tenant, with connect and disconnect controls.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: IntegrationsScreen,
});

type ConnectorId = (typeof CONNECTORS)[number]["id"];

function IntegrationsScreen() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin", "connections"], queryFn: listConnections });
  const [disconnecting, setDisconnecting] = useState<ConnectorId | null>(null);

  // Real Nango Connect UI popup — same flow already live in
  // IndustryAI-Insaurance-ES-Brokers's Foundation.tsx. AP-05 is presentation
  // reuse of an already-real integration, not a new one.
  const connectMutation = useMutation({
    mutationFn: async (provider: ConnectorId) => {
      const session = await createConnectSession(provider);
      await new Promise<void>((resolve, reject) => {
        const nango = new Nango({});
        const connectUI = nango.openConnectUI({
          sessionToken: session.session_token,
          onEvent: (event) => {
            if (event.type === "connect") {
              confirmConnection(event.payload.providerConfigKey, event.payload.connectionId)
                .then(() => resolve())
                .catch((err: unknown) =>
                  reject(err instanceof Error ? err : new Error("Failed to save connection")),
                );
            } else if (event.type === "close") {
              resolve();
            } else if (event.type === "error") {
              reject(new Error(event.payload.errorMessage));
            }
          },
        });
        connectUI.open();
      });
    },
    onSuccess: async () => {
      toast.success("Connector connected for this tenant.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "connections"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Connect failed"),
  });

  const disconnectMutation = useMutation({
    mutationFn: (provider: ConnectorId) => disconnectIntegration(provider),
    onSuccess: async () => {
      toast.success("Connector disconnected. Workflows using it will fail loudly.");
      setDisconnecting(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "connections"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
    },
    onError: (error) => {
      setDisconnecting(null);
      toast.error(error instanceof Error ? error.message : "Disconnect failed");
    },
  });

  const byProvider = new Map((query.data ?? []).map((row) => [row.provider, row]));

  return (
    <>
      <PageHeader
        eyebrow="AP-05"
        title="Integrations Oversight"
        description="The same real Nango connections shown on the per-user Settings page, presented here for the admin. Connecting opens the real Google OAuth popup; disconnecting is confirm-gated."
      />

      {query.isPending ? <LoadingState label="Loading connectors" /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}

      {query.data ? (
        <div className="grid gap-4 md:grid-cols-2">
          {CONNECTORS.map((connector) => {
            const row = byProvider.get(connector.id);
            const connected = row?.status === "connected";
            return (
              <section key={connector.id} className="panel space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className="text-sm font-semibold">{connector.label}</h2>
                    <p className="text-xs text-muted-foreground">{connector.description}</p>
                  </div>
                  <StatusPill status={connected ? "connected" : "disconnected"} />
                </div>

                {connected ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDisconnecting(connector.id)}
                    disabled={disconnectMutation.isPending}
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => connectMutation.mutate(connector.id)}
                    disabled={connectMutation.isPending}
                  >
                    {connectMutation.isPending ? "Connecting…" : `Connect ${connector.label}`}
                  </Button>
                )}
              </section>
            );
          })}
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(disconnecting)}
        onOpenChange={(open) => {
          if (!open) setDisconnecting(null);
        }}
        title="Disconnect this connector?"
        confirmLabel="Disconnect"
        pending={disconnectMutation.isPending}
        description={
          <>
            <p>
              Every workflow step that reads{" "}
              <span className="numeric font-semibold text-foreground">{disconnecting}</span> will
              stop working for this tenant until it is reconnected.
            </p>
            <p>This is the same real connection used on the per-user Settings page.</p>
          </>
        }
        onConfirm={() => disconnecting && disconnectMutation.mutate(disconnecting)}
      />
    </>
  );
}
