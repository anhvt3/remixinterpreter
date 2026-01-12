import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronsUpDown, ChevronsDownUp } from 'lucide-react';
import yaml from 'js-yaml';
import { CodePanel } from './CodePanel';
import { YAMLTreePanel } from './YAMLTreePanel';
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
  // Callback when a statement is clicked in tree view
  onStatementClick?: (fnName: string, stmtIndex: number) => void;
  // Currently selected statement for highlighting
  selectedStatement?: { fnName: string; stmtIndex: number } | null;
  // Callback when a function definition is clicked in tree view
  onFunctionDefinitionClick?: (fnName: string) => void;
  // Currently selected function definition for highlighting
  selectedFunctionDefinition?: string | null;
  // All function names for expand/collapse all
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
  const setViewMode = (mode: 'code' | 'tree') => {
    onPanelStateChange?.({ ...panelState, viewMode: mode });
  };

  // --- Code view: keep a local draft so editing works even while YAML is temporarily invalid
  const [codeDraft, setCodeDraft] = useState(content);
  const [codeError, setCodeError] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep draft in sync with external content (tree edits / successful merges)
  useEffect(() => {
    if (!dirtyRef.current) {
      setCodeDraft(content);
      setCodeError(null);
    }
  }, [content]);

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

  const handleCodeDraftChange = (next: string) => {
    dirtyRef.current = true;
    setCodeDraft(next);

    const err = validateParamsYaml(next);
    setCodeError(err);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Only propagate to parent when YAML parses (so it doesn't immediately revert while typing)
    if (!err) {
      debounceRef.current = setTimeout(() => {
        onChange(next);
        // We'll mark clean once parent accepts & echoes the same content back
      }, 250);
    }
  };

  // When parent catches up, clear dirty flag
  useEffect(() => {
    if (dirtyRef.current && codeError === null && content === codeDraft) {
      dirtyRef.current = false;
    }
  }, [content, codeDraft, codeError]);

  // Get all function names from spec for expand/collapse
  const allFunctionNames = spec?.defs ? Object.keys(spec.defs) : [];

  const expandAll = () => {
    onPanelStateChange?.({ ...panelState, expandedFunctions: new Set(allFunctionNames) });
  };

  const collapseAll = () => {
    onPanelStateChange?.({ ...panelState, expandedFunctions: new Set() });
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 mb-2 shrink-0">
        <span className="text-xs font-medium text-foreground">DSLScript</span>
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

        {/* Expand/Collapse buttons - only show in tree view */}
        {panelState.viewMode === 'tree' ? (
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
        ) : (
          <div className="ml-auto text-[10px] text-muted-foreground truncate max-w-[50%]">
            {codeError ? (
              <span className="text-destructive">Invalid YAML: {codeError}</span>
            ) : (
              <span>Editable</span>
            )}
          </div>
        )}
      </div>

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
            title="YAMLScript"
            content={codeDraft}
            onChange={handleCodeDraftChange}
            language="yaml"
            highlightedLines={highlightedLines}
            zoomLevel={zoomLevel}
            onLineClick={onLineClick}
          />
        )}
      </div>
    </div>
  );
};
