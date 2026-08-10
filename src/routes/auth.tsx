import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getIdentity, login } from "@/lib/api/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Coverline OS Admin" },
      {
        name: "description",
        content: "Sign in to the Coverline OS internal admin surface.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    // Only an admin identity is ever persisted by login() below, so landing
    // here already signed in always means "go to the admin surface."
    if (getIdentity()) navigate({ to: "/admin", replace: true });
  }, [navigate]);

  const signIn = async () => {
    setPending(true);
    try {
      await login(email.trim().toLowerCase(), password);
      navigate({ to: "/admin", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign-in failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid-noise flex min-h-screen items-center justify-center px-6 py-16">
      <div className="panel w-full max-w-md p-8">
        <p className="label-caps">Coverline OS · Internal Admin</p>
        <h1 className="mt-2 text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This surface is for platform administrators only. Your email and password are checked
          against AI-OS-BE's admin login — an account without the admin role, or without a password
          set, cannot sign in here at all.
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void signIn();
          }}
          className="mt-6 space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">Admin email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="bg-background"
              placeholder="admin@demo-es.example"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="bg-background"
            />
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
