
-- Add new credit action types for 360 spin
ALTER TYPE public.credit_action_type ADD VALUE IF NOT EXISTS 'spin360_analysis';
ALTER TYPE public.credit_action_type ADD VALUE IF NOT EXISTS 'spin360_normalize';
ALTER TYPE public.credit_action_type ADD VALUE IF NOT EXISTS 'spin360_generate';
ALTER TYPE public.credit_action_type ADD VALUE IF NOT EXISTS 'spin360_export';
