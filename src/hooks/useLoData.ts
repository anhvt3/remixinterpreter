import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface LoRecord {
  id: string;
  code: string;
  name: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

export interface LoVersionRecord {
  id: string;
  lo_id: string;
  version_name: string;
  content: string | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

export function useLoData() {
  const [los, setLos] = useState<LoRecord[]>([]);
  const [versions, setVersions] = useState<LoVersionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchLos = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('lo')
        .select('*')
        .eq('is_deleted', false)
        .order('code', { ascending: true });

      if (error) throw error;
      setLos((data as LoRecord[]) || []);
    } catch (error: any) {
      toast({
        title: 'Error fetching LOs',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchVersionsForLo = useCallback(async (loId: string) => {
    try {
      const { data, error } = await supabase
        .from('lo_version')
        .select('*')
        .eq('lo_id', loId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVersions((data as LoVersionRecord[]) || []);
    } catch (error: any) {
      toast({
        title: 'Error fetching versions',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [toast]);

  const createLo = useCallback(async (code: string, name: string): Promise<LoRecord | null> => {
    try {
      const { data, error } = await supabase
        .from('lo')
        .insert({ code, name })
        .select()
        .single();

      if (error) throw error;
      
      toast({
        title: 'LO created',
        description: `Created LO: ${code}`,
      });
      
      await fetchLos();
      return data as LoRecord;
    } catch (error: any) {
      toast({
        title: 'Error creating LO',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }
  }, [toast, fetchLos]);

  const deleteLo = useCallback(async (loId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('lo')
        .update({ is_deleted: true })
        .eq('id', loId);

      if (error) throw error;
      
      toast({
        title: 'LO deleted',
        description: 'LO has been deleted',
      });
      
      await fetchLos();
      return true;
    } catch (error: any) {
      toast({
        title: 'Error deleting LO',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
  }, [toast, fetchLos]);

  const createVersion = useCallback(async (loId: string, versionName: string, content: string): Promise<LoVersionRecord | null> => {
    try {
      const { data, error } = await supabase
        .from('lo_version')
        .insert({ lo_id: loId, version_name: versionName, content })
        .select()
        .single();

      if (error) throw error;
      
      toast({
        title: 'Version created',
        description: `Created version: ${versionName}`,
      });
      
      await fetchVersionsForLo(loId);
      return data as LoVersionRecord;
    } catch (error: any) {
      toast({
        title: 'Error creating version',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }
  }, [toast, fetchVersionsForLo]);

  const updateVersion = useCallback(async (versionId: string, content: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('lo_version')
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

  const getVersionContent = useCallback(async (versionId: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('lo_version')
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
    fetchLos();
  }, [fetchLos]);

  return {
    los,
    versions,
    loading,
    fetchLos,
    fetchVersionsForLo,
    createLo,
    deleteLo,
    createVersion,
    updateVersion,
    getVersionContent,
  };
}
