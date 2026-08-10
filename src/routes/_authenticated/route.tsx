import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { clearIdentity, getIdentity } from "@/lib/api/identity";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: () => {
    // This whole app is the internal admin surface — not just the /admin
    // sub-route. A non-admin should never get past sign-in in practice
    // (only admins can ever get an identity via login()), but this guard is
    // the defense-in-depth backstop against a stale or tampered session.
    const identity = getIdentity();
    if (!identity) throw redirect({ to: "/auth" });
    if (identity.role !== "admin") {
      clearIdentity();
      throw redirect({ to: "/auth" });
    }
  },
  component: () => <Outlet />,
});
