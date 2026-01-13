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

        // Prefer the newest *valid* version (some old versions might only contain params)
        const latestValidVersion = scriptVersions.find(v => {
          const c = v.content || '';
          return (
            typeof c === 'string' &&
            c.includes('schema_version:') &&
            c.includes('dialect:') &&
            c.includes('defs:')
          );
        }) || null;

        const latestVersion = latestValidVersion || scriptVersions[0] || null;

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
      .maybeSingle();

    if (error) {
      console.error('Error fetching dsl_script_version content:', error);
      return null;
    }

    return data?.content || null;
  }, []);

  // Create a new version for a DSL script
  const createDslScriptVersion = useCallback(async (
    dslScriptId: string, 
    versionName: string, 
    content: string
  ): Promise<DslScriptVersion | null> => {
    const { data, error } = await supabase
      .from('dsl_script_version')
      .insert({
        dsl_script_id: dslScriptId,
        version_name: versionName,
        content,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating dsl_script_version:', error);
      return null;
    }

    return data;
  }, []);

  return {
    dslScripts,
    loading,
    fetchDslScriptsForDesc,
    getVersionContent,
    createDslScriptVersion,
  };
}
