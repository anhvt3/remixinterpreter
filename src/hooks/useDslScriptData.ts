import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DslScript {
  id: string;
  desc_id: string;
  code: string;
  name: string;
  created_at: string;
}

export interface DslScriptVersion {
  id: string;
  dsl_script_id: string;
  version_name: string;
  content: string | null;
  created_at: string;
}

export interface DslScriptWithVersions extends DslScript {
  versions: DslScriptVersion[];
  latestVersionId: string | null;
  latestVersionName: string | null;
}

export function useDslScriptData() {
  const [dslScripts, setDslScripts] = useState<DslScriptWithVersions[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch DSL scripts for a specific desc_id
  const fetchDslScriptsForDesc = useCallback(async (descId: string) => {
    if (!descId) {
      setDslScripts([]);
      return;
    }

    setLoading(true);
    try {
      // Fetch dsl_scripts for the desc
      const { data: scripts, error: scriptsError } = await supabase
        .from('dsl_script')
        .select('*')
        .eq('desc_id', descId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (scriptsError) {
        console.error('Error fetching dsl_scripts:', scriptsError);
        setDslScripts([]);
        return;
      }

      if (!scripts || scripts.length === 0) {
        setDslScripts([]);
        return;
      }

      // Fetch versions for all scripts
      const scriptIds = scripts.map(s => s.id);
      const { data: versions, error: versionsError } = await supabase
        .from('dsl_script_version')
        .select('*')
        .in('dsl_script_id', scriptIds)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .order('version_name', { ascending: false });

      if (versionsError) {
        console.error('Error fetching dsl_script_versions:', versionsError);
      }

      // Map versions to scripts
      const scriptsWithVersions: DslScriptWithVersions[] = scripts.map(script => {
        const scriptVersions = (versions || []).filter(v => v.dsl_script_id === script.id);
        const latestVersion = scriptVersions[0] || null;
        return {
          ...script,
          versions: scriptVersions,
          latestVersionId: latestVersion?.id || null,
          latestVersionName: latestVersion?.version_name || null,
        };
      });

      setDslScripts(scriptsWithVersions);
    } catch (error) {
      console.error('Error in fetchDslScriptsForDesc:', error);
      setDslScripts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Get content for a specific version
  const getVersionContent = useCallback(async (versionId: string): Promise<string | null> => {
    if (!versionId) return null;

    const { data, error } = await supabase
      .from('dsl_script_version')
      .select('content')
      .eq('id', versionId)
      .single();

    if (error) {
      console.error('Error fetching dsl_script_version content:', error);
      return null;
    }

    return data?.content || null;
  }, []);

  return {
    dslScripts,
    loading,
    fetchDslScriptsForDesc,
    getVersionContent,
  };
}
