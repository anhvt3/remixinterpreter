import React, { useState } from 'react';
import { CodePanel } from './CodePanel';
import { YAMLTreePanel } from './YAMLTreePanel';
import type { YAMLSpec, Params } from '../core/types';

interface YAMLScriptPanelProps {
  spec: YAMLSpec | null;
  content: string;
  onChange: (value: string) => void;
  onLineClick?: (lineIndex: number) => void;
  highlightedLines?: number[];
  onParamsChange?: (params: Params) => void;
  onFunctionArgsChange?: (fnName: string, stmtIndex: number, newArgs: Record<string, unknown>) => void;
  onElementSelect?: (elementId: string | null) => void;
  selectedElementId?: string | null;
}

export const YAMLScriptPanel: React.FC<YAMLScriptPanelProps> = ({
  spec,
  content,
  onChange,
  onLineClick,
  highlightedLines = [],
  onParamsChange,
  onFunctionArgsChange,
  onElementSelect,
  selectedElementId,
}) => {
  const [viewMode, setViewMode] = useState<'code' | 'tree'>('tree');

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* View toggle */}
      <div className="flex gap-1 mb-2">
        <button
          onClick={() => setViewMode('tree')}
          className={`flex-1 text-xs py-1.5 px-3 rounded transition-colors ${
            viewMode === 'tree' 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          Tree View
        </button>
        <button
          onClick={() => setViewMode('code')}
          className={`flex-1 text-xs py-1.5 px-3 rounded transition-colors ${
            viewMode === 'code' 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          Code View
        </button>
      </div>
      
      {/* Panel content */}
      <div className="flex-1 min-h-0">
        {viewMode === 'tree' ? (
          <YAMLTreePanel 
            spec={spec} 
            onParamsChange={onParamsChange} 
            onFunctionArgsChange={onFunctionArgsChange}
            onElementSelect={onElementSelect}
            selectedElementId={selectedElementId}
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
