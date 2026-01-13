import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CodePanel } from './CodePanel';
import { SourcePanel } from './SourcePanel';
import { DescPanel } from './DescPanel';
import { ChatPanel } from './ChatPanel';
import { ConfigPanel, CONFIG_SUBTABS } from './ConfigPanel';
import { AnimPanelWithControls } from './AnimPanelWithControls';
import { YAMLScriptPanel, DEFAULT_DSL_PANEL_STATE, type DSLPanelState } from './YAMLScriptPanel';
import { RuntimePanel, type RuntimeStep } from './RuntimePanel';
import { usePanelExpansion, PanelSelector, PanelContentArea, type PanelId } from './CollapsiblePanelLayout';
import { loadYAML } from '../core/yamlLoader';
import { validateSchema } from '../core/schemaValidator';
import { executeWithTrace, type CallChainEntry } from '../core/runtimeTracer';
import type { TimelineEvent, YAMLSpec, Params } from '../core/types';
import exampleYaml from '../fixtures/example.yaml?raw';
import yaml from 'js-yaml';
import { useLoData } from '@/hooks/useLoData';
import { useDescData } from '@/hooks/useDescData';
import { useDslScriptData } from '@/hooks/useDslScriptData';
import { useVideoData } from '@/hooks/useVideoData';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { useActivityLog } from '@/contexts/ActivityLogContext';
import { useMissingFunctions } from '@/contexts/MissingFunctionsContext';
import { setMissingFunctionCallback, setActivityLogCallback, clearReportedFunctions } from '@/core/missingFunctionRegistry';
// Extract only the params section from the full YAML
function extractParams(fullYaml: string): string {
  try {
    const spec = yaml.load(fullYaml) as YAMLSpec;
    return yaml.dump({ params: spec.params }, { indent: 2, lineWidth: -1 });
  } catch {
    return '# Error parsing YAML';
  }
}

// Check if content is a complete spec (has defs, entry, etc.) vs just params
function isCompleteSpec(content: string): boolean {
  try {
    const obj = yaml.load(content) as Record<string, unknown>;
    // A complete spec has defs and entry (or at minimum schema_version/dialect)
    return obj && typeof obj === 'object' && ('defs' in obj || 'entry' in obj || 'schema_version' in obj);
  } catch {
    return false;
  }
}

// Merge edited params back into the full spec, OR use content directly if it's a complete spec
function mergeParams(fullYaml: string, editedContent: string): string {
  try {
    // If the edited content is a complete spec, use it directly
    if (isCompleteSpec(editedContent)) {
      return editedContent;
    }
    
    // Otherwise, merge just the params
    const fullSpec = yaml.load(fullYaml) as YAMLSpec;
    const paramsObj = yaml.load(editedContent) as { params: YAMLSpec['params'] };
    fullSpec.params = paramsObj.params;
    return yaml.dump(fullSpec, { indent: 2, lineWidth: -1 });
  } catch {
    return fullYaml; // Return original if merge fails
  }
}

// Chat Panel - Chat interface (re-exported for clarity)
// Already exported from ChatPanel.tsx

// ============================================================
// MAIN APP COMPONENT
// ============================================================

