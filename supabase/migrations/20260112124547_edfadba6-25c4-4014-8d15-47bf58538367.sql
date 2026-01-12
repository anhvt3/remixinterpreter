-- Add is_deleted column for soft delete
ALTER TABLE public.config ADD COLUMN is_deleted BOOLEAN DEFAULT false;