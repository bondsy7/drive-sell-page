ALTER TYPE public.credit_action_type ADD VALUE IF NOT EXISTS 'image_analysis';
ALTER TYPE public.credit_action_type ADD VALUE IF NOT EXISTS 'text_generate';
ALTER TYPE public.credit_action_type ADD VALUE IF NOT EXISTS 'chat_message';
ALTER TYPE public.credit_action_type ADD VALUE IF NOT EXISTS 'banner_reframe';
ALTER TYPE public.credit_action_type ADD VALUE IF NOT EXISTS 'credit_refund';