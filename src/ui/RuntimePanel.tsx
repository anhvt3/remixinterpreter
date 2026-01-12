import React, { useState, useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronRight, ChevronDown, Play, Variable, ArrowRight, Repeat, CornerDownRight } from 'lucide-react';
import type { CallChainEntry } from '../core/runtimeTracer';

export interface RuntimeStep {
  id: string;
  type: 'call' | 'let' | 'foreach' | 'return' | 'ir';
  functionName?: string;
  args?: Record<string, unknown>;
  resolvedArgs?: Record<string, unknown>;
  variable?: string;
  value?: unknown;
  returnValue?: unknown;
  iteration?: { var: string; value: unknown; index: number };
  depth: number;
  children?: RuntimeStep[];
  // Track which function and statement index this step corresponds to
  fnName?: string;
  stmtIndex?: number;
  // For IR steps, track the element IDs they create
  createdElementIds?: string[];
}

interface RuntimePanelProps {
  steps: RuntimeStep[];
  currentTime?: number;
  elementCallChain?: CallChainEntry[] | null;
  zoomLevel?: number;
  // New: callback when a runtime step is clicked
  onStepClick?: (step: RuntimeStep) => void;
  // New: currently selected step (from runtime click)
  selectedStepId?: string | null;
}

const StepIcon: React.FC<{ type: RuntimeStep['type'] }> = ({ type }) => {
  const iconClass = "w-3.5 h-3.5";
  switch (type) {
    case 'call': return <Play className={iconClass} />;
    case 'let': return <Variable className={iconClass} />;
    case 'foreach': return <Repeat className={iconClass} />;
    case 'return': return <ArrowRight className={iconClass} />;
    case 'ir': return <CornerDownRight className={iconClass} />;
    default: return null;
  }
};

const formatValue = (value: unknown): string => {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'boolean') return value.toString();
  if (Array.isArray(value)) {
    if (value.length <= 3) return `[${value.map(formatValue).join(', ')}]`;
    return `[${value.slice(0, 2).map(formatValue).join(', ')}, ...+${value.length - 2}]`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length <= 2) {
      return `{${keys.map(k => `${k}: ${formatValue((value as Record<string, unknown>)[k])}`).join(', ')}}`;
    }
    return `{${keys.slice(0, 2).map(k => `${k}: ${formatValue((value as Record<string, unknown>)[k])}`).join(', ')}, ...}`;
  }
  return String(value);
};

