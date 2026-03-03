
-- Profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text,
  contact_name text,
  phone text,
  email text,
  logo_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, contact_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Projects table
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL DEFAULT 'Untitled',
  vehicle_data jsonb NOT NULL,
  template_id text NOT NULL DEFAULT 'modern',
  html_content text,
  main_image_base64 text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects" ON public.projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.projects FOR DELETE USING (auth.uid() = user_id);

-- Project images table
CREATE TABLE public.project_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  image_base64 text NOT NULL,
  perspective text,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.project_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own images" ON public.project_images FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own images" ON public.project_images FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own images" ON public.project_images FOR DELETE USING (auth.uid() = user_id);
