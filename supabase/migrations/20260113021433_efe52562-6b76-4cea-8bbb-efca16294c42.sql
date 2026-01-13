-- Create a table for videos (similar to lo)
CREATE TABLE public.video (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create a table for video versions
CREATE TABLE public.video_version (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES public.video(id) ON DELETE CASCADE,
  version_name TEXT NOT NULL,
  content TEXT,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.video ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_version ENABLE ROW LEVEL SECURITY;

-- Create policies for video table
CREATE POLICY "Anyone can view videos" ON public.video FOR SELECT USING (true);
CREATE POLICY "Anyone can create videos" ON public.video FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update videos" ON public.video FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete videos" ON public.video FOR DELETE USING (true);

-- Create policies for video_version table
CREATE POLICY "Anyone can view video versions" ON public.video_version FOR SELECT USING (true);
CREATE POLICY "Anyone can create video versions" ON public.video_version FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update video versions" ON public.video_version FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete video versions" ON public.video_version FOR DELETE USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_video_updated_at
BEFORE UPDATE ON public.video
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_video_version_updated_at
BEFORE UPDATE ON public.video_version
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add foreign keys to desc table
ALTER TABLE public.desc ADD COLUMN lo_id UUID REFERENCES public.lo(id) ON DELETE SET NULL;
ALTER TABLE public.desc ADD COLUMN video_id UUID REFERENCES public.video(id) ON DELETE SET NULL;