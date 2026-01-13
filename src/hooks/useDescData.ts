import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Desc {
  id: string;
  type: 'LODesc' | 'VideoDesc';
  name: string;
  created_at: string;
}

interface DescVersion {
  id: string;
  desc_id: string;
  version_name: string;
  content: string | null;
  created_at: string;
}

interface DescWithLatestVersion extends Desc {
  latestVersionId: string | null;
  latestVersionName: string | null;
  content: string | null;
  versions: DescVersion[];
}

export function useDescData() {
  const [loDescs, setLoDescs] = useState<DescWithLatestVersion[]>([]);
  const [videoDesc, setVideoDesc] = useState<DescWithLatestVersion | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch newest 5 LODesc entries with their versions
  const fetchLoDescs = useCallback(async () => {
    setLoading(true);
    try {
      // Get newest 5 LODesc
      const { data: descs, error: descsError } = await supabase
        .from('desc')
        .select('*')
        .eq('type', 'LODesc')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(5);

      if (descsError) throw descsError;

      if (!descs || descs.length === 0) {
        setLoDescs([]);
        return;
      }

      // Get versions for each desc
      const descsWithVersions: DescWithLatestVersion[] = await Promise.all(
        descs.map(async (desc) => {
          const { data: versions, error: versionsError } = await supabase
            .from('desc_version')
            .select('*')
            .eq('desc_id', desc.id)
            .eq('is_deleted', false)
            .order('created_at', { ascending: false });

          if (versionsError) throw versionsError;

          const latestVersion = versions && versions.length > 0 ? versions[0] : null;

          return {
            ...desc,
            type: desc.type as 'LODesc' | 'VideoDesc',
            latestVersionId: latestVersion?.id || null,
            latestVersionName: latestVersion?.version_name || null,
            content: latestVersion?.content || null,
            versions: versions || [],
          };
        })
      );

      setLoDescs(descsWithVersions);
    } catch (error) {
      console.error('Error fetching LODescs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch newest VideoDesc with its versions
  const fetchVideoDesc = useCallback(async () => {
    setLoading(true);
    try {
      const { data: descs, error: descsError } = await supabase
        .from('desc')
        .select('*')
        .eq('type', 'VideoDesc')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(1);

      if (descsError) throw descsError;

      if (!descs || descs.length === 0) {
        setVideoDesc(null);
        return;
      }

      const desc = descs[0];

      const { data: versions, error: versionsError } = await supabase
        .from('desc_version')
        .select('*')
        .eq('desc_id', desc.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (versionsError) throw versionsError;

      const latestVersion = versions && versions.length > 0 ? versions[0] : null;

      setVideoDesc({
        ...desc,
        type: desc.type as 'LODesc' | 'VideoDesc',
        latestVersionId: latestVersion?.id || null,
        latestVersionName: latestVersion?.version_name || null,
        content: latestVersion?.content || null,
        versions: versions || [],
      });
    } catch (error) {
      console.error('Error fetching VideoDesc:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Get version content by ID
  const getVersionContent = useCallback(async (versionId: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from('desc_version')
      .select('content')
      .eq('id', versionId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching version content:', error);
      return null;
    }

    return data?.content || null;
  }, []);

  return {
    loDescs,
    videoDesc,
    loading,
    fetchLoDescs,
    fetchVideoDesc,
    getVersionContent,
  };
}
