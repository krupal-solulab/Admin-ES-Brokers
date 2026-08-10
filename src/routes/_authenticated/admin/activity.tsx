import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listAudit, type AuditEntryOut } from "@/lib/api/admin";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable, type Column } from "@/components/admin/data-table";
import { EmptyState, ErrorState, LoadingState } from "@/components/admin/states";
import { WORKFLOWS } from "@/lib/admin-settings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/activity")({
  head: () => ({
    meta: [
      { title: "Activity Log — Coverline OS Admin" },
      {
        name: "description",
        content: "Tenant-wide audit trail filterable by workflow and actor.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ActivityScreen,
});

const ALL = "__all__";

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

function ActivityScreen() {
  const [workflow, setWorkflow] = useState<string>(ALL);
  const [actor, setActor] = useState("");

  const query = useQuery({
    queryKey: ["admin", "audit", workflow, actor],
    queryFn: () =>
      listAudit({
        limit: 100,
        ...(workflow !== ALL ? { workflow } : {}),
        ...(actor.trim() ? { actor: actor.trim() } : {}),
      }),
  });

  const columns: Column<AuditRow>[] = [
    {
      id: "at",
      header: "Timestamp",
      cell: (row) => (
        <span className="numeric text-xs text-muted-foreground">
          {row.at ? new Date(row.at).toLocaleString() : "—"}
        </span>
      ),
      sortValue: (row) => row.at ?? "",
    },
    {
      id: "who",
      header: "Actor",
      cell: (row) => <span className="text-xs">{row.who}</span>,
      sortValue: (row) => row.who,
    },
    {
      id: "workflow",
      header: "Workflow",
      cell: (row) => <span className="numeric text-xs">{row.workflow}</span>,
      sortValue: (row) => row.workflow,
    },
    {
      id: "what",
      header: "Action",
      cell: (row) => <span className="numeric text-xs">{row.what}</span>,
      sortValue: (row) => row.what,
    },
    {
      id: "detail",
      header: "Detail",
      cell: (row) => <span className="text-muted-foreground">{JSON.stringify(row.detail)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="AP-06"
        title="Activity Log"
        description="Persisted audit entries for this tenant, newest first. Filters are applied server-side; the log is read-only."
      />

      <div className="panel flex flex-wrap items-end gap-4 p-4">
        <div className="space-y-1.5">
          <Label className="label-caps">Workflow</Label>
          <Select value={workflow} onValueChange={setWorkflow}>
            <SelectTrigger className="w-52 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All workflows</SelectItem>
              {WORKFLOWS.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="actor-filter" className="label-caps">
            Actor
          </Label>
          <Input
            id="actor-filter"
            value={actor}
            placeholder="exact match, e.g. a user id"
            onChange={(event) => setActor(event.target.value)}
            className="w-64 bg-background"
          />
        </div>
        {workflow !== ALL || actor ? (
          <button
            type="button"
            onClick={() => {
              setWorkflow(ALL);
              setActor("");
            }}
            className="pb-2 text-xs font-semibold text-primary hover:underline"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {query.isPending ? <LoadingState label="Loading activity" /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
      {query.data ? (
        <DataTable
          columns={columns}
          rows={withRowIds(query.data)}
          defaultSort={{ id: "at", desc: true }}
          emptyState={
            <EmptyState
              title="No entries match these filters"
              description="Widen the workflow filter or clear the actor to see the full tenant trail."
            />
          }
        />
      ) : null}
    </>
  );
}
