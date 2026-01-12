import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ConfigRecord {
  id: string;
  type: string;
  version: string;
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

export const useConfigData = () => {
  const [configs, setConfigs] = useState<ConfigRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Fetch all configs from database
  const fetchConfigs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('config')
        .select('*')
        .eq('is_deleted', false)
        .order('type')
        .order('created_at', { ascending: false });

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
        name: `${type} ${c.version}`,
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
      const match = c.version.match(/v(\d+)/);
      if (match) {
        return parseInt(match[1], 10);
      }
      return 0;
    });
    
    return Math.max(...versions);
  }, [configs]);

  // Save/Update config
  const saveConfig = useCallback(async (
    type: string,
    version: string,
    content: string,
    importantNotes: string,
    existingId?: string
  ) => {
    try {
      if (existingId) {
        // Update existing
        const { error } = await supabase
          .from('config')
          .update({
            content,
            important_notes: importantNotes,
          })
          .eq('id', existingId);

        if (error) throw error;
        
        toast({
          title: 'Saved',
          description: `${type} ${version} saved successfully`,
        });
      } else {
        // Insert new
        const { error } = await supabase
          .from('config')
          .insert({
            type,
            version,
            content,
            important_notes: importantNotes,
            is_active: true,
          });

        if (error) throw error;
        
        toast({
          title: 'Created',
          description: `${type} ${version} created successfully`,
        });
      }
      
      await fetchConfigs();
      return true;
    } catch (error) {
      console.error('Error saving config:', error);
      toast({
        title: 'Error',
        description: 'Failed to save configuration',
        variant: 'destructive',
      });
      return false;
    }
  }, [fetchConfigs, toast]);

  // Create new version
  const createNewVersion = useCallback(async (
    type: string,
    content: string,
    importantNotes: string
  ) => {
    const latestVersion = getLatestVersionNumber(type);
    const newVersion = `v${latestVersion + 1}`;
    
    return saveConfig(type, newVersion, content, importantNotes);
  }, [getLatestVersionNumber, saveConfig]);

  // Soft delete config (disable instead of delete)
  const deleteConfig = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('config')
        .update({ is_deleted: true })
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: 'Disabled',
        description: 'Configuration disabled successfully',
      });
      
      await fetchConfigs();
      return true;
    } catch (error) {
      console.error('Error deleting config:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete configuration',
        variant: 'destructive',
      });
      return false;
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
