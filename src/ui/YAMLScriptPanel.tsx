import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { ChevronsUpDown, ChevronsDownUp, Undo2, Redo2, Save, Plus, Trash2 } from 'lucide-react';
import yaml from 'js-yaml';
import { CodePanel } from './CodePanel';
import { YAMLTreePanel } from './YAMLTreePanel';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { YAMLSpec, Params } from '../core/types';
import type { CallChainEntry } from '../core/runtimeTracer';
import type { DslScriptWithVersions, DslScriptVersion } from '@/hooks/useDslScriptData';

export interface DSLPanelState {
  viewMode: 'code' | 'tree';
  paramsExpanded: boolean;
  expandedParams: Set<string>;
  expandedFunctions: Set<string>;
}

export const DEFAULT_DSL_PANEL_STATE: DSLPanelState = {
  viewMode: 'tree',
  paramsExpanded: true,
  expandedParams: new Set(['number']),
  expandedFunctions: new Set(['SimplifyRoot']),
};

interface YAMLScriptPanelProps {
  spec: YAMLSpec | null;
  content: string;
  onChange: (value: string) => void;
  onLineClick?: (lineIndex: number) => void;
  highlightedLines?: number[];
  onParamsChange?: (params: Params) => void;
  onFunctionArgsChange?: (fnName: string, stmtIndex: number, newArgs: Record<string, unknown>) => void;
  panelState?: DSLPanelState;
  onPanelStateChange?: (state: DSLPanelState) => void;
  highlightedElementId?: string | null;
  elementCallChain?: CallChainEntry[] | null;
  zoomLevel?: number;
  onStatementClick?: (fnName: string, stmtIndex: number) => void;
  selectedStatement?: { fnName: string; stmtIndex: number } | null;
  onFunctionDefinitionClick?: (fnName: string) => void;
  selectedFunctionDefinition?: string | null;
  allFunctionNames?: string[];
  // DSL Script version selection
  dslScripts?: DslScriptWithVersions[];
  selectedVersionId?: string | null;
  onSelectVersion?: (versionId: string | null) => void;
}