const RuntimeStepRow: React.FC<{ 
  step: RuntimeStep; 
  expanded: Set<string>;
  onToggle: (id: string) => void;
  getHighlightLevel: (step: RuntimeStep) => 'primary' | 'secondary' | null;
  onStepClick?: (step: RuntimeStep) => void;
  selectedStepId?: string | null;
}> = ({ step, expanded, onToggle, getHighlightLevel, onStepClick, selectedStepId }) => {
  const isSelected = step.id === selectedStepId;
  const rowRef = useRef<HTMLDivElement>(null);
  const isExpanded = expanded.has(step.id);
  const hasChildren = step.children && step.children.length > 0;
  const indent = step.depth * 16;
  const highlightLevel = getHighlightLevel(step);

  // Auto-scroll primary highlighted step into view
  useEffect(() => {
    if (highlightLevel === 'primary' && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightLevel]);

  // Match TreeView color scheme
  const typeColors: Record<RuntimeStep['type'], string> = {
    call: 'text-purple-400',     // call statements: purple
    let: 'text-purple-400',      // let statements: purple  
    foreach: 'text-purple-400',  // foreach statements: purple
    return: 'text-purple-400',   // return: purple
    ir: 'text-cyan-400',         // IR commands: cyan
  };

  // Highlight styles based on call chain level OR selection
  const highlightStyles = isSelected
    ? 'bg-yellow-500/30 border-l-4 border-yellow-400 ring-2 ring-yellow-400/70 shadow-lg shadow-yellow-500/20'
    : highlightLevel === 'primary'
    ? 'bg-primary/30 border-l-2 border-primary'
    : highlightLevel === 'secondary'
    ? 'bg-primary/10 border-l-2 border-primary/40'
    : '';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      onToggle(step.id);
    }
    // Always trigger step click for selection
    onStepClick?.(step);
  };

  return (
    <>
      <div 
        ref={rowRef}
        className={`flex items-start gap-1.5 py-1 px-2 hover:bg-muted/50 cursor-pointer text-xs font-mono ${highlightStyles}`}
        style={{ paddingLeft: `${8 + indent}px` }}
        onClick={handleClick}
      >
        {/* Expand/collapse */}
        <span className="w-4 shrink-0 flex items-center justify-center">
          {hasChildren ? (
            isExpanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />
          ) : null}
        </span>
        
        {/* Icon */}
        <span className={`shrink-0 ${typeColors[step.type]}`}>
          <StepIcon type={step.type} />
        </span>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          {step.type === 'call' && (
            <div>
              <span className="text-purple-400">call </span>
              <span className="text-blue-400 font-medium">{step.functionName}</span>
              {step.resolvedArgs && Object.keys(step.resolvedArgs).length > 0 && (
                <div className="ml-4 mt-0.5">
                  {Object.entries(step.resolvedArgs).map(([k, v]) => (
                    <div key={k} className="flex gap-1">
                      <span className="text-orange-400">{k}</span>
                      <span className="text-muted-foreground">=</span>
                      <span className="text-muted-foreground">{formatValue(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {step.type === 'let' && (
            <div>
              <span className="text-purple-400">let </span>
              <span className="text-orange-400">{step.variable}</span>
              <span className="text-muted-foreground"> = </span>
              <span className="text-muted-foreground">{formatValue(step.value)}</span>
            </div>
          )}
          
          {step.type === 'foreach' && step.iteration && (
            <div>
              <span className="text-purple-400">foreach </span>
              <span className="text-orange-400">{step.iteration.var}</span>
              <span className="text-muted-foreground"> = </span>
              <span className="text-muted-foreground">{formatValue(step.iteration.value)}</span>
              <span className="text-muted-foreground/60"> (iter {step.iteration.index})</span>
            </div>
          )}
          
          {step.type === 'return' && (
            <div>
              <span className="text-purple-400">return </span>
              <span className="text-muted-foreground">{formatValue(step.returnValue)}</span>
            </div>
          )}
          
          {step.type === 'ir' && (
            <div>
              <span className="text-cyan-400">→ </span>
              <span className="text-blue-400">{step.functionName}</span>
              {step.resolvedArgs && Object.keys(step.resolvedArgs).length > 0 && (
                <div className="ml-4 mt-0.5">
                  {Object.entries(step.resolvedArgs).map(([k, v]) => (
                    <div key={k} className="flex gap-1">
                      <span className="text-orange-400">{k}</span>
                      <span className="text-muted-foreground">:</span>
                      <span className="text-muted-foreground">{formatValue(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Children */}
      {isExpanded && step.children?.map(child => (
        <RuntimeStepRow 
          key={child.id} 
          step={child} 
          expanded={expanded} 
          onToggle={onToggle} 
          getHighlightLevel={getHighlightLevel}
          onStepClick={onStepClick}
          selectedStepId={selectedStepId}
        />
      ))}
    </>
  );
};

export const RuntimePanel: React.FC<RuntimePanelProps> = ({ 
  steps, 
  elementCallChain, 
  zoomLevel = 100,
  onStepClick,
  selectedStepId,
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  
  // Build a map of step ID -> highlight level from the call chain
  const highlightMap = React.useMemo(() => {
    const map = new Map<string, 'primary' | 'secondary'>();
    if (elementCallChain && elementCallChain.length > 0) {
      // First entry is the lowest-level creator (primary)
      // Rest are higher-level callers (secondary)
      elementCallChain.forEach((entry, index) => {
        const level = index === 0 ? 'primary' : 'secondary';
        // Match by function name - we'll highlight all steps for that function
        map.set(entry.fnName, level);
      });
    }
    return map;
  }, [elementCallChain]);

  // Get highlight level for a step
  const getHighlightLevel = (step: RuntimeStep): 'primary' | 'secondary' | null => {
    if (step.functionName && highlightMap.has(step.functionName)) {
      return highlightMap.get(step.functionName) || null;
    }
    return null;
  };
  
  
  // Auto-expand top-level items and items in call chain
  useEffect(() => {
    const topLevel = new Set(steps.filter(s => s.depth === 0).map(s => s.id));
    
    // Also expand parents of highlighted steps
    if (elementCallChain && elementCallChain.length > 0) {
      const expandParents = (items: RuntimeStep[], parentIds: string[] = []) => {
        for (const step of items) {
          const shouldExpand = step.functionName && highlightMap.has(step.functionName);
          if (shouldExpand) {
            parentIds.forEach(id => topLevel.add(id));
            topLevel.add(step.id);
          }
          if (step.children) {
            expandParents(step.children, [...parentIds, step.id]);
          }
        }
      };
      expandParents(steps);
    }
    
    setExpanded(topLevel);
  }, [steps, elementCallChain, highlightMap]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center justify-between shrink-0">
        <span className="text-xs font-medium text-foreground">Runtime Trace</span>
        <span className="text-xs text-muted-foreground">{steps.length} steps</span>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="py-1" style={{ zoom: zoomLevel / 100 }}>
          {steps.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-8">
              No execution steps yet
            </div>
          ) : (
            steps.map(step => (
              <RuntimeStepRow 
                key={step.id} 
                step={step} 
                expanded={expanded}
                onToggle={toggleExpand}
                getHighlightLevel={getHighlightLevel}
                onStepClick={onStepClick}
                selectedStepId={selectedStepId}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default RuntimePanel;
