
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE public.scheduled_social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  vehicle_id UUID,
  media_type TEXT NOT NULL CHECK (media_type IN ('image','video')),
  media_path TEXT NOT NULL,
  media_name TEXT,
  media_url TEXT NOT NULL,
  caption TEXT NOT NULL,
  platforms TEXT[] NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','published','failed','cancelled')),
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  results JSONB,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scheduled_social_posts_due
  ON public.scheduled_social_posts (scheduled_at)
  WHERE status = 'pending';
CREATE INDEX idx_scheduled_social_posts_user
  ON public.scheduled_social_posts (user_id, scheduled_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_social_posts TO authenticated;
GRANT ALL ON public.scheduled_social_posts TO service_role;

ALTER TABLE public.scheduled_social_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own scheduled posts"
  ON public.scheduled_social_posts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_scheduled_social_posts_updated_at
  BEFORE UPDATE ON public.scheduled_social_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
