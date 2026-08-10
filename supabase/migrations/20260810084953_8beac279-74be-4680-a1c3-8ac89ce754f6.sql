CREATE TYPE public.app_role AS ENUM ('junior', 'senior', 'admin');

CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  vertical text NOT NULL DEFAULT 'commercial_lines',
  junior_premium_cap numeric(12,2) NOT NULL DEFAULT 25000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX profiles_tenant_email_key ON public.profiles (tenant_id, lower(email));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id uuid,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (profile_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key text NOT NULL,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  UNIQUE (tenant_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor text NOT NULL,
  workflow text NOT NULL,
  action text NOT NULL,
  detail text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_tenant_created_idx ON public.audit_log (tenant_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.integration_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connector text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected',
  account_label text,
  connected_at timestamptz,
  UNIQUE (tenant_id, connector)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_connections TO authenticated;
GRANT ALL ON public.integration_connections TO service_role;
ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;

-- Security definer helpers (avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles r
    JOIN public.profiles p ON p.id = r.profile_id
    WHERE p.user_id = _user_id AND r.role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.current_role_name()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.role::text
  FROM public.user_roles r
  JOIN public.profiles p ON p.id = r.profile_id
  WHERE p.user_id = auth.uid()
  ORDER BY CASE r.role WHEN 'admin' THEN 1 WHEN 'senior' THEN 2 ELSE 3 END
  LIMIT 1
$$;

-- Policies: tenant-scoped reads for signed-in members, admin-only writes
CREATE POLICY "members read own tenant" ON public.tenants FOR SELECT TO authenticated
  USING (id = public.current_tenant_id());
CREATE POLICY "admins update own tenant" ON public.tenants FOR UPDATE TO authenticated
  USING (id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "members read tenant profiles" ON public.profiles FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "admins insert tenant profiles" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update tenant profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "members read tenant roles" ON public.user_roles FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "admins write tenant roles" ON public.user_roles FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "members read tenant settings" ON public.platform_settings FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "admins write tenant settings" ON public.platform_settings FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "members read tenant audit" ON public.audit_log FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "members append tenant audit" ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "members read tenant connections" ON public.integration_connections FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "admins write tenant connections" ON public.integration_connections FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin'));

-- Signup wiring: first ever user becomes admin of the demo tenant
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_profile uuid;
  v_role public.app_role;
BEGIN
  SELECT id INTO v_tenant FROM public.tenants ORDER BY created_at LIMIT 1;
  IF v_tenant IS NULL THEN
    INSERT INTO public.tenants (name) VALUES ('New Firm') RETURNING id INTO v_tenant;
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE tenant_id = v_tenant AND role = 'admin' AND user_id IS NOT NULL) THEN
    v_role := 'junior';
  ELSE
    v_role := 'admin';
  END IF;

  INSERT INTO public.profiles (user_id, tenant_id, email, full_name)
  VALUES (NEW.id, v_tenant, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id INTO v_profile;

  IF v_profile IS NULL THEN
    SELECT id INTO v_profile FROM public.profiles WHERE user_id = NEW.id;
  END IF;

  INSERT INTO public.user_roles (profile_id, user_id, tenant_id, role)
  VALUES (v_profile, NEW.id, v_tenant, v_role)
  ON CONFLICT (profile_id, role) DO NOTHING;

  INSERT INTO public.audit_log (tenant_id, actor, workflow, action, detail)
  VALUES (v_tenant, NEW.email, 'identity', 'user.signup', 'Signed up with role ' || v_role);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed demo tenant, users, connectors, settings and activity
INSERT INTO public.tenants (id, name, vertical, junior_premium_cap)
VALUES ('11111111-1111-4111-8111-111111111111', 'Harbor & Vance Insurance', 'commercial_lines', 25000);

INSERT INTO public.profiles (id, tenant_id, email, full_name, created_at) VALUES
  ('21111111-1111-4111-8111-111111111101', '11111111-1111-4111-8111-111111111111', 'dana.reyes@harborvance.com', 'Dana Reyes', now() - interval '92 days'),
  ('21111111-1111-4111-8111-111111111102', '11111111-1111-4111-8111-111111111111', 'marcus.hale@harborvance.com', 'Marcus Hale', now() - interval '61 days'),
  ('21111111-1111-4111-8111-111111111103', '11111111-1111-4111-8111-111111111111', 'priya.nandi@harborvance.com', 'Priya Nandi', now() - interval '34 days'),
  ('21111111-1111-4111-8111-111111111104', '11111111-1111-4111-8111-111111111111', 'tom.okafor@harborvance.com', 'Tom Okafor', now() - interval '12 days');

INSERT INTO public.user_roles (profile_id, tenant_id, role) VALUES
  ('21111111-1111-4111-8111-111111111101', '11111111-1111-4111-8111-111111111111', 'admin'),
  ('21111111-1111-4111-8111-111111111102', '11111111-1111-4111-8111-111111111111', 'senior'),
  ('21111111-1111-4111-8111-111111111103', '11111111-1111-4111-8111-111111111111', 'junior'),
  ('21111111-1111-4111-8111-111111111104', '11111111-1111-4111-8111-111111111111', 'junior');

INSERT INTO public.integration_connections (tenant_id, connector, status, account_label, connected_at) VALUES
  ('11111111-1111-4111-8111-111111111111', 'gmail', 'connected', 'ops@harborvance.com', now() - interval '40 days'),
  ('11111111-1111-4111-8111-111111111111', 'sheets', 'connected', 'ops@harborvance.com', now() - interval '40 days'),
  ('11111111-1111-4111-8111-111111111111', 'drive', 'disconnected', NULL, NULL),
  ('11111111-1111-4111-8111-111111111111', 'calendar', 'connected', 'ops@harborvance.com', now() - interval '11 days');

INSERT INTO public.platform_settings (tenant_id, key, value, updated_by, updated_at) VALUES
  ('11111111-1111-4111-8111-111111111111', 'quote_rank_price_weight', '0.65', 'dana.reyes@harborvance.com', now() - interval '3 days'),
  ('11111111-1111-4111-8111-111111111111', 'connectors_mode', 'live', 'dana.reyes@harborvance.com', now() - interval '9 days');

INSERT INTO public.audit_log (tenant_id, actor, workflow, action, detail, created_at) VALUES
  ('11111111-1111-4111-8111-111111111111', 'dana.reyes@harborvance.com', 'admin', 'setting.override', 'quote_rank_price_weight set to 0.65', now() - interval '3 days'),
  ('11111111-1111-4111-8111-111111111111', 'marcus.hale@harborvance.com', 'submission', 'submission.send', 'Sent Aldridge Logistics to 4 carriers', now() - interval '2 days'),
  ('11111111-1111-4111-8111-111111111111', 'priya.nandi@harborvance.com', 'quote_compare', 'quote.rank', 'Ranked 6 quotes for Bellweather Foods', now() - interval '2 days'),
  ('11111111-1111-4111-8111-111111111111', 'marcus.hale@harborvance.com', 'binding', 'policy.issue', 'Issued POL-40219 at $48,200 premium', now() - interval '1 day'),
  ('11111111-1111-4111-8111-111111111111', 'priya.nandi@harborvance.com', 'intake', 'intake.create', 'Created intake for Northgate Dental', now() - interval '20 hours'),
  ('11111111-1111-4111-8111-111111111111', 'dana.reyes@harborvance.com', 'admin', 'role.change', 'Tom Okafor junior -> junior (no-op review)', now() - interval '14 hours'),
  ('11111111-1111-4111-8111-111111111111', 'tom.okafor@harborvance.com', 'renewal', 'renewal.flag', 'Flagged 3 renewals inside 45 days', now() - interval '9 hours'),
  ('11111111-1111-4111-8111-111111111111', 'marcus.hale@harborvance.com', 'carrier_appetite', 'appetite.refresh', 'Refreshed appetite for 12 carriers', now() - interval '6 hours'),
  ('11111111-1111-4111-8111-111111111111', 'priya.nandi@harborvance.com', 'submission', 'submission.override', 'Override requested above junior cap', now() - interval '4 hours'),
  ('11111111-1111-4111-8111-111111111111', 'dana.reyes@harborvance.com', 'integrations', 'connector.disconnect', 'Disconnected Drive', now() - interval '2 hours');