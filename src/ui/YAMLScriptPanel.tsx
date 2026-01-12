import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { ChevronsUpDown, ChevronsDownUp, Undo2, Redo2, Save } from 'lucide-react';
import yaml from 'js-yaml';
import { CodePanel } from './CodePanel';
import { YAMLTreePanel } from './YAMLTreePanel';
import { useUndoRedo } from '@/hooks/useUndoRedo';
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
import type { YAMLSpec, Params } from '../core/types';
import type { CallChainEntry } from '../core/runtimeTracer';

export interface DSLPanelState {
  viewMode: 'code' | 'tree';
  paramsExpanded: boolean;
  expandedParams: Set<string>;
  expandedFunctions: Set<string>;
}

export const DEFAULT_DSL_PANEL_STATE: DSLPanelState = {
  viewMode: 'code',
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
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  
  // --- Code view state ---
  const [codeDraft, setCodeDraft] = useState(content);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [pendingViewMode, setPendingViewMode] = useState<'tree' | null>(null);
  const dirtyRef = useRef(false);

  // Undo/redo for code view
  const { setValue: setUndoValue, undo, redo, canUndo, canRedo, reset: resetUndo } = useUndoRedo(
    codeDraft,
    (val) => setCodeDraft(val),
  );

  // Keep draft in sync with external content (after save / external update)
  useEffect(() => {
    if (!dirtyRef.current) {
      setCodeDraft(content);
      setCodeError(null);
      resetUndo(content);
      setIsDirty(false);
      setPendingViewMode(null);
    }
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
    dirtyRef.current = true;
    setIsDirty(true);
    setUndoValue(next);
    const err = validateParamsYaml(next);
    setCodeError(err);
  }, [setUndoValue, validateParamsYaml]);

  const handleSave = useCallback((): boolean => {
    const err = validateParamsYaml(codeDraft);
    if (err) {
      setCodeError(err);
      return false;
    }

    onChange(codeDraft);

    dirtyRef.current = false;
    setIsDirty(false);
    setCodeError(null);
    setShowSaveDialog(false);
    setPendingViewMode(null);

    return true;
  }, [codeDraft, onChange, validateParamsYaml]);

  const handleDiscard = useCallback(() => {
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
      className="flex flex-col h-full min-h-0"
      onBlur={handlePanelBlur}
    >
      {/* Header row with tabs and controls */}
      <div className="flex items-center gap-2 mb-2 shrink-0">
        {/* View mode tabs */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode('tree')}
            className={`text-xs py-1.5 px-3 rounded transition-colors ${
              panelState.viewMode === 'tree' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Tree View
          </button>
          <button
            onClick={() => setViewMode('code')}
            className={`text-xs py-1.5 px-3 rounded transition-colors ${
              panelState.viewMode === 'code' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Code View
          </button>
        </div>

        {/* Code view controls */}
        {panelState.viewMode === 'code' && (
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={undo}
              disabled={!canUndo}
              className="p-1 rounded hover:bg-muted/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className="p-1 rounded hover:bg-muted/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleSave}
              disabled={!hasUnsavedChanges || !!codeError}
              className={`p-1 rounded transition-colors ${
                hasUnsavedChanges && !codeError
                  ? 'text-primary hover:bg-primary/20' 
                  : 'opacity-30 cursor-not-allowed'
              }`}
              title="Save (Ctrl+S)"
            >
              <Save className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs text-syntax-comment ml-1">YAML</span>
            {hasUnsavedChanges && (
              <span className="text-xs text-primary ml-1" title="Unsaved changes">•</span>
            )}
          </div>
        )}

        {/* Tree view controls */}
        {panelState.viewMode === 'tree' && (
          <div className="flex items-center gap-0.5 ml-auto">
            <button
              onClick={expandAll}
              className="p-1.5 rounded hover:bg-muted/80 text-muted-foreground transition-colors"
              title="Expand All"
            >
              <ChevronsUpDown className="w-4 h-4" />
            </button>
            <button
              onClick={collapseAll}
              className="p-1.5 rounded hover:bg-muted/80 text-muted-foreground transition-colors"
              title="Collapse All"
            >
              <ChevronsDownUp className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Error indicator for code view */}
        {panelState.viewMode === 'code' && codeError && (
          <div className="ml-auto text-[10px] text-destructive truncate max-w-[40%]" title={codeError}>
            Invalid YAML
          </div>
        )}
      </div>

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
            <AlertDialogCancel onClick={() => setShowSaveDialog(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveAndSwitch} disabled={!!codeError}>
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
