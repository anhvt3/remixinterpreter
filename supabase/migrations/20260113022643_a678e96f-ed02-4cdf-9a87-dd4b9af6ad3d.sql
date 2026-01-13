-- Create dsl_script table
CREATE TABLE public.dsl_script (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  desc_id UUID NOT NULL REFERENCES public.desc(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_deleted BOOLEAN DEFAULT false
);

-- Create dsl_script_version table
CREATE TABLE public.dsl_script_version (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dsl_script_id UUID NOT NULL REFERENCES public.dsl_script(id) ON DELETE CASCADE,
  version_name TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_deleted BOOLEAN DEFAULT false
);

-- Enable RLS
ALTER TABLE public.dsl_script ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dsl_script_version ENABLE ROW LEVEL SECURITY;

-- RLS policies for dsl_script
CREATE POLICY "Anyone can view dsl_scripts" ON public.dsl_script FOR SELECT USING (true);
CREATE POLICY "Anyone can create dsl_scripts" ON public.dsl_script FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update dsl_scripts" ON public.dsl_script FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete dsl_scripts" ON public.dsl_script FOR DELETE USING (true);

-- RLS policies for dsl_script_version
CREATE POLICY "Anyone can view dsl_script versions" ON public.dsl_script_version FOR SELECT USING (true);
CREATE POLICY "Anyone can create dsl_script versions" ON public.dsl_script_version FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update dsl_script versions" ON public.dsl_script_version FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete dsl_script versions" ON public.dsl_script_version FOR DELETE USING (true);

-- Add updated_at triggers
CREATE TRIGGER update_dsl_script_updated_at
  BEFORE UPDATE ON public.dsl_script
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dsl_script_version_updated_at
  BEFORE UPDATE ON public.dsl_script_version
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();