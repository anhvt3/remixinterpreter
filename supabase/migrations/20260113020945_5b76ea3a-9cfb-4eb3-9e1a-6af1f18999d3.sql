-- Create a table for descriptions
CREATE TABLE public.desc (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('LODesc', 'VideoDesc')),
  name TEXT NOT NULL,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create a table for description versions
CREATE TABLE public.desc_version (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  desc_id UUID NOT NULL REFERENCES public.desc(id) ON DELETE CASCADE,
  version_name TEXT NOT NULL,
  content TEXT,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.desc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desc_version ENABLE ROW LEVEL SECURITY;

-- Create policies for desc table
CREATE POLICY "Anyone can view descs" ON public.desc FOR SELECT USING (true);
CREATE POLICY "Anyone can create descs" ON public.desc FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update descs" ON public.desc FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete descs" ON public.desc FOR DELETE USING (true);

-- Create policies for desc_version table
CREATE POLICY "Anyone can view desc versions" ON public.desc_version FOR SELECT USING (true);
CREATE POLICY "Anyone can create desc versions" ON public.desc_version FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update desc versions" ON public.desc_version FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete desc versions" ON public.desc_version FOR DELETE USING (true);

-- Create trigger for automatic timestamp updates on desc
CREATE TRIGGER update_desc_updated_at
BEFORE UPDATE ON public.desc
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for automatic timestamp updates on desc_version
CREATE TRIGGER update_desc_version_updated_at
BEFORE UPDATE ON public.desc_version
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();