export const App: React.FC = () => {
  // Activity log - must be near top for use in all handlers
  const { addLog } = useActivityLog();
  
  // Missing functions tracking
  const { addMissingFunction, clearMissingFunctions } = useMissingFunctions();
  
  // Connect the missing function registry to React context
  useEffect(() => {
    setMissingFunctionCallback((name, type, calledFrom) => {
      addMissingFunction(name, type, calledFrom);
    });
    setActivityLogCallback((level, source, message) => {
      addLog(level as 'info' | 'warning' | 'error' | 'success', source, message);
    });
    
    return () => {
      setMissingFunctionCallback(null);
      setActivityLogCallback(null);
    };
  }, [addMissingFunction, addLog]);

  const [fullYamlContent, setFullYamlContent] = useState(exampleYaml);
  // Keep a last-known-good full YAML to recover if a bad version is selected/saved
  const lastValidFullYamlRef = useRef<string>(exampleYaml);

  const [loCode, setLoCode] = useState('');
  const [loContent, setLoContent] = useState('');
  const [gdriveLink, setGdriveLink] = useState('');
  const [sourceActiveTab, setSourceActiveTab] = useState<'lo' | 'video'>('lo');
  const [descContents, setDescContents] = useState<string[]>(['', '', '', '', '', '']); // 5 LODesc + 1 VideoDesc
  const [descVideoLink, setDescVideoLink] = useState('');
  
  // Desc data management
  const { loDescs, videoDesc, fetchLoDescs, fetchVideoDesc, getVersionContent: getDescVersionContent, createDescVersion, createDesc, deleteDesc } = useDescData();
  const [selectedDescVersionIds, setSelectedDescVersionIds] = useState<(string | null)[]>([null, null, null, null, null, null]);
  
  // Track original desc contents for unsaved changes detection
  const originalDescContentsRef = useRef<string[]>(['', '', '', '', '', '']);
  
  // Currently active desc tab index (0-4 for LODesc, 5 for VideoDesc)
  const [activeDescTabIndex, setActiveDescTabIndex] = useState(0);
  
  // Undo/Redo for Desc content (for active tab)
  const {
    undo: handleDescUndo,
    redo: handleDescRedo,
    canUndo: canUndoDesc,
    canRedo: canRedoDesc,
    reset: resetDescUndoRedo,
  } = useUndoRedo(descContents[activeDescTabIndex] || '', (value) => {
    setDescContents(prev => {
      const newContents = [...prev];
      newContents[activeDescTabIndex] = value;
      return newContents;
    });
  });
  
  // Detect unsaved desc changes
  const hasUnsavedDescChanges = useMemo(() => {
    return descContents.some((content, index) => content !== originalDescContentsRef.current[index]);
  }, [descContents]);
  
  // Fetch desc data on mount
  useEffect(() => {
    fetchLoDescs();
    fetchVideoDesc();
  }, [fetchLoDescs, fetchVideoDesc]);
  
  // Auto-select latest versions when descs are loaded
  useEffect(() => {
    const newVersionIds: (string | null)[] = [...selectedDescVersionIds];
    let hasChanges = false;
    
    // Set latest versions for LODescs (indices 0-4)
    loDescs.forEach((desc, index) => {
      if (desc.latestVersionId && !selectedDescVersionIds[index]) {
        newVersionIds[index] = desc.latestVersionId;
        hasChanges = true;
      }
    });
    
    // Set latest version for VideoDesc (index 5)
    if (videoDesc?.latestVersionId && !selectedDescVersionIds[5]) {
      newVersionIds[5] = videoDesc.latestVersionId;
      hasChanges = true;
    }
    
    if (hasChanges) {
      setSelectedDescVersionIds(newVersionIds);
    }
  }, [loDescs, videoDesc]);
  
  // Load content when version selection changes
  useEffect(() => {
    const loadContents = async () => {
      const newContents = [...descContents];
      const newOriginals = [...originalDescContentsRef.current];
      let hasChanges = false;
      
      for (let i = 0; i < 6; i++) {
        const versionId = selectedDescVersionIds[i];
        if (versionId) {
          const content = await getDescVersionContent(versionId);
          if (content !== null && content !== descContents[i]) {
            newContents[i] = content;
            newOriginals[i] = content;
            hasChanges = true;
          }
        }
      }
      
      if (hasChanges) {
        setDescContents(newContents);
        originalDescContentsRef.current = newOriginals;
      }
    };
    
    loadContents();
  }, [selectedDescVersionIds, getDescVersionContent]);
  
  // Handle desc version selection
  const handleSelectDescVersion = useCallback(async (tabIndex: number, versionId: string | null) => {
    setSelectedDescVersionIds(prev => {
      const newIds = [...prev];
      newIds[tabIndex] = versionId;
      return newIds;
    });
    setActiveDescTabIndex(tabIndex);
    
    if (versionId) {
      const content = await getDescVersionContent(versionId);
      const contentValue = content || '';
      setDescContents(prev => {
        const newContents = [...prev];
        newContents[tabIndex] = contentValue;
        return newContents;
      });
      originalDescContentsRef.current[tabIndex] = contentValue;
      resetDescUndoRedo(contentValue);
    }
  }, [getDescVersionContent, resetDescUndoRedo]);
  
  // Get currently active desc based on tab
  const getActiveDesc = useCallback(() => {
    if (activeDescTabIndex === 5) {
      return videoDesc;
    }
    return loDescs[activeDescTabIndex] || null;
  }, [activeDescTabIndex, loDescs, videoDesc]);
  
  // Save desc: create a new version
  const handleSaveDesc = useCallback(async () => {
    const activeDesc = getActiveDesc();
    if (!activeDesc || !hasUnsavedDescChanges) return;
    
    // Calculate next version number
    const nextVersion = (activeDesc.versions?.length || 0) + 1;
    const versionName = `v${nextVersion}`;
    
    addLog('info', 'Desc', `Saving ${activeDesc.name}...`);
    
    const newVersion = await createDescVersion(activeDesc.id, versionName, descContents[activeDescTabIndex]);
    if (newVersion) {
      // Update selected version and original content
      setSelectedDescVersionIds(prev => {
        const newIds = [...prev];
        newIds[activeDescTabIndex] = newVersion.id;
        return newIds;
      });
      originalDescContentsRef.current[activeDescTabIndex] = descContents[activeDescTabIndex];
      
      // Refresh desc data to get updated versions
      if (activeDescTabIndex === 5) {
        fetchVideoDesc();
      } else {
        fetchLoDescs();
      }
      addLog('success', 'Desc', `Saved ${activeDesc.name} as ${versionName}`);
    } else {
      addLog('error', 'Desc', `Failed to save ${activeDesc.name}`);
    }
  }, [getActiveDesc, hasUnsavedDescChanges, createDescVersion, descContents, activeDescTabIndex, fetchLoDescs, fetchVideoDesc, addLog]);
  
  // Create new desc
  const handleCreateDesc = useCallback(async () => {
    const type = sourceActiveTab === 'video' ? 'VideoDesc' : 'LODesc';
    const name = type === 'VideoDesc' ? `Video Desc ${Date.now()}` : `LO Desc ${loDescs.length + 1}`;
    
    const newDesc = await createDesc(type, name);
    if (newDesc) {
      // Create initial version
      await createDescVersion(newDesc.id, 'v1', '');
      
      // Refresh data
      if (type === 'VideoDesc') {
        fetchVideoDesc();
      } else {
        fetchLoDescs();
      }
    }
  }, [sourceActiveTab, loDescs.length, createDesc, createDescVersion, fetchLoDescs, fetchVideoDesc]);
  
  // Delete current desc
  const handleDeleteDesc = useCallback(async () => {
    const activeDesc = getActiveDesc();
    if (!activeDesc) return;
    
    const confirmed = window.confirm(`Are you sure you want to delete "${activeDesc.name}"?`);
    if (!confirmed) return;
    
    const success = await deleteDesc(activeDesc.id);
    if (success) {
      // Clear content and reset
      setDescContents(prev => {
        const newContents = [...prev];
        newContents[activeDescTabIndex] = '';
        return newContents;
      });
      originalDescContentsRef.current[activeDescTabIndex] = '';
      setSelectedDescVersionIds(prev => {
        const newIds = [...prev];
        newIds[activeDescTabIndex] = null;
        return newIds;
      });
      
      // Refresh data
      if (activeDescTabIndex === 5) {
        fetchVideoDesc();
      } else {
        fetchLoDescs();
      }
    }
  }, [getActiveDesc, deleteDesc, activeDescTabIndex, fetchLoDescs, fetchVideoDesc]);

  // DSL Script data management
  const { dslScripts, fetchDslScriptsForDesc, getVersionContent: getDslVersionContent, createDslScriptVersion } = useDslScriptData();
  const [selectedDslVersionId, setSelectedDslVersionId] = useState<string | null>(null);

  // Get the currently active desc ID based on sourceActiveTab and selected desc
  const activeDescId = useMemo(() => {
    if (sourceActiveTab === 'video') {
      return videoDesc?.id || null;
    } else {
      // For LO tab, get the first LODesc that's selected (index 0)
      const firstLoDesc = loDescs[0];
      return firstLoDesc?.id || null;
    }
  }, [sourceActiveTab, loDescs, videoDesc]);

  // Fetch DSL scripts when active desc changes
  useEffect(() => {
    if (activeDescId) {
      fetchDslScriptsForDesc(activeDescId);
      setSelectedDslVersionId(null); // Reset selection when desc changes
    }
  }, [activeDescId, fetchDslScriptsForDesc]);

  // Auto-select latest DSL version when scripts are loaded
  useEffect(() => {
    if (dslScripts.length > 0 && !selectedDslVersionId) {
      const firstScript = dslScripts[0];
      if (firstScript?.latestVersionId) {
        setSelectedDslVersionId(firstScript.latestVersionId);
      }
    }
  }, [dslScripts, selectedDslVersionId]);

  // Load DSL content when version selection changes
  useEffect(() => {
    const isValidDslYaml = (text: string): boolean => {
      try {
        const spec = loadYAML(text);
        const validation = validateSchema(spec);
        return validation.valid;
      } catch {
        return false;
      }
    };

    const loadDslContent = async () => {
      if (!selectedDslVersionId) return;

      const content = await getDslVersionContent(selectedDslVersionId);
      if (!content) return;

      // Guard against accidentally loading/saving a params-only version
      if (isValidDslYaml(content)) {
        setFullYamlContent(content);
        return;
      }

      // Fallback: pick the newest valid version we have locally
      const firstScript = dslScripts[0];
      const fallback = firstScript?.versions.find(v => {
        const c = v.content || '';
        return typeof c === 'string' && c.includes('schema_version:') && c.includes('dialect:') && c.includes('defs:');
      });

      if (fallback && fallback.id !== selectedDslVersionId) {
        setSelectedDslVersionId(fallback.id);
        if (fallback.content) setFullYamlContent(fallback.content);
        return;
      }

      // Last resort: restore last known good YAML
      if (lastValidFullYamlRef.current) {
        setFullYamlContent(lastValidFullYamlRef.current);
      }
    };

    loadDslContent();
  }, [selectedDslVersionId, getDslVersionContent, dslScripts]);

  // Handle DSL version selection
  const handleSelectDslVersion = useCallback((versionId: string | null) => {
    setSelectedDslVersionId(versionId);
  }, []);

  // Save DSL script: create a new version and trigger rebuild
  const handleSaveDslVersion = useCallback(async (paramsContent: string) => {
    // Get the current script ID
    const currentScript = dslScripts[0];
    if (!currentScript) {
      addLog('error', 'DSLScript', 'No script found to save');
      return;
    }

    addLog('info', 'DSLScript', 'Saving new version...');

    // Merge the edited params back into a valid full YAML base
    const baseYaml = lastValidFullYamlRef.current || fullYamlContent;
    const fullContent = mergeParams(baseYaml, paramsContent);

    // Calculate next version number
    const nextVersion = currentScript.versions.length + 1;
    const versionName = `v${nextVersion}`;

    try {
      // Create new version with the FULL merged content
      const newVersion = await createDslScriptVersion(currentScript.id, versionName, fullContent);
      if (newVersion) {
        // Update content immediately (triggers rebuild via useEffect)
        setFullYamlContent(fullContent);
        // Refresh the versions list
        if (activeDescId) {
          await fetchDslScriptsForDesc(activeDescId);
        }
        // Select the new version
        setSelectedDslVersionId(newVersion.id);
        addLog('success', 'DSLScript', `Saved as ${versionName}`);
      } else {
        addLog('error', 'DSLScript', 'Failed to create version');
      }
    } catch (err) {
      addLog('error', 'DSLScript', `Save failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      throw err;
    }
  }, [dslScripts, createDslScriptVersion, activeDescId, fetchDslScriptsForDesc, fullYamlContent, addLog]);
  
  // LO data management
  const { los, versions, fetchVersionsForLo, getVersionContent, createLo, deleteLo, createVersion, fetchLos } = useLoData();
  const [selectedLoId, setSelectedLoId] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  
  // Track the original content for unsaved changes detection
  const originalLoContentRef = useRef<string>('');
  
  // Undo/Redo for LO content
  const {
    value: loContentUndoable,
    setValue: setLoContentUndoable,
    undo: handleUndo,
    redo: handleRedo,
    canUndo,
    canRedo,
    reset: resetUndoRedo,
  } = useUndoRedo(loContent, setLoContent);
  
  // Auto-select latest LO and version when LOs are loaded
  useEffect(() => {
    if (los.length > 0 && !selectedLoId) {
      // Select the last LO (most recently created based on code order)
      const latestLo = los[los.length - 1];
      setSelectedLoId(latestLo.id);
      setLoCode(latestLo.code);
      fetchVersionsForLo(latestLo.id);
    }
  }, [los, selectedLoId, fetchVersionsForLo]);
  
  // Auto-select latest version when versions are loaded for a new LO selection
  useEffect(() => {
    if (versions.length > 0 && selectedLoId && !selectedVersionId) {
      // versions are already ordered by created_at desc, so first is latest
      const latestVersion = versions[0];
      setSelectedVersionId(latestVersion.id);
      getVersionContent(latestVersion.id).then(content => {
        const contentValue = content || '';
        setLoContent(contentValue);
        originalLoContentRef.current = contentValue;
        resetUndoRedo(contentValue);
      });
    }
  }, [versions, selectedLoId, selectedVersionId, getVersionContent, resetUndoRedo]);
  
  // Detect unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    return loContent !== originalLoContentRef.current && selectedLoId !== null;
  }, [loContent, selectedLoId]);
  
  // When LO selection changes, fetch versions and update loCode
  const handleSelectLo = useCallback(async (loId: string | null) => {
    setSelectedLoId(loId);
    setSelectedVersionId(null);
    
    if (loId) {
      const selectedLo = los.find(lo => lo.id === loId);
      if (selectedLo) {
        setLoCode(selectedLo.code);
      }
      await fetchVersionsForLo(loId);
    } else {
      setLoCode('');
      setLoContent('');
      originalLoContentRef.current = '';
      resetUndoRedo('');
    }
  }, [los, fetchVersionsForLo, resetUndoRedo]);
  
  // When version selection changes, load content
  const handleSelectVersion = useCallback(async (versionId: string | null) => {
    setSelectedVersionId(versionId);
    
    if (versionId) {
      const content = await getVersionContent(versionId);
      const contentValue = content || '';
      setLoContent(contentValue);
      originalLoContentRef.current = contentValue;
      resetUndoRedo(contentValue);
    } else {
      setLoContent('');
      originalLoContentRef.current = '';
      resetUndoRedo('');
    }
  }, [getVersionContent, resetUndoRedo]);
  
  // Create new LO with version 1
  const handleCreateNewLo = useCallback(async () => {
    const code = `LO${String(los.length + 1).padStart(3, '0')}`;
    const name = `New LO ${los.length + 1}`;
    
    const newLo = await createLo(code, name);
    if (newLo) {
      // Create version 1 with empty content
      await createVersion(newLo.id, 'v1', '');
      // Select the new LO
      setSelectedLoId(newLo.id);
      setLoCode(newLo.code);
      await fetchVersionsForLo(newLo.id);
      // Auto-select the first version
      const { data } = await import('@/integrations/supabase/client').then(m => 
        m.supabase.from('lo_version').select('id').eq('lo_id', newLo.id).eq('is_deleted', false).order('created_at', { ascending: false }).limit(1).single()
      );
      if (data) {
        setSelectedVersionId(data.id);
        setLoContent('');
        originalLoContentRef.current = '';
        resetUndoRedo('');
      }
    }
  }, [los, createLo, createVersion, fetchVersionsForLo, resetUndoRedo]);
  
  // Delete current LO
  const handleDeleteLo = useCallback(async () => {
    if (!selectedLoId) return;
    
    const confirmed = window.confirm('Are you sure you want to delete this LO?');
    if (!confirmed) return;
    
    const success = await deleteLo(selectedLoId);
    if (success) {
      setSelectedLoId(null);
      setSelectedVersionId(null);
      setLoCode('');
      setLoContent('');
      originalLoContentRef.current = '';
      resetUndoRedo('');
    }
  }, [selectedLoId, deleteLo, resetUndoRedo]);
  
  // Save: create a new version of the current LO
  const handleSave = useCallback(async () => {
    if (!selectedLoId || !hasUnsavedChanges) return;
    
    // Calculate next version number
    const nextVersion = versions.length + 1;
    const versionName = `v${nextVersion}`;
    
    addLog('info', 'Source', `Saving LO ${loCode}...`);
    
    const newVersion = await createVersion(selectedLoId, versionName, loContent);
    if (newVersion) {
      setSelectedVersionId(newVersion.id);
      originalLoContentRef.current = loContent;
      addLog('success', 'Source', `Saved LO ${loCode} as ${versionName}`);
    } else {
      addLog('error', 'Source', `Failed to save LO ${loCode}`);
    }
  }, [selectedLoId, hasUnsavedChanges, versions, createVersion, loContent, loCode, addLog]);
  
  // ============================================================
  // VIDEO DATA MANAGEMENT
  // ============================================================
  
  const { 
    videos, 
    videoVersions, 
    fetchVersionsForVideo, 
    getVideoVersionContent, 
    createVideo, 
    deleteVideo: deleteVideoRecord, 
    createVideoVersion 
  } = useVideoData();
  
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [selectedVideoVersionId, setSelectedVideoVersionId] = useState<string | null>(null);
  
  // Track if we just created a new video (to enable save button)
  const [isNewVideoRecord, setIsNewVideoRecord] = useState(false);
  
  // Track original gdriveLink for unsaved changes detection
  const originalGdriveLinkRef = useRef<string>('');
  
  // Undo/Redo for Video gdriveLink
  const {
    setValue: setGdriveLinkUndoable,
    undo: handleVideoUndo,
    redo: handleVideoRedo,
    canUndo: canVideoUndo,
    canRedo: canVideoRedo,
    reset: resetVideoUndoRedo,
  } = useUndoRedo(gdriveLink, setGdriveLink);
  
  // Auto-select first video when videos are loaded
  useEffect(() => {
    if (videos.length > 0 && !selectedVideoId) {
      const firstVideo = videos[0];
      setSelectedVideoId(firstVideo.id);
      fetchVersionsForVideo(firstVideo.id);
    }
  }, [videos, selectedVideoId, fetchVersionsForVideo]);
  
  // Auto-select latest version when versions are loaded for a new Video selection
  useEffect(() => {
    if (videoVersions.length > 0 && selectedVideoId && !selectedVideoVersionId) {
      const latestVersion = videoVersions[0];
      setSelectedVideoVersionId(latestVersion.id);
      getVideoVersionContent(latestVersion.id).then(content => {
        const contentValue = content || '';
        setGdriveLink(contentValue);
        originalGdriveLinkRef.current = contentValue;
        resetVideoUndoRedo(contentValue);
      });
    }
  }, [videoVersions, selectedVideoId, selectedVideoVersionId, getVideoVersionContent, resetVideoUndoRedo]);
  
  // Detect unsaved video changes: enabled when gdriveLink changed OR a new record was created
  const hasUnsavedVideoChanges = useMemo(() => {
    const hasLinkChanged = gdriveLink !== originalGdriveLinkRef.current;
    return (hasLinkChanged || isNewVideoRecord) && selectedVideoId !== null;
  }, [gdriveLink, selectedVideoId, isNewVideoRecord]);
  
  // When Video selection changes, fetch versions
  const handleSelectVideo = useCallback(async (videoId: string | null) => {
    setSelectedVideoId(videoId);
    setSelectedVideoVersionId(null);
    // Reset new record flag when selecting a different video
    setIsNewVideoRecord(false);
    
    if (videoId) {
      await fetchVersionsForVideo(videoId);
    } else {
      setGdriveLink('');
      originalGdriveLinkRef.current = '';
      resetVideoUndoRedo('');
    }
  }, [fetchVersionsForVideo, resetVideoUndoRedo]);
  
  // When video version selection changes, load content
  const handleSelectVideoVersion = useCallback(async (versionId: string | null) => {
    setSelectedVideoVersionId(versionId);
    
    if (versionId) {
      const content = await getVideoVersionContent(versionId);
      const contentValue = content || '';
      setGdriveLink(contentValue);
      originalGdriveLinkRef.current = contentValue;
      resetVideoUndoRedo(contentValue);
    } else {
      setGdriveLink('');
      originalGdriveLinkRef.current = '';
      resetVideoUndoRedo('');
    }
  }, [getVideoVersionContent, resetVideoUndoRedo]);
  
  // Create new Video with version 1
  const handleCreateNewVideo = useCallback(async () => {
    const code = `VID${String(videos.length + 1).padStart(3, '0')}`;
    const name = `New Video ${videos.length + 1}`;
    
    const newVideo = await createVideo(code, name);
    if (newVideo) {
      // Create version 1 with empty content
      await createVideoVersion(newVideo.id, 'v1', '');
      // Select the new Video
      setSelectedVideoId(newVideo.id);
      await fetchVersionsForVideo(newVideo.id);
      // Auto-select the first version
      const { data } = await import('@/integrations/supabase/client').then(m => 
        m.supabase.from('video_version').select('id').eq('video_id', newVideo.id).eq('is_deleted', false).order('created_at', { ascending: false }).limit(1).single()
      );
      if (data) {
        setSelectedVideoVersionId(data.id);
        setGdriveLink('');
        originalGdriveLinkRef.current = '';
        resetVideoUndoRedo('');
        // Mark as new record so Save button is enabled
        setIsNewVideoRecord(true);
      }
    }
  }, [videos, createVideo, createVideoVersion, fetchVersionsForVideo, resetVideoUndoRedo]);
  
  // Delete current Video
  const handleDeleteVideo = useCallback(async () => {
    if (!selectedVideoId) return;
    
    const confirmed = window.confirm('Are you sure you want to delete this Video?');
    if (!confirmed) return;
    
    const success = await deleteVideoRecord(selectedVideoId);
    if (success) {
      setSelectedVideoId(null);
      setSelectedVideoVersionId(null);
      setGdriveLink('');
      originalGdriveLinkRef.current = '';
      resetVideoUndoRedo('');
    }
  }, [selectedVideoId, deleteVideoRecord, resetVideoUndoRedo]);
  
  // Save: create a new version of the current Video
  const handleVideoSave = useCallback(async () => {
    if (!selectedVideoId || !hasUnsavedVideoChanges) return;
    
    // Calculate next version number
    const nextVersion = videoVersions.length + 1;
    const versionName = `v${nextVersion}`;
    
    const newVersion = await createVideoVersion(selectedVideoId, versionName, gdriveLink);
    if (newVersion) {
      setSelectedVideoVersionId(newVersion.id);
      originalGdriveLinkRef.current = gdriveLink;
      // Reset new record flag after saving
      setIsNewVideoRecord(false);
    }
  }, [selectedVideoId, hasUnsavedVideoChanges, videoVersions, createVideoVersion, gdriveLink]);
  
  // Config tab password protection
  const [configAuthenticated, setConfigAuthenticated] = useState(false);
  const [configPassword, setConfigPassword] = useState('');
  const [configPasswordError, setConfigPasswordError] = useState(false);
  const CONFIG_PASSWORD = 'tuan123';
  
  const handleConfigPasswordSubmit = () => {
    if (configPassword === CONFIG_PASSWORD) {
      setConfigAuthenticated(true);
      setConfigPasswordError(false);
    } else {
      setConfigPasswordError(true);
    }
  };
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [runtimeSteps, setRuntimeSteps] = useState<RuntimeStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [parsedSpec, setParsedSpec] = useState<YAMLSpec | null>(null);
  const [elementCallChains, setElementCallChains] = useState<Map<string, CallChainEntry[]>>(new Map());
  const [stepCallChains, setStepCallChains] = useState<Map<string, CallChainEntry[]>>(new Map());
  const [stepCreatedElements, setStepCreatedElements] = useState<Map<string, string[]>>(new Map());
  const [selectedRuntimeStepId, setSelectedRuntimeStepId] = useState<string | null>(null);
  const [selectedStatement, setSelectedStatement] = useState<{ fnName: string; stmtIndex: number } | null>(null);
  const [selectedFunctionDefinition, setSelectedFunctionDefinition] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [activeTab, setActiveTab] = useState('editing');
  const [activeConfigSubtab, setActiveConfigSubtab] = useState('IRF-IR-FUNCTIONS');

  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev + 10, 150));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev - 10, 50));
  }, []);
  // Persistent DSL panel state (survives tab switches)
  const [dslPanelState, setDslPanelState] = useState<DSLPanelState>(DEFAULT_DSL_PANEL_STATE);
  
  // Extract editable params from full YAML
  const paramsContent = useMemo(() => extractParams(fullYamlContent), [fullYamlContent]);
  
  
  // Handle params changes by merging back into a valid full YAML base (from code editor)
  // This triggers a rebuild of TreeView, Runtime, and Anim via the fullYamlContent useEffect
  const handleParamsChange = useCallback((newParams: string) => {
    try {
      const baseYaml = lastValidFullYamlRef.current || fullYamlContent;
      const fullSpec = yaml.load(baseYaml) as YAMLSpec;
      const paramsObj = yaml.load(newParams) as { params: YAMLSpec['params'] };
      fullSpec.params = paramsObj.params;
      const merged = yaml.dump(fullSpec, { indent: 2, lineWidth: -1 });
      setFullYamlContent(merged);
    } catch (e) {
      console.error('Failed to merge params:', e);
    }
  }, [fullYamlContent]);
  
  // Handle params object changes (from tree view editor)
  const handleParamsObjectChange = (newParams: Params) => {
    try {
      const baseYaml = lastValidFullYamlRef.current || fullYamlContent;
      const fullSpec = yaml.load(baseYaml) as YAMLSpec;
      fullSpec.params = newParams;
      setFullYamlContent(yaml.dump(fullSpec, { indent: 2, lineWidth: -1 }));
    } catch (e) {
      console.error('Failed to update params:', e);
    }
  };
  
  // Handle function args changes (from tree view editor)
  const handleFunctionArgsChange = (fnName: string, stmtIndex: number, newArgs: Record<string, unknown>) => {
    try {
      const fullSpec = yaml.load(fullYamlContent) as YAMLSpec;
      if (fullSpec.defs && fullSpec.defs[fnName]) {
        const stmt = fullSpec.defs[fnName].body[stmtIndex];
        if (stmt) {
          if ('call' in stmt) {
            stmt.call.args = newArgs;
          } else if ('let' in stmt) {
            // newArgs is actually the new let statement
            (stmt as { let: Record<string, unknown> }).let = newArgs;
          } else if ('ir' in stmt) {
            stmt.ir.args = newArgs;
          }
          setFullYamlContent(yaml.dump(fullSpec, { indent: 2, lineWidth: -1 }));
        }
      }
    } catch (e) {
      console.error('Failed to update function args:', e);
    }
  };
  
  
  // Parse and execute YAML whenever it changes
  useEffect(() => {
    // Clear previously reported missing functions before rebuild
    clearReportedFunctions();
    clearMissingFunctions();
    
    try {
      const spec = loadYAML(fullYamlContent);
      setParsedSpec(spec);
      const validation = validateSchema(spec);
      
      if (!validation.valid) {
        const errorMsg = validation.errors.join('\n');
        setError(errorMsg);
        addLog('error', 'Runtime', `Schema validation failed: ${validation.errors[0]}`);
        return;
      }
      
      const result = executeWithTrace(spec);
      setEvents(result.timeline);
      setRuntimeSteps(result.steps);
      setElementCallChains(result.elementCallChains);
      setStepCallChains(result.stepCallChains);
      setStepCreatedElements(result.stepCreatedElements);
      setError(null);
      addLog('success', 'Runtime', `Built ${result.timeline.length} events, ${result.steps.length} steps`);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      setError(errorMsg);
      setParsedSpec(null);
      setRuntimeSteps([]);
      setElementCallChains(new Map());
      setStepCallChains(new Map());
      setStepCreatedElements(new Map());
      addLog('error', 'Runtime', `Build failed: ${errorMsg}`);
    }
  }, [fullYamlContent, addLog]);

  // Get call chain for the selected element (when clicking Anim panel)
  const selectedElementCallChain = useMemo(() => {
    if (!selectedElementId) return null;
    return elementCallChains.get(selectedElementId) || null;
  }, [selectedElementId, elementCallChains]);

  // Get call chain for the selected runtime step (when clicking Runtime panel)
  const selectedStepCallChain = useMemo(() => {
    if (!selectedRuntimeStepId) return null;
    return stepCallChains.get(selectedRuntimeStepId) || null;
  }, [selectedRuntimeStepId, stepCallChains]);

  // Get element IDs created by selected runtime step (for Anim panel highlighting)
  // Recursively collect elements from the step and all its children
  const highlightedElementIds = useMemo(() => {
    if (!selectedRuntimeStepId) return [];
    
    // Find the step by ID recursively
    const findStep = (steps: RuntimeStep[], id: string): RuntimeStep | null => {
      for (const step of steps) {
        if (step.id === id) return step;
        if (step.children) {
          const found = findStep(step.children, id);
          if (found) return found;
        }
      }
      return null;
    };
    
    // Collect all element IDs from a step and its descendants
    const collectElements = (step: RuntimeStep): string[] => {
      const ids: string[] = [...(step.createdElementIds || [])];
      if (step.children) {
        for (const child of step.children) {
          ids.push(...collectElements(child));
        }
      }
      return ids;
    };
    
    const selectedStep = findStep(runtimeSteps, selectedRuntimeStepId);
    if (!selectedStep) return [];
    
    return collectElements(selectedStep);
  }, [selectedRuntimeStepId, runtimeSteps]);

  // Find runtime step IDs matching the selected statement
  const highlightedStepIdsFromStatement = useMemo(() => {
    if (!selectedStatement) return [];
    
    const matchingStepIds: string[] = [];
    
    // Debug: log what we're looking for
    console.log('Looking for statement:', selectedStatement);
    console.log('stepCallChains size:', stepCallChains.size);
    
    // Check each step's call chain to see if it was created by the selected statement
    stepCallChains.forEach((callChain, stepId) => {
      // callChain is ordered innermost first - check if any entry matches
      const matches = callChain.some(
        entry => entry.fnName === selectedStatement.fnName && entry.stmtIndex === selectedStatement.stmtIndex
      );
      if (matches) {
        matchingStepIds.push(stepId);
        console.log('Match found:', stepId, 'chain:', callChain);
      }
    });
    
    console.log('Total matches:', matchingStepIds.length);
    return matchingStepIds;
  }, [selectedStatement, stepCallChains]);

  // Collect element IDs from highlighted steps AND their children recursively
  // This ensures all elements created by a statement and its called statements are highlighted
  const highlightedElementIdsFromStatement = useMemo(() => {
    if (!selectedStatement || highlightedStepIdsFromStatement.length === 0) return [];
    
    // Find step by ID recursively
    const findStep = (steps: RuntimeStep[], id: string): RuntimeStep | null => {
      for (const step of steps) {
        if (step.id === id) return step;
        if (step.children) {
          const found = findStep(step.children, id);
          if (found) return found;
        }
      }
      return null;
    };
    
    // Collect all element IDs from a step and its descendants
    const collectElements = (step: RuntimeStep): string[] => {
      const ids: string[] = [...(step.createdElementIds || [])];
      if (step.children) {
        for (const child of step.children) {
          ids.push(...collectElements(child));
        }
      }
      return ids;
    };
    
    const elementIds: string[] = [];
    for (const stepId of highlightedStepIdsFromStatement) {
      // Get elements directly from stepCreatedElements map
      const directElements = stepCreatedElements.get(stepId);
      if (directElements) {
        elementIds.push(...directElements);
      }
      
      // Also recursively collect from children
      const step = findStep(runtimeSteps, stepId);
      if (step) {
        elementIds.push(...collectElements(step));
      }
    }
    return [...new Set(elementIds)];
  }, [selectedStatement, highlightedStepIdsFromStatement, stepCreatedElements, runtimeSteps]);

  // Find runtime step IDs matching all calls to the selected function definition
  const highlightedStepIdsFromFunctionDef = useMemo(() => {
    if (!selectedFunctionDefinition) return [];
    
    const matchingStepIds: string[] = [];
    
    // Check each step's call chain to see if it involves a call to the selected function
    stepCallChains.forEach((callChain, stepId) => {
      // Check if any entry in the call chain is a call to the selected function
      const matches = callChain.some(entry => entry.fnName === selectedFunctionDefinition);
      if (matches) {
        matchingStepIds.push(stepId);
      }
    });
    
    return matchingStepIds;
  }, [selectedFunctionDefinition, stepCallChains]);

  // Collect element IDs from highlighted steps for function definition click (recursive)
  const highlightedElementIdsFromFunctionDef = useMemo(() => {
    if (!selectedFunctionDefinition || highlightedStepIdsFromFunctionDef.length === 0) return [];
    
    // Find step by ID recursively
    const findStep = (steps: RuntimeStep[], id: string): RuntimeStep | null => {
      for (const step of steps) {
        if (step.id === id) return step;
        if (step.children) {
          const found = findStep(step.children, id);
          if (found) return found;
        }
      }
      return null;
    };
    
    // Collect all element IDs from a step and its descendants
    const collectElements = (step: RuntimeStep): string[] => {
      const ids: string[] = [...(step.createdElementIds || [])];
      if (step.children) {
        for (const child of step.children) {
          ids.push(...collectElements(child));
        }
      }
      return ids;
    };
    
    const elementIds: string[] = [];
    for (const stepId of highlightedStepIdsFromFunctionDef) {
      const directElements = stepCreatedElements.get(stepId);
      if (directElements) {
        elementIds.push(...directElements);
      }
      
      const step = findStep(runtimeSteps, stepId);
      if (step) {
        elementIds.push(...collectElements(step));
      }
    }
    return [...new Set(elementIds)];
  }, [selectedFunctionDefinition, highlightedStepIdsFromFunctionDef, stepCreatedElements, runtimeSteps]);

  // Combined highlighted elements: from runtime step click, statement click, OR function definition click
  const combinedHighlightedElementIds = selectedRuntimeStepId 
    ? highlightedElementIds 
    : selectedStatement 
    ? highlightedElementIdsFromStatement 
    : highlightedElementIdsFromFunctionDef;
  
  // Combined highlighted step IDs for RuntimePanel
  const combinedHighlightedStepIds = selectedFunctionDefinition 
    ? highlightedStepIdsFromFunctionDef 
    : highlightedStepIdsFromStatement;
  
  const activeCallChain = selectedStepCallChain || selectedElementCallChain;

  // Compute loop range from selected runtime step's elements
  const loopRange = useMemo(() => {
    if (!selectedRuntimeStepId || combinedHighlightedElementIds.length === 0) return null;
    
    let minT0 = Infinity;
    let maxT1 = -Infinity;
    
    // Find time range from all events related to highlighted elements
    for (const event of events) {
      const args = event.args as { id?: string; t0?: number; t1?: number };
      if (args.id && combinedHighlightedElementIds.includes(args.id)) {
        if (typeof args.t0 === 'number' && args.t0 < minT0) minT0 = args.t0;
        if (typeof args.t1 === 'number' && args.t1 > maxT1) maxT1 = args.t1;
      }
    }
    
    if (minT0 === Infinity || maxT1 === -Infinity) return null;
    
    // Add a small buffer after for visibility
    return { start: Math.max(0, minT0 - 0.2), end: maxT1 + 0.5 };
  }, [selectedRuntimeStepId, combinedHighlightedElementIds, events]);

  // Compute static elements: all elements created BEFORE the loopRange starts
  // These are shown at their final state while the selected step loops
  const staticElementIds = useMemo(() => {
    if (!selectedRuntimeStepId || !loopRange) return [];
    
    const staticIds: string[] = [];
    const loopStart = loopRange.start + 0.2; // Account for the buffer we added
    
    // Find all elements whose animations complete before the loop starts
    for (const event of events) {
      if (event.type === 'text.create' || event.type === 'text.update') {
        const args = event.args as { id?: string; t1?: number };
        if (args.id && typeof args.t1 === 'number') {
          // If this element completes before the loop and is NOT part of the highlighted set
          if (args.t1 <= loopStart && !combinedHighlightedElementIds.includes(args.id)) {
            staticIds.push(args.id);
          }
        }
      }
    }
    
    return [...new Set(staticIds)];
  }, [selectedRuntimeStepId, loopRange, events, combinedHighlightedElementIds]);

  // Handle runtime step click
  const handleRuntimeStepClick = useCallback((step: RuntimeStep) => {
    if (selectedRuntimeStepId === step.id) {
      // Deselect if clicking same step
      setSelectedRuntimeStepId(null);
      setSelectedElementId(null);
    } else {
      setSelectedRuntimeStepId(step.id);
      // Clear other selections when selecting a runtime step
      setSelectedElementId(null);
      setSelectedStatement(null);
      setSelectedFunctionDefinition(null);
    }
  }, [selectedRuntimeStepId]);

  // Handle element click in Anim panel (modified to clear runtime step selection)
  const handleElementClickWithClear = useCallback((elementId: string) => {
    setSelectedRuntimeStepId(null);
    setSelectedStatement(null);
    setSelectedFunctionDefinition(null);
    setSelectedElementId(elementId === selectedElementId ? null : elementId);
  }, [selectedElementId]);

  // Handle statement click in TreeView
  const handleStatementClick = useCallback((fnName: string, stmtIndex: number) => {
    console.log('handleStatementClick called:', fnName, stmtIndex);
    if (selectedStatement?.fnName === fnName && selectedStatement?.stmtIndex === stmtIndex) {
      setSelectedStatement(null);
    } else {
      setSelectedStatement({ fnName, stmtIndex });
      setSelectedRuntimeStepId(null);
      setSelectedElementId(null);
      setSelectedFunctionDefinition(null);
    }
  }, [selectedStatement]);

  // Handle function definition click in TreeView
  const handleFunctionDefinitionClick = useCallback((fnName: string) => {
    if (selectedFunctionDefinition === fnName) {
      setSelectedFunctionDefinition(null);
    } else {
      setSelectedFunctionDefinition(fnName);
      setSelectedRuntimeStepId(null);
      setSelectedElementId(null);
      setSelectedStatement(null);
    }
  }, [selectedFunctionDefinition]);

  const dslPanelProps = {
    spec: parsedSpec,
    content: paramsContent,
    onChange: handleParamsChange,
    onParamsChange: handleParamsObjectChange,
    onFunctionArgsChange: handleFunctionArgsChange,
    panelState: dslPanelState,
    onPanelStateChange: setDslPanelState,
    highlightedElementId: selectedElementId,
    elementCallChain: activeCallChain,
    zoomLevel,
    onStatementClick: handleStatementClick,
    selectedStatement,
    onFunctionDefinitionClick: handleFunctionDefinitionClick,
    selectedFunctionDefinition,
    dslScripts,
    selectedVersionId: selectedDslVersionId,
    onSelectVersion: handleSelectDslVersion,
    onSaveVersion: handleSaveDslVersion,
  };

  // Common Anim panel props
  const animPanelProps = {
    events,
    selectedElementId,
    highlightedElementIds: combinedHighlightedElementIds,
    staticElementIds,
    onElementClick: handleElementClickWithClear,
    zoomLevel,
    loopRange,
  };

  // Panel expansion state
  const { sortedVisiblePanelIds, handlePanelClick, isPanelVisible } = usePanelExpansion(['dsl', 'runtime', 'anim']);

  // Panel configurations
  const panelConfigs = useMemo(() => [
    {
      id: 'source' as PanelId,
      label: '1. Source',
      render: () => (
        <SourcePanel
          loCode={loCode}
          onLoCodeChange={setLoCode}
          loContent={loContent}
          onLoContentChange={setLoContentUndoable}
          gdriveLink={gdriveLink}
          onGdriveLinkChange={setGdriveLinkUndoable}
          zoomLevel={zoomLevel}
          activeTab={sourceActiveTab}
          onActiveTabChange={setSourceActiveTab}
          los={los}
          versions={versions}
          selectedLoId={selectedLoId}
          onSelectLo={handleSelectLo}
          selectedVersionId={selectedVersionId}
          onSelectVersion={handleSelectVersion}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onSave={handleSave}
          canUndo={canUndo}
          canRedo={canRedo}
          hasUnsavedChanges={hasUnsavedChanges}
          onCreateNewLo={handleCreateNewLo}
          onDeleteLo={handleDeleteLo}
          // Video props
          videos={videos}
          videoVersions={videoVersions}
          selectedVideoId={selectedVideoId}
          onSelectVideo={handleSelectVideo}
          selectedVideoVersionId={selectedVideoVersionId}
          onSelectVideoVersion={handleSelectVideoVersion}
          onVideoUndo={handleVideoUndo}
          onVideoRedo={handleVideoRedo}
          onVideoSave={handleVideoSave}
          canVideoUndo={canVideoUndo}
          canVideoRedo={canVideoRedo}
          hasUnsavedVideoChanges={hasUnsavedVideoChanges}
          onCreateNewVideo={handleCreateNewVideo}
          onDeleteVideo={handleDeleteVideo}
        />
      ),
    },
    {
      id: 'desc' as PanelId,
      label: '2. Desc',
      render: () => (
        <DescPanel
          zoomLevel={zoomLevel}
          sourceActiveTab={sourceActiveTab}
          loDescs={loDescs}
          videoDesc={videoDesc}
          selectedVersionIds={selectedDescVersionIds}
          onSelectVersion={handleSelectDescVersion}
          descContents={descContents}
          setDescContents={setDescContents}
          descVideoLink={descVideoLink}
          setDescVideoLink={setDescVideoLink}
          onCreateDesc={handleCreateDesc}
          onDeleteDesc={handleDeleteDesc}
          onSaveDesc={handleSaveDesc}
          onUndoDesc={handleDescUndo}
          onRedoDesc={handleDescRedo}
          canUndoDesc={canUndoDesc}
          canRedoDesc={canRedoDesc}
          hasUnsavedDescChanges={hasUnsavedDescChanges}
        />
      ),
    },
    {
      id: 'dsl' as PanelId,
      label: '3. DSLScript',
      render: () => (
        <YAMLScriptPanel {...dslPanelProps} />
      ),
    },
    {
      id: 'runtime' as PanelId,
      label: '4. Runtime',
      render: () => (
        <RuntimePanel 
          steps={runtimeSteps} 
          elementCallChain={selectedElementCallChain} 
          zoomLevel={zoomLevel}
          onStepClick={handleRuntimeStepClick}
          selectedStepId={selectedRuntimeStepId}
          highlightedStepIds={combinedHighlightedStepIds}
          stepCallChains={stepCallChains}
        />
      ),
    },
    {
      id: 'anim' as PanelId,
      label: '5. Anim',
      render: () => (
        <AnimPanelWithControls {...animPanelProps} />
      ),
    },
    {
      id: 'chat' as PanelId,
      label: '6. Log',
      render: () => (
        <ChatPanel title="6. Activity Log" zoomLevel={zoomLevel} />
      ),
    },
  ], [loCode, loContent, gdriveLink, sourceActiveTab, descContents, descVideoLink, zoomLevel, dslPanelProps, runtimeSteps, selectedElementCallChain, handleRuntimeStepClick, selectedRuntimeStepId, combinedHighlightedStepIds, stepCallChains, animPanelProps, los, versions, selectedLoId, handleSelectLo, selectedVersionId, handleSelectVersion, loDescs, videoDesc, selectedDescVersionIds, handleSelectDescVersion, handleCreateDesc, handleDeleteDesc, handleSaveDesc, handleDescUndo, handleDescRedo, canUndoDesc, canRedoDesc, hasUnsavedDescChanges, dslScripts, selectedDslVersionId, handleSelectDslVersion, videos, videoVersions, selectedVideoId, handleSelectVideo, selectedVideoVersionId, handleSelectVideoVersion, handleVideoUndo, handleVideoRedo, handleVideoSave, canVideoUndo, canVideoRedo, hasUnsavedVideoChanges, handleCreateNewVideo, handleDeleteVideo, setGdriveLinkUndoable]);
  
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="h-12 px-4 flex items-center justify-between border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-foreground">VectorAnim Studio</h1>
          <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary glow-primary">v0.71</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>schema_version: 2</span>
            <span className="text-border">•</span>
            <span>dialect: AnimYAML-DSL</span>
          </div>
          <div className="flex items-center gap-1 border-l border-border pl-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover-glow"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 50}
              title="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground w-10 text-center">{zoomLevel}%</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover-glow"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 150}
              title="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      
      {/* Error Banner */}
      {error && (
        <div className="px-4 py-2 bg-destructive/20 border-b border-destructive/30 text-destructive text-sm shrink-0">
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {/* Main Content */}
      <div className="flex-1 min-h-0">
        <Tabs defaultValue="editing" className="h-full flex flex-col" onValueChange={setActiveTab}>
          <div className="px-4 py-2 border-b border-border shrink-0 flex items-center gap-4">
            <TabsList className="bg-muted">
              <TabsTrigger value="editing" className="text-xs">Editing</TabsTrigger>
              <TabsTrigger value="config" className="text-xs">Config</TabsTrigger>
            </TabsList>
            
            {/* Panel selector for Editing tab - shown inline only when Editing is active */}
            {activeTab === 'editing' && (
              <PanelSelector
                panels={panelConfigs}
                isPanelVisible={isPanelVisible}
                onPanelClick={handlePanelClick}
              />
            )}
            
            {/* Config subtabs - shown inline only when Config is active and authenticated */}
            {activeTab === 'config' && configAuthenticated && (
              <div className="flex items-center gap-1">
                {CONFIG_SUBTABS.map((subtab) => (
                  <React.Fragment key={subtab.id}>
                    {subtab.labelBefore && (
                      <span className="text-xs text-muted-foreground font-medium px-1 ml-4">
                        {subtab.labelBefore}
                      </span>
                    )}
                    <button
                      onClick={() => setActiveConfigSubtab(subtab.id)}
                      className={`
                        px-2 py-1 rounded text-xs font-medium transition-all flex items-baseline gap-0.5
                        ${activeConfigSubtab === subtab.id
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                        }
                      `}
                    >
                      <span>{subtab.code}</span>
                      <span className="text-[0.6rem] opacity-70">{subtab.suffix}</span>
                    </button>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Editing Tab: 6 collapsible panels */}
            <TabsContent value="editing" className="flex-1 min-h-0 m-0 relative overflow-hidden">
              <PanelContentArea panels={panelConfigs} sortedVisiblePanelIds={sortedVisiblePanelIds} />
            </TabsContent>

            {/* Config Tab */}
            <TabsContent value="config" className="flex-1 min-h-0 m-0 overflow-hidden">
              {configAuthenticated ? (
                <ConfigPanel 
                  zoomLevel={zoomLevel} 
                  activeSubtab={activeConfigSubtab}
                  onSubtabChange={setActiveConfigSubtab}
                />
              ) : (
                <div className="h-full flex items-center justify-center bg-background">
                  <div className="p-6 bg-card border border-border rounded-lg shadow-lg max-w-sm w-full mx-4">
                    <h2 className="text-lg font-semibold text-foreground mb-4 text-center">Config Access</h2>
                    <p className="text-sm text-muted-foreground mb-4 text-center">Enter password to access configuration</p>
                    <input
                      type="password"
                      value={configPassword}
                      onChange={(e) => {
                        setConfigPassword(e.target.value);
                        setConfigPasswordError(false);
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleConfigPasswordSubmit()}
                      placeholder="Password"
                      className={`w-full px-3 py-2 bg-background border rounded-md text-foreground text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary ${
                        configPasswordError ? 'border-destructive' : 'border-border'
                      }`}
                    />
                    {configPasswordError && (
                      <p className="text-xs text-destructive mb-3">Incorrect password</p>
                    )}
                    <button
                      onClick={handleConfigPasswordSubmit}
                      className="w-full py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                      Unlock
                    </button>
                  </div>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default App;
