import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface VideoRecord {
  id: string;
  code: string;
  name: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

export interface VideoVersionRecord {
  id: string;
  video_id: string;
  version_name: string;
  content: string | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

export function useVideoData() {
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [videoVersions, setVideoVersions] = useState<VideoVersionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchVideos = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('video')
        .select('*')
        .eq('is_deleted', false)
        .order('code', { ascending: true });

      if (error) throw error;
      setVideos((data as VideoRecord[]) || []);
    } catch (error: any) {
      toast({
        title: 'Error fetching Videos',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchVersionsForVideo = useCallback(async (videoId: string) => {
    try {
      const { data, error } = await supabase
        .from('video_version')
        .select('*')
        .eq('video_id', videoId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .order('version_name', { ascending: false });

      if (error) throw error;
      setVideoVersions((data as VideoVersionRecord[]) || []);
    } catch (error: any) {
      toast({
        title: 'Error fetching versions',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [toast]);

  const createVideo = useCallback(async (code: string, name: string): Promise<VideoRecord | null> => {
    try {
      const { data, error } = await supabase
        .from('video')
        .insert({ code, name })
        .select()
        .single();

      if (error) throw error;
      
      toast({
        title: 'Video created',
        description: `Created Video: ${code}`,
      });
      
      await fetchVideos();
      return data as VideoRecord;
    } catch (error: any) {
      toast({
        title: 'Error creating Video',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }
  }, [toast, fetchVideos]);

  const deleteVideo = useCallback(async (videoId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('video')
        .update({ is_deleted: true })
        .eq('id', videoId);

      if (error) throw error;
      
      toast({
        title: 'Video deleted',
        description: 'Video has been deleted',
      });
      
      await fetchVideos();
      return true;
    } catch (error: any) {
      toast({
        title: 'Error deleting Video',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
  }, [toast, fetchVideos]);

  const createVideoVersion = useCallback(async (videoId: string, versionName: string, content: string): Promise<VideoVersionRecord | null> => {
    try {
      const { data, error } = await supabase
        .from('video_version')
        .insert({ video_id: videoId, version_name: versionName, content })
        .select()
        .single();

      if (error) throw error;
      
      toast({
        title: 'Version created',
        description: `Created version: ${versionName}`,
      });
      
      await fetchVersionsForVideo(videoId);
      return data as VideoVersionRecord;
    } catch (error: any) {
      toast({
        title: 'Error creating version',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }
  }, [toast, fetchVersionsForVideo]);

  const updateVideoVersion = useCallback(async (versionId: string, content: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('video_version')
        .update({ content })
        .eq('id', versionId);

      if (error) throw error;
      
      toast({
        title: 'Version saved',
        description: 'Content updated successfully',
      });
      
      return true;
    } catch (error: any) {
      toast({
        title: 'Error saving version',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  const getVideoVersionContent = useCallback(async (versionId: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('video_version')
        .select('content')
        .eq('id', versionId)
        .maybeSingle();

      if (error) throw error;
      return data?.content || null;
    } catch (error: any) {
      toast({
        title: 'Error loading content',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }
  }, [toast]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  return {
    videos,
    videoVersions,
    loading,
    fetchVideos,
    fetchVersionsForVideo,
    createVideo,
    deleteVideo,
    createVideoVersion,
    updateVideoVersion,
    getVideoVersionContent,
  };
}
