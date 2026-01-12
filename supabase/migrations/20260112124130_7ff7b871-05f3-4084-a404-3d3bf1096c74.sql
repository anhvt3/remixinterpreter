-- Create Config table for storing configuration versions
CREATE TABLE public.config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  version TEXT NOT NULL,
  content TEXT,
  important_notes TEXT,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint on type + version
ALTER TABLE public.config ADD CONSTRAINT config_type_version_unique UNIQUE (type, version);

-- Enable Row Level Security
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this is a config tool without auth)
CREATE POLICY "Anyone can view configs" 
ON public.config 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create configs" 
ON public.config 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update configs" 
ON public.config 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete configs" 
ON public.config 
FOR DELETE 
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_config_updated_at
BEFORE UPDATE ON public.config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();