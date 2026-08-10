import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { getOverview, listUsers, type AuditEntryOut } from "@/lib/api/admin";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable, type Column } from "@/components/admin/data-table";
import { EmptyState, ErrorState, LoadingState } from "@/components/admin/states";
import { currencyFormatter } from "@/lib/admin-settings";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Overview — Coverline OS" },
      {
        name: "description",
        content: "Tenant identity, connector status and the most recent audit entries.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminOverview,
});

// AuditEntryOut has no natural unique id (it's an append-only log row, not a
// DB entity the API exposes a primary key for) — DataTable needs one for
// React keys, so it's synthesized here rather than in the shared component.
type AuditRow = AuditEntryOut & { id: string };

function withRowIds(entries: AuditEntryOut[]): AuditRow[] {
  return entries.map((entry, index) => ({
    ...entry,
    id: `${entry.workflow}:${entry.who}:${entry.at ?? index}:${index}`,
  }));
}

function AdminOverview() {
  const overviewQuery = useQuery({ queryKey: ["admin", "overview"], queryFn: getOverview });
  const usersQuery = useQuery({ queryKey: ["admin", "users"], queryFn: listUsers });

  const columns: Column<AuditRow>[] = [
    {
      id: "at",
      header: "Timestamp",
      cell: (row) => (
        <span className="numeric text-xs text-muted-foreground">
          {row.at ? new Date(row.at).toLocaleString() : "—"}
        </span>
      ),
    },
    { id: "who", header: "Actor", cell: (row) => row.who },
    {
      id: "workflow",
      header: "Workflow",
      cell: (row) => <span className="numeric text-xs">{row.workflow}</span>,
    },
    {
      id: "what",
      header: "Action",
      cell: (row) => <span className="text-muted-foreground">{row.what}</span>,
    },
  ];

  const connections = overviewQuery.data?.connections ?? [];
  const connectedCount = connections.filter((c) => c.status === "connected").length;

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title={overviewQuery.data?.tenant ? `Admin — ${overviewQuery.data.tenant.name}` : "Admin"}
        description="Read-only landing screen: who this tenant is, whether connectors are live, and what happened most recently."
        actions={
          <Link
            to="/admin/activity"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-surface"
          >
            View all activity
            <ArrowUpRight className="size-3.5" />
          </Link>
        }
      />

      {overviewQuery.isPending ? <LoadingState label="Loading overview" /> : null}
      {overviewQuery.isError ? (
        <ErrorState error={overviewQuery.error} onRetry={() => overviewQuery.refetch()} />
      ) : null}

      {overviewQuery.data ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <section className="panel space-y-2 p-5">
              <p className="label-caps">Tenant identity</p>
              <p className="text-lg font-semibold">{overviewQuery.data.tenant.name}</p>
              <p className="numeric text-xs text-muted-foreground">
                {overviewQuery.data.tenant.vertical} · cap{" "}
                {overviewQuery.data.tenant.junior_premium_cap != null
                  ? currencyFormatter.format(overviewQuery.data.tenant.junior_premium_cap)
                  : "env default"}
              </p>
              <p className="text-xs text-muted-foreground">
                {usersQuery.data ? `${usersQuery.data.length} users` : "…"}
              </p>
            </section>

            <section className="panel space-y-2 p-5">
              <p className="label-caps">Connector status</p>
              <p className="numeric text-lg font-semibold">
                {connectedCount} / {connections.length} connected
              </p>
              <Link
                to="/admin/integrations"
                className="text-xs font-semibold text-primary hover:underline"
              >
                Manage integrations
              </Link>
            </section>

            <section className="panel space-y-2 p-5">
              <p className="label-caps">Recent activity</p>
              <p className="numeric text-lg font-semibold">
                {overviewQuery.data.recent_audit.length} shown
              </p>
              <p className="text-xs text-muted-foreground">
                Latest entries across all workflows for this tenant.
              </p>
            </section>
          </div>

          <section className="space-y-3">
            <h2 className="label-caps">Latest audit entries</h2>
            <DataTable
              columns={columns}
              rows={withRowIds(overviewQuery.data.recent_audit)}
              emptyState={
                <EmptyState
                  title="No activity yet"
                  description="This is a first-run tenant. Entries appear here as soon as any workflow or admin action runs."
                />
              }
            />
          </section>
        </>
      ) : null}
    </>
  );
}
