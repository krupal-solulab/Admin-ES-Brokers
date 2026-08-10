import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createUser, listUsers, updateUser, type UserOut } from "@/lib/api/admin";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable, type Column } from "@/components/admin/data-table";
import { EmptyState, ErrorState, LoadingState } from "@/components/admin/states";
import { StatusPill } from "@/components/admin/status-pill";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { ROLES, type Role } from "@/lib/admin-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({
    meta: [
      { title: "User Management — Coverline OS Admin" },
      {
        name: "description",
        content: "View every user in the tenant, change roles, and create new users.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UsersScreen,
});

function UsersScreen() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin", "users"], queryFn: listUsers });

  const [pendingChange, setPendingChange] = useState<{ row: UserOut; role: Role } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ email: "", fullName: "", role: "junior" as Role });
  const [formError, setFormError] = useState<string | null>(null);

  const roleMutation = useMutation({
    mutationFn: (input: { userId: string; role: Role }) =>
      updateUser(input.userId, { role: input.role }),
    onSuccess: async () => {
      toast.success("Role updated — effective on the user's next login.");
      setPendingChange(null);
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Update failed"),
  });

  const createMutation = useMutation({
    mutationFn: (input: { email: string; fullName: string; role: Role }) =>
      createUser({ email: input.email, name: input.fullName, role: input.role }),
    onSuccess: async () => {
      toast.success("User created");
      setCreateOpen(false);
      setForm({ email: "", fullName: "", role: "junior" });
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (error) => setFormError(error instanceof Error ? error.message : "Create failed"),
  });

  const columns: Column<UserOut>[] = [
    {
      id: "name",
      header: "Name",
      cell: (row) => <span className="font-medium">{row.name || "—"}</span>,
      sortValue: (row) => (row.name ?? "").toLowerCase(),
    },
    {
      id: "email",
      header: "Email",
      cell: (row) => <span className="numeric text-xs text-muted-foreground">{row.email}</span>,
      sortValue: (row) => row.email,
    },
    {
      id: "role",
      header: "Role",
      cell: (row) => <StatusPill status={row.role} />,
      sortValue: (row) => row.role,
    },
    {
      id: "created_at",
      header: "Created",
      cell: (row) => (
        <span className="numeric text-xs text-muted-foreground">
          {new Date(row.created_at).toLocaleDateString()}
        </span>
      ),
      sortValue: (row) => row.created_at,
    },
    {
      id: "actions",
      header: "Change role",
      align: "right",
      cell: (row) => {
        const isPending = pendingChange?.row.id === row.id;
        return (
          <div className="flex items-center justify-end gap-2">
            {isPending ? <StatusPill status="pending" label="pending confirm" /> : null}
            <Select
              value={isPending ? pendingChange.role : row.role}
              onValueChange={(value) => setPendingChange({ row, role: value as Role })}
            >
              <SelectTrigger className="h-8 w-32 bg-background text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="AP-03"
        title="User Management"
        description="Every user in this tenant. Role changes take effect on the user's next login and are confirm-gated."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New User
          </Button>
        }
      />

      {query.isPending ? <LoadingState label="Loading users" /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
      {query.data ? (
        <DataTable
          columns={columns}
          rows={query.data}
          defaultSort={{ id: "created_at" }}
          emptyState={
            <EmptyState
              title="No users in this tenant"
              description="Create the first user to give someone access to this firm's workspace."
            />
          }
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingChange) && pendingChange?.role !== pendingChange?.row.role}
        onOpenChange={(open) => {
          if (!open) setPendingChange(null);
        }}
        title="Change this user's role?"
        confirmLabel="Change role"
        pending={roleMutation.isPending}
        description={
          pendingChange ? (
            <>
              <p>
                <span className="font-semibold text-foreground">{pendingChange.row.email}</span>{" "}
                moves from <span className="numeric">{pendingChange.row.role}</span> to{" "}
                <span className="numeric">{pendingChange.role}</span>.
              </p>
              <p>This changes what they can approve. It applies at their next login.</p>
            </>
          ) : null
        }
        onConfirm={() =>
          pendingChange &&
          roleMutation.mutate({ userId: pendingChange.row.id, role: pendingChange.role })
        }
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-popover">
          <DialogHeader>
            <DialogTitle>New user</DialogTitle>
            <DialogDescription>
              Adds a user record to this tenant with the role you pick. They can sign in immediately
              with just this email — no password to set.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setFormError(null);
              createMutation.mutate(form);
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="new-name">Full name</Label>
              <Input
                id="new-name"
                value={form.fullName}
                onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                required
                className="bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-email">Email</Label>
              <Input
                id="new-email"
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                required
                className="bg-background"
              />
              {formError ? (
                <p className="text-xs font-medium text-destructive">{formError}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-role">Role</Label>
              <Select
                value={form.role}
                onValueChange={(value) => setForm({ ...form, role: value as Role })}
              >
                <SelectTrigger id="new-role" className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating…" : "Create user"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
