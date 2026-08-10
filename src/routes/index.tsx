import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Cable, ShieldCheck, Sliders } from "lucide-react";
import { getIdentity } from "@/lib/api/identity";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Coverline OS — Internal Admin" },
      {
        name: "description",
        content:
          "Internal, role-gated administration for Coverline OS: tenants, users, live platform settings, integrations, and the audit trail.",
      },
      { property: "og:title", content: "Coverline OS — Internal Admin" },
      {
        property: "og:description",
        content: "Platform administration for Coverline OS. Admin accounts only.",
      },
    ],
  }),
  component: Landing,
});

const HIGHLIGHTS = [
  {
    icon: ShieldCheck,
    title: "Admin-only, top to bottom",
    body: "Every screen and every API route requires the admin role — nothing here is reachable by a junior or senior account.",
  },
  {
    icon: Sliders,
    title: "Live platform settings",
    body: "Six tunables editable without a redeploy, each showing whether it is on default or overridden.",
  },
  {
    icon: Cable,
    title: "Real integrations &amp; audit",
    body: "Real Gmail/Sheets/Drive/Calendar connection status and a persisted, filterable cross-workflow activity log.",
  },
];

function Landing() {
  const signedIn = Boolean(getIdentity());

  return (
    <div className="min-h-screen bg-background">
      <div className="grid-noise border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <span className="size-2.5 rounded-sm bg-primary" aria-hidden />
              Coverline OS · Admin
            </span>
            <Link
              to={signedIn ? "/admin" : "/auth"}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-surface"
            >
              {signedIn ? "Open admin" : "Sign in"}
              <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <div className="max-w-3xl py-20">
            <p className="label-caps">Coverline OS · Internal Admin</p>
            <h1 className="mt-4 text-5xl font-semibold leading-[1.05] tracking-tight">
              Platform administration for Coverline OS.
            </h1>
            <p className="mt-5 max-w-2xl text-base text-muted-foreground">
              Tenant settings, user &amp; role management, live platform tunables, integrations
              oversight, and the cross-workflow audit trail — in one role-gated surface, separate
              from the day-to-day broker workspace.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to={signedIn ? "/admin" : "/auth"}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                {signedIn ? "Go to Admin" : "Sign in to continue"}
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-4 md:grid-cols-3">
          {HIGHLIGHTS.map((item) => (
            <section key={item.title} className="panel space-y-3 p-6">
              <item.icon className="size-5 text-primary" />
              <h2 className="text-base font-semibold">{item.title}</h2>
              <p className="text-sm text-muted-foreground">{item.body}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
