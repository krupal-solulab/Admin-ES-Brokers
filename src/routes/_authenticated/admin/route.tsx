import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, Building2, Cable, LayoutDashboard, LogOut, Sliders, Users } from "lucide-react";
import { clearIdentity, getIdentity } from "@/lib/api/identity";
import { ErrorState } from "@/components/admin/states";

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/tenant", label: "Tenant", icon: Building2 },
  { to: "/admin/settings", label: "Platform Settings", icon: Sliders },
  { to: "/admin/integrations", label: "Integrations", icon: Cable },
  { to: "/admin/activity", label: "Activity", icon: Activity },
] as const;

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: () => {
    // Belt-and-suspenders under the top-level _authenticated guard, which
    // already enforces admin-only for this entire app.
    if (getIdentity()?.role !== "admin") throw redirect({ to: "/auth" });
    return { adminRole: "admin" as const };
  },
  component: AdminShell,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl p-10">
      <ErrorState error={error} />
    </div>
  ),
});

function AdminShell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    clearIdentity();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center justify-between border-b-2 border-admin/60 bg-admin/10 px-6 py-2">
        <p className="label-caps text-admin">Internal / Admin — Coverline OS</p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={signOut}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <LogOut className="size-3.5" />
            Sign out
          </button>
        </div>
      </div>

      <div className="flex min-h-[calc(100vh-41px)]">
        <nav className="w-60 shrink-0 border-r border-border bg-surface/40 p-4">
          <ul className="space-y-1">
            {NAV.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  activeOptions={{ exact: "exact" in item ? item.exact : false }}
                  activeProps={{
                    className: "bg-admin/12 text-admin border-admin/30",
                  }}
                  inactiveProps={{
                    className:
                      "text-muted-foreground border-transparent hover:bg-surface hover:text-foreground",
                  }}
                  className="flex items-center gap-2.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors"
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 flex-1 p-8">
          <div className="mx-auto max-w-5xl space-y-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