export const YAMLScriptPanel: React.FC<YAMLScriptPanelProps> = ({
  spec,
  content,
  onChange,
  onLineClick,
  highlightedLines = [],
  onParamsChange,
  onFunctionArgsChange,
  panelState = DEFAULT_DSL_PANEL_STATE,
  onPanelStateChange,
  highlightedElementId,
  elementCallChain,
  zoomLevel = 100,
  onStatementClick,
  selectedStatement,
  onFunctionDefinitionClick,
  selectedFunctionDefinition,
  dslScripts = [],
  selectedVersionId,
  onSelectVersion,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  
  // --- Code view state ---
  const [codeDraft, setCodeDraft] = useState(content);
  const codeDraftRef = useRef(codeDraft);

  useEffect(() => {
    codeDraftRef.current = codeDraft;
  }, [codeDraft]);

  const [codeError, setCodeError] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [pendingViewMode, setPendingViewMode] = useState<'tree' | null>(null);
  const dirtyRef = useRef(false);

  // Prevent a "save" click from being overwritten by a sync that runs before the parent updates `content`.
  const saveFromContentRef = useRef<string | null>(null);

  // Undo/redo for code view
  const { setValue: setUndoValue, undo, redo, canUndo, canRedo, reset: resetUndo } = useUndoRedo(
    codeDraft,
    (val) => setCodeDraft(val),
  );

  // Keep draft in sync with external content (after save / external update)
  // Important: ONLY run when `content` changes (not when `codeDraft` changes), otherwise a save click can get reverted.
  useEffect(() => {
    if (dirtyRef.current) return;

    // If we just saved, wait until parent content changes away from the pre-save value.
    if (saveFromContentRef.current !== null && content === saveFromContentRef.current) {
      return;
    }

    saveFromContentRef.current = null;
    codeDraftRef.current = content;
    setCodeDraft(content);
    setCodeError(null);
    resetUndo(content);
    setIsDirty(false);
    setPendingViewMode(null);
  }, [content, resetUndo]);

  // "Recent changes not saved" should track user edits since last save, not string formatting differences.
  const hasUnsavedChanges = isDirty;

  const setViewMode = (mode: 'code' | 'tree') => {
    // If switching away from code view with unsaved changes, prompt
    if (panelState.viewMode === 'code' && mode === 'tree' && hasUnsavedChanges) {
      setPendingViewMode('tree');
      setShowSaveDialog(true);
      return;
    }
    onPanelStateChange?.({ ...panelState, viewMode: mode });
  };

  const validateParamsYaml = useMemo(() => {
    return (text: string): string | null => {
      try {
        const obj = yaml.load(text) as unknown;
        if (!obj || typeof obj !== 'object') return 'YAML must be an object.';
        if (!('params' in (obj as Record<string, unknown>))) return 'Missing top-level "params:" key.';
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : 'Invalid YAML.';
      }
    };
  }, []);

  const handleCodeDraftChange = useCallback((next: string) => {
    // Keep an always-up-to-date value for "save" clicks that happen before React state commits.
    codeDraftRef.current = next;

    dirtyRef.current = true;
    setIsDirty(true);
    setUndoValue(next);
    const err = validateParamsYaml(next);
    setCodeError(err);
  }, [setUndoValue, validateParamsYaml]);

  const handleSave = useCallback((draft?: string): boolean => {
    const text = draft ?? codeDraftRef.current;

    const err = validateParamsYaml(text);
    if (err) {
      setCodeError(err);
      return false;
    }

    // Mark the current prop-content so our sync effect won't immediately overwrite the draft
    // before the parent applies `onChange`.
    saveFromContentRef.current = content;

    // Ensure state reflects exactly what we saved
    codeDraftRef.current = text;
    setCodeDraft(text);
    onChange(text);

    dirtyRef.current = false;
    setIsDirty(false);
    setCodeError(null);
    setShowSaveDialog(false);
    setPendingViewMode(null);

    return true;
  }, [content, onChange, validateParamsYaml]);

  const handleDiscard = useCallback(() => {
    codeDraftRef.current = content;
    setCodeDraft(content);
    resetUndo(content);
    dirtyRef.current = false;
    setIsDirty(false);
    setCodeError(null);
    setShowSaveDialog(false);
    setPendingViewMode(null);
  }, [content, resetUndo]);

  const handleDialogCancel = useCallback(() => {
    setShowSaveDialog(false);
    setPendingViewMode(null);
  }, []);

  const handleDialogSave = useCallback(() => {
    const ok = handleSave();
    if (!ok) return;

    if (pendingViewMode) {
      onPanelStateChange?.({ ...panelState, viewMode: pendingViewMode });
    }
  }, [handleSave, onPanelStateChange, panelState, pendingViewMode]);

  // Handle panel blur for save prompt
  const handlePanelBlur = useCallback((e: React.FocusEvent) => {
    if (panelState.viewMode !== 'code') return;

    const relatedTarget = e.relatedTarget as HTMLElement | null;
    const isInsidePanel = panelRef.current?.contains(relatedTarget);

    if (!isInsidePanel && hasUnsavedChanges) {
      setPendingViewMode(null);
      setShowSaveDialog(true);
    }
  }, [hasUnsavedChanges, panelState.viewMode]);

  // Get all function names from spec for expand/collapse
  const allFunctionNames = spec?.defs ? Object.keys(spec.defs) : [];

  const expandAll = () => {
    onPanelStateChange?.({ ...panelState, expandedFunctions: new Set(allFunctionNames) });
  };

  const collapseAll = () => {
    onPanelStateChange?.({ ...panelState, expandedFunctions: new Set() });
  };

  return (
    <div 
      ref={panelRef}
      className="panel flex flex-col h-full min-h-0"
      onBlur={handlePanelBlur}
    >
      {/* Header row with title, tabs, version selector and action buttons */}
      <div className="panel-header shrink-0 flex items-center gap-2">
        <span className="panel-title">3. DSLScript</span>
        
        {/* View mode tabs - aligned left after title */}
        <div className="flex items-center bg-muted rounded-md p-0.5 h-6">
          <button
            onClick={() => setViewMode('tree')}
            className={`text-xs h-5 px-2 rounded transition-colors ${
              panelState.viewMode === 'tree' 
                ? 'bg-background text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            TreeView
          </button>
          <button
            onClick={() => setViewMode('code')}
            className={`text-xs h-5 px-2 rounded transition-colors ${
              panelState.viewMode === 'code' 
                ? 'bg-background text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            CodeView
          </button>
        </div>
        {/* Action buttons - aligned right */}
        <div className="flex items-center gap-1 ml-auto">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Create New DSLScript"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Delete DSLScript"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => handleSave()}
            disabled={!hasUnsavedChanges}
            title="Save"
          >
            <Save className={`h-3.5 w-3.5 ${hasUnsavedChanges ? 'text-orange-500' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={undo}
            disabled={!canUndo}
            title="Undo"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={redo}
            disabled={!canRedo}
            title="Redo"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </Button>
          
          {/* Tree view expand/collapse controls */}
          {panelState.viewMode === 'tree' && (
            <>
              <div className="w-px h-4 bg-border mx-1" />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={expandAll}
                title="Expand All"
              >
                <ChevronsUpDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={collapseAll}
                title="Collapse All"
              >
                <ChevronsDownUp className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Version dropdown bar - below title bar */}
      {dslScripts.length > 0 && (
        <div className="shrink-0 flex items-center gap-2 px-2 py-1.5 border-b border-border bg-muted/30">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {dslScripts[0]?.name || 'DSLScript'}
          </span>
          <Select
            value={selectedVersionId || ''}
            onValueChange={(value) => onSelectVersion?.(value || null)}
          >
            <SelectTrigger className="h-7 text-xs flex-1 bg-background border-border">
              <SelectValue placeholder="Select version" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border z-50">
              {dslScripts.flatMap(script => 
                script.versions.map(version => (
                  <SelectItem 
                    key={version.id} 
                    value={version.id}
                    className="text-xs"
                  >
                    {script.name} - {version.version_name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 min-h-0">
        {panelState.viewMode === 'tree' ? (
          <YAMLTreePanel 
            spec={spec} 
            onParamsChange={onParamsChange} 
            onFunctionArgsChange={onFunctionArgsChange}
            paramsExpanded={panelState.paramsExpanded}
            expandedParams={panelState.expandedParams}
            expandedFunctions={panelState.expandedFunctions}
            onParamsExpandedChange={(expanded) => onPanelStateChange?.({ ...panelState, paramsExpanded: expanded })}
            onExpandedParamsChange={(expanded) => onPanelStateChange?.({ ...panelState, expandedParams: expanded })}
            onExpandedFunctionsChange={(expanded) => onPanelStateChange?.({ ...panelState, expandedFunctions: expanded })}
            highlightedElementId={highlightedElementId}
            elementCallChain={elementCallChain}
            zoomLevel={zoomLevel}
            onStatementClick={onStatementClick}
            selectedStatement={selectedStatement}
            onFunctionDefinitionClick={onFunctionDefinitionClick}
            selectedFunctionDefinition={selectedFunctionDefinition}
          />
        ) : (
          <CodePanel
            title=""
            content={codeDraft}
            onChange={handleCodeDraftChange}
            onSave={(val) => handleSave(val)}
            enableSavePromptOnBlur={false}
            language="yaml"
            highlightedLines={highlightedLines}
            zoomLevel={zoomLevel}
            onLineClick={onLineClick}
            showHeader={false}
          />
        )}
      </div>

      {/* Cancel/Save Dialog */}
      <AlertDialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Would you like to save them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDialogCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDialogSave}>
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
