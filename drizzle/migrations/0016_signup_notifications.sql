CREATE TABLE public.signup_notifications (
  user_id uuid PRIMARY KEY,
  notified_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.signup_notifications TO service_role;
ALTER TABLE public.signup_notifications ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.notify_new_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    PERFORM net.http_post(
      url := 'https://rauzclzphdnhzflovrya.supabase.co/functions/v1/notify-new-signup',
      body := jsonb_build_object('user_id', NEW.id),
      headers := '{"Content-Type":"application/json"}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN NULL; -- never block signup
  END;
  RETURN NEW;
END $$;

CREATE TRIGGER profiles_notify_new_signup
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.notify_new_signup();