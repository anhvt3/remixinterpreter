-- Drop permissive write policies for config table
DROP POLICY IF EXISTS "Anyone can create configs" ON public.config;
DROP POLICY IF EXISTS "Anyone can update configs" ON public.config;
DROP POLICY IF EXISTS "Anyone can delete configs" ON public.config;

-- Keep the read policy (Anyone can view configs) intact
-- All writes must now go through the edge function with password validation