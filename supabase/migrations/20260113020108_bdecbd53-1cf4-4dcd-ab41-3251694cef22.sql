-- Create LO (Learning Objects) table
CREATE TABLE public.lo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_deleted BOOLEAN DEFAULT false
);

-- Create LO Versions table
CREATE TABLE public.lo_version (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lo_id UUID NOT NULL REFERENCES public.lo(id) ON DELETE CASCADE,
  version_name TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_deleted BOOLEAN DEFAULT false,
  UNIQUE(lo_id, version_name)
);

-- Enable Row Level Security
ALTER TABLE public.lo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lo_version ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since no auth mentioned)
CREATE POLICY "Anyone can view LOs" ON public.lo FOR SELECT USING (true);
CREATE POLICY "Anyone can create LOs" ON public.lo FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update LOs" ON public.lo FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete LOs" ON public.lo FOR DELETE USING (true);

CREATE POLICY "Anyone can view LO versions" ON public.lo_version FOR SELECT USING (true);
CREATE POLICY "Anyone can create LO versions" ON public.lo_version FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update LO versions" ON public.lo_version FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete LO versions" ON public.lo_version FOR DELETE USING (true);

-- Create indexes for performance
CREATE INDEX idx_lo_code ON public.lo(code);
CREATE INDEX idx_lo_version_lo_id ON public.lo_version(lo_id);

-- Create trigger for updated_at on lo
CREATE TRIGGER update_lo_updated_at
BEFORE UPDATE ON public.lo
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on lo_version
CREATE TRIGGER update_lo_version_updated_at
BEFORE UPDATE ON public.lo_version
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();