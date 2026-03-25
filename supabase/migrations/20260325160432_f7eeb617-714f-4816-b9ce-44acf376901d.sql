
CREATE TABLE public.dealer_banks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_type TEXT NOT NULL CHECK (bank_type IN ('leasing', 'financing')),
  bank_name TEXT NOT NULL DEFAULT '',
  legal_text TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dealer_banks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own banks"
  ON public.dealer_banks
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
