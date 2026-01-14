import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ConfigRecord {
  id: string;
  type: string;
  version_name: string;
  content: string | null;
  important_notes: string | null;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConfigVersion {
  id: string;
  name: string;
  timestamp: string;
  isActive?: boolean;
}

// Edge function URL for protected operations
const getProtectConfigUrl = () => {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'nzdgglqvaeibniasozfw';
  return `https://${projectId}.supabase.co/functions/v1/protect-config`;
};

export const useConfigData = () => {
  const [configs, setConfigs] = useState<ConfigRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Fetch all configs from database (READ is still public)
  const fetchConfigs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('config')
        .select('*')
        .eq('is_deleted', false)
        .order('type')
        .order('created_at', { ascending: false })
        .order('version_name', { ascending: false });

      if (error) throw error;
      setConfigs(data || []);
    } catch (error) {
      console.error('Error fetching configs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load configurations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  // Get versions for a specific type
  const getVersionsForType = useCallback((type: string): ConfigVersion[] => {
    return configs
      .filter(c => c.type === type)
      .map(c => ({
        id: c.id,
        name: c.version_name,
        timestamp: new Date(c.created_at).toLocaleString(),
        isActive: c.is_active,
      }));
  }, [configs]);

  // Get config by id
  const getConfigById = useCallback((id: string): ConfigRecord | undefined => {
    return configs.find(c => c.id === id);
  }, [configs]);

  // Get latest version number for a type
  const getLatestVersionNumber = useCallback((type: string): number => {
    const typeConfigs = configs.filter(c => c.type === type);
    if (typeConfigs.length === 0) return 0;
    
    const versions = typeConfigs.map(c => {
      const match = c.version_name.match(/v(\d+)/i);
      if (match) {
        return parseInt(match[1], 10);
      }
      return 0;
    });
    
    return Math.max(...versions);
  }, [configs]);

  // Save/Update config via edge function (requires password)
  const saveConfig = useCallback(async (
    type: string,
    versionName: string,
    content: string,
    importantNotes: string,
    existingId?: string,
    password?: string
  ): Promise<{ success: boolean; needsPassword?: boolean; error?: string }> => {
    if (!password) {
      return { success: false, needsPassword: true };
    }

    try {
      const response = await fetch(getProtectConfigUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: existingId ? 'update' : 'insert',
          password,
          id: existingId,
          type,
          version_name: versionName,
          content,
          important_notes: importantNotes,
          is_active: true,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, error: 'Invalid password' };
        }
        throw new Error(result.error || 'Failed to save');
      }
      
      toast({
        title: existingId ? 'Saved' : 'Created',
        description: `${versionName} ${existingId ? 'saved' : 'created'} successfully`,
      });
      
      await fetchConfigs();
      return { success: true };
    } catch (error) {
      console.error('Error saving config:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save configuration',
        variant: 'destructive',
      });
      return { success: false, error: 'Failed to save configuration' };
    }
  }, [fetchConfigs, toast]);

  // Create new version (requires password)
  const createNewVersion = useCallback(async (
    type: string,
    content: string,
    importantNotes: string,
    displayPrefix: string,
    password?: string
  ): Promise<{ success: boolean; needsPassword?: boolean; error?: string }> => {
    const latestVersion = getLatestVersionNumber(type);
    const newVersionName = `${displayPrefix} v${latestVersion + 1}`;
    
    return saveConfig(type, newVersionName, content, importantNotes, undefined, password);
  }, [getLatestVersionNumber, saveConfig]);

  // Soft delete config via edge function (requires password)
  const deleteConfig = useCallback(async (
    id: string,
    password?: string
  ): Promise<{ success: boolean; needsPassword?: boolean; error?: string }> => {
    // Check if id is a valid UUID (database record) vs sample data id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      toast({
        title: 'Cannot Delete',
        description: 'Sample versions cannot be deleted. Save a version first to create database records.',
        variant: 'destructive',
      });
      return { success: false, error: 'Cannot delete sample data' };
    }

    if (!password) {
      return { success: false, needsPassword: true };
    }

    try {
      const response = await fetch(getProtectConfigUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'delete',
          password,
          id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, error: 'Invalid password' };
        }
        throw new Error(result.error || 'Failed to delete');
      }
      
      toast({
        title: 'Disabled',
        description: 'Configuration disabled successfully',
      });
      
      await fetchConfigs();
      return { success: true };
    } catch (error) {
      console.error('Error deleting config:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete configuration',
        variant: 'destructive',
      });
      return { success: false, error: 'Failed to delete configuration' };
    }
  }, [fetchConfigs, toast]);

  return {
    configs,
    loading,
    getVersionsForType,
    getConfigById,
    getLatestVersionNumber,
    saveConfig,
    createNewVersion,
    deleteConfig,
    refetch: fetchConfigs,
  };
};
