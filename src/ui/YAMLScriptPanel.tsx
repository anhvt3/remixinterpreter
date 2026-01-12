import React from 'react';
import { CodePanel } from './CodePanel';
import { YAMLTreePanel } from './YAMLTreePanel';
import type { YAMLSpec, Params } from '../core/types';

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
  // Controlled state props
  panelState?: DSLPanelState;
  onPanelStateChange?: (state: DSLPanelState) => void;
  // Highlight element by ID (for Anim -> Tree linking)
  highlightedElementId?: string | null;
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
}) => {
  const setViewMode = (mode: 'code' | 'tree') => {
    onPanelStateChange?.({ ...panelState, viewMode: mode });
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* View toggle */}
      <div className="flex gap-1 mb-2 shrink-0">
        <button
          onClick={() => setViewMode('tree')}
          className={`flex-1 text-xs py-1.5 px-3 rounded transition-colors ${
            panelState.viewMode === 'tree' 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          Tree View
        </button>
        <button
          onClick={() => setViewMode('code')}
          className={`flex-1 text-xs py-1.5 px-3 rounded transition-colors ${
            panelState.viewMode === 'code' 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          Code View
        </button>
      </div>
      
      {/* Panel content */}
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
          />
        ) : (
          <CodePanel
            title="YAMLScript"
            content={content}
            onChange={onChange}
            language="yaml"
            onLineClick={onLineClick}
            highlightedLines={highlightedLines}
          />
        )}
      </div>
    </div>
  );
};
