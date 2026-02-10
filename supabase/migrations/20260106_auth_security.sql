-- Migration: Auth security tables (rate limits + audit logs)
BEGIN;

CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identifier TEXT NOT NULL,
  limit_type TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL,
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (identifier, limit_type)
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_identifier ON public.auth_rate_limits(identifier);
CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_type ON public.auth_rate_limits(limit_type);
CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_blocked ON public.auth_rate_limits(blocked_until);

ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage auth_rate_limits" ON public.auth_rate_limits;
CREATE POLICY "Service role can manage auth_rate_limits"
ON public.auth_rate_limits
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS public.auth_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  identifier TEXT,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_user_id ON public.auth_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_action ON public.auth_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_auth_audit_created_at ON public.auth_audit_logs(created_at);

ALTER TABLE public.auth_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can insert auth_audit_logs" ON public.auth_audit_logs;
CREATE POLICY "Service role can insert auth_audit_logs"
ON public.auth_audit_logs
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins can view auth_audit_logs" ON public.auth_audit_logs;
CREATE POLICY "Admins can view auth_audit_logs"
ON public.auth_audit_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

DROP TRIGGER IF EXISTS update_auth_rate_limits_updated_at ON public.auth_rate_limits;
CREATE TRIGGER update_auth_rate_limits_updated_at
  BEFORE UPDATE ON public.auth_rate_limits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
