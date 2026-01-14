import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronRight, ChevronDown, Play, Variable, ArrowRight, Repeat, CornerDownRight, ChevronsUpDown, ChevronsDownUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CallChainEntry } from '../core/runtimeTracer';
import type { DependencyAnalysisResult, ConstantDef } from '../core/dependencyAnalyzer';

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
  // Legacy: kept for compatibility
  elementCallChain?: CallChainEntry[] | null;
  // Element selected in the Anim panel
  selectedElementId?: string | null;
  zoomLevel?: number;
  // Callback when a runtime step is clicked
  onStepClick?: (step: RuntimeStep) => void;
  // Currently selected step (from runtime click)
  selectedStepId?: string | null;
  // Step IDs to highlight (from TreeView statement click)
  highlightedStepIds?: string[];
  // Step call chains for building ancestor list
  stepCallChains?: Map<string, CallChainEntry[]>;
  // Dependency analysis result for constant-output matrix
  dependencyAnalysis?: DependencyAnalysisResult | null;
  // Callback when an IR output value is clicked (for TreeView navigation)
  onOutputClick?: (irFn: string, argName: string, argValue: unknown, dependentConstants: ConstantDef[]) => void;
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

// Helper to check if value is expandable
const isExpandable = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return false;
};

// Recursive component for rendering IR arg values with click support
const IRValueRow: React.FC<{
  label: string;
  value: unknown;
  indent: number;
  labelColor?: string;
  valueKey: string;
  selectedValueKey?: string | null;
  onValueClick?: (valueKey: string, value: unknown) => void;
  isClickable?: boolean;
}> = ({ 
  label, value, indent, labelColor = 'text-muted-foreground/60', valueKey, selectedValueKey, onValueClick,
  isClickable = true
}) => {
  const isArray = Array.isArray(value);
  const isObject = value && typeof value === 'object' && !isArray;
  const expandable = isExpandable(value);
  const rowRef = useRef<HTMLDivElement>(null);
  const isSelected = selectedValueKey === valueKey;
  const [isExpanded, setIsExpanded] = useState(false);

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const getCollapsedPreview = () => {
    if (isArray) return `[...${(value as unknown[]).length} items]`;
    if (isObject) return `{...${Object.keys(value as object).length} keys}`;
    return formatValue(value);
  };

  const highlight = isSelected 
    ? 'bg-primary/30 ring-2 ring-primary/60 rounded' 
    : '';

  const clickableClass = isClickable ? 'cursor-pointer hover:bg-muted/50' : '';

  return (
    <>
      <div 
        ref={rowRef}
        className={`flex items-center gap-1 py-0.5 px-2 text-muted-foreground ${clickableClass} ${highlight}`}
        style={{ paddingLeft: `${indent}px` }}
        onClick={(e) => {
          e.stopPropagation();
          if (isClickable) {
            onValueClick?.(valueKey, value);
          }
        }}
      >
        {expandable ? (
          <button
            onClick={handleExpandClick}
            className="w-3 shrink-0 flex items-center justify-center p-0 hover:bg-muted/50 rounded"
          >
            {isExpanded ? <ChevronDown className="w-2.5 h-2.5 text-muted-foreground" /> : <ChevronRight className="w-2.5 h-2.5 text-muted-foreground" />}
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span className={labelColor}>{label}</span>
        {expandable && !isExpanded ? (
          <span>{getCollapsedPreview()}</span>
        ) : expandable && isExpanded ? (
          <span>{isArray ? '[' : '{'}</span>
        ) : (
          <span className={isClickable ? 'hover:underline' : ''}>{formatValue(value)}</span>
        )}
      </div>
      
      {/* Expanded children */}
      {expandable && isExpanded && (
        <>
          {isArray && (value as unknown[]).map((item, idx) => {
            const childKey = `${valueKey}[${idx}]`;
            return (
              <IRValueRow
                key={idx}
                label={`[${idx}]`}
                value={item}
                indent={indent + 16}
                valueKey={childKey}
                selectedValueKey={selectedValueKey}
                onValueClick={onValueClick}
                isClickable={isClickable}
              />
            );
          })}
          {isObject && Object.entries(value as object).map(([k, v]) => {
            const childKey = `${valueKey}.${k}`;
            return (
              <IRValueRow
                key={k}
                label={`${k}:`}
                value={v}
                indent={indent + 16}
                labelColor="text-cyan-400/70"
                valueKey={childKey}
                selectedValueKey={selectedValueKey}
                onValueClick={onValueClick}
                isClickable={isClickable}
              />
            );
          })}
          <div 
            className="flex gap-1 py-0.5 px-2 text-muted-foreground"
            style={{ paddingLeft: `${indent}px` }}
          >
            <span className="w-3 shrink-0" />
            <span>{isArray ? ']' : '}'}</span>
          </div>
        </>
      )}
    </>
  );
};

// Component for rendering IR param rows (clickable)
const IRParamRow: React.FC<{
  paramName: string;
  paramValue: unknown;
  paramKey: string;
  isSelected: boolean;
  indent: number;
  onValueClick: (valueKey: string, value: unknown) => void;
  selectedValueKey?: string | null;
}> = ({ 
  paramName, paramValue, paramKey, isSelected, indent, onValueClick, selectedValueKey
}) => {
  const isArray = Array.isArray(paramValue);
  const isObject = paramValue && typeof paramValue === 'object' && !isArray;
  const expandable = isExpandable(paramValue);
  const rowRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const getCollapsedPreview = () => {
    if (isArray) return `[...${(paramValue as unknown[]).length} items]`;
    if (isObject) return `{...${Object.keys(paramValue as object).length} keys}`;
    return formatValue(paramValue);
  };

  const paramHighlight = isSelected || selectedValueKey === paramKey
    ? 'bg-primary/30 ring-2 ring-primary/60 rounded'
    : '';

  return (
    <>
      <div 
        ref={rowRef}
        className={`flex items-center gap-1 py-0.5 px-2 hover:bg-muted/30 cursor-pointer ${paramHighlight}`}
        onClick={(e) => {
          e.stopPropagation();
          onValueClick(paramKey, paramValue);
        }}
      >
        {expandable ? (
          <button
            onClick={handleExpandClick}
            className="w-3 shrink-0 flex items-center justify-center p-0 hover:bg-muted/50 rounded"
          >
            {isExpanded ? <ChevronDown className="w-2.5 h-2.5 text-muted-foreground" /> : <ChevronRight className="w-2.5 h-2.5 text-muted-foreground" />}
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span className="text-orange-400">{paramName}</span>
        <span className="text-muted-foreground">:</span>
        {expandable && !isExpanded ? (
          <span className="text-muted-foreground hover:underline">{getCollapsedPreview()}</span>
        ) : !expandable ? (
          <span className="text-muted-foreground hover:underline">{formatValue(paramValue)}</span>
        ) : (
          <span className="text-muted-foreground">{isArray ? '[' : '{'}</span>
        )}
      </div>
      
      {/* Expanded children */}
      {expandable && isExpanded && (
        <>
          {isArray && (paramValue as unknown[]).map((item, idx) => {
            const childKey = `${paramKey}[${idx}]`;
            return (
              <IRValueRow
                key={idx}
                label={`[${idx}]`}
                value={item}
                indent={indent + 16}
                valueKey={childKey}
                selectedValueKey={selectedValueKey}
                onValueClick={onValueClick}
                isClickable={true}
              />
            );
          })}
          {isObject && Object.entries(paramValue as object).map(([k, v]) => {
            const childKey = `${paramKey}.${k}`;
            return (
              <IRValueRow
                key={k}
                label={`${k}:`}
                value={v}
                indent={indent + 16}
                labelColor="text-cyan-400/70"
                valueKey={childKey}
                selectedValueKey={selectedValueKey}
                onValueClick={onValueClick}
                isClickable={true}
              />
            );
          })}
          <div 
            className="flex gap-1 py-0.5 px-2 text-muted-foreground"
            style={{ paddingLeft: `${indent}px` }}
          >
            <span className="w-3 shrink-0" />
            <span>{isArray ? ']' : '}'}</span>
          </div>
        </>
      )}
    </>
  );
};

const RuntimeStepRow: React.FC<{ 
  step: RuntimeStep; 
  expanded: Set<string>;
  onToggle: (id: string) => void;
  getHighlightLevel: (step: RuntimeStep) => 'primary' | 'secondary' | null;
  onStepClick?: (step: RuntimeStep) => void;
  onIRValueClick?: (step: RuntimeStep, paramName: string, value: unknown) => void;
  selectedStepId?: string | null;
  selectedValueKey?: string | null;
  highlightedStepIds?: string[];
  elementHighlightedStepId?: string | null;
}> = ({ 
  step, expanded, onToggle, getHighlightLevel, onStepClick, onIRValueClick, selectedStepId, selectedValueKey,
  highlightedStepIds = [], elementHighlightedStepId
}) => {
  const isSelected = step.id === selectedStepId;
  const isHighlightedFromTreeView = highlightedStepIds.includes(step.id);
  const rowRef = useRef<HTMLDivElement>(null);
  const isExpanded = expanded.has(step.id);
  const hasChildren = step.children && step.children.length > 0;
  const indent = step.depth * 16;
  const highlightLevel = getHighlightLevel(step);
  
  const isElementHighlighted = step.id === elementHighlightedStepId;
  useEffect(() => {
    if (isElementHighlighted && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isElementHighlighted]);

  const typeColors: Record<RuntimeStep['type'], string> = {
    call: 'text-purple-400',
    let: 'text-yellow-400',
    foreach: 'text-pink-400',
    return: 'text-green-400',
    ir: 'text-orange-400',
  };

  const highlightStyles = isSelected
    ? 'bg-primary/30 ring-2 ring-primary/60'
    : isHighlightedFromTreeView
    ? 'bg-primary/10 ring-1 ring-primary/30'
    : highlightLevel === 'primary'
    ? 'bg-primary/30 ring-2 ring-primary/60'
    : highlightLevel === 'secondary'
    ? 'bg-primary/10 ring-1 ring-primary/30'
    : '';

  const handleRowClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStepClick?.(step);
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      onToggle(step.id);
    }
  };

  const handleIRValueClick = (valueKey: string, value: unknown) => {
    // Extract param name from valueKey (format: stepId:paramName or stepId:paramName.path)
    const colonIdx = valueKey.indexOf(':');
    if (colonIdx === -1) return;
    
    const afterColon = valueKey.slice(colonIdx + 1);
    const dotIdx = afterColon.indexOf('.');
    const bracketIdx = afterColon.indexOf('[');
    
    let paramName = afterColon;
    if (dotIdx > 0 && (bracketIdx === -1 || dotIdx < bracketIdx)) {
      paramName = afterColon.slice(0, dotIdx);
    } else if (bracketIdx > 0) {
      paramName = afterColon.slice(0, bracketIdx);
    }
    
    onIRValueClick?.(step, paramName, value);
  };

  return (
    <>
      <div 
        ref={rowRef}
        className={`flex items-start gap-1.5 py-1 px-2 hover:bg-muted/50 cursor-pointer text-xs font-mono rounded ${highlightStyles}`}
        style={{ paddingLeft: `${8 + indent}px` }}
        onClick={handleRowClick}
      >
        {hasChildren ? (
          <button
            onClick={handleExpandClick}
            className="w-4 shrink-0 flex items-center justify-center p-0 hover:bg-muted/50 rounded"
          >
            {isExpanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        
        <span className={`shrink-0 ${typeColors[step.type]}`}>
          <StepIcon type={step.type} />
        </span>
        
        <div className="flex-1 min-w-0">
          {step.type === 'call' && (
            <div>
              <span className="text-purple-400">call </span>
              <span className="text-primary">{step.functionName}</span>
            </div>
          )}
          
          {step.type === 'let' && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-purple-400">let </span>
              <span className="text-orange-400">{step.variable}</span>
              <span className="text-muted-foreground"> = </span>
              <span className="text-muted-foreground">{formatValue(step.value)}</span>
            </div>
          )}
          
          {step.type === 'foreach' && step.iteration && (
            <div className="flex items-center gap-1">
              <span className="text-purple-400">foreach </span>
              <span className="text-orange-400">{step.iteration.var}</span>
              <span className="text-muted-foreground"> = </span>
              <span className="text-muted-foreground">{formatValue(step.iteration.value)}</span>
              <span className="text-muted-foreground/60">(iter {step.iteration.index})</span>
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
              <span className="text-primary">{step.functionName}</span>
            </div>
          )}
        </div>
      </div>
      
      {/* IR params - ONLY IR steps have clickable values */}
      {step.type === 'ir' && step.resolvedArgs && Object.keys(step.resolvedArgs).length > 0 && (
        <div className="text-xs font-mono" style={{ paddingLeft: `${8 + indent + 24}px` }}>
          {Object.entries(step.resolvedArgs).map(([k, v]) => {
            const paramKey = `${step.id}:${k}`;
            return (
              <IRParamRow
                key={k}
                paramName={k}
                paramValue={v}
                paramKey={paramKey}
                isSelected={false}
                indent={8 + indent + 24}
                onValueClick={handleIRValueClick}
                selectedValueKey={selectedValueKey}
              />
            );
          })}
        </div>
      )}
      
      {/* Non-IR params - display only, not clickable */}
      {step.type === 'call' && step.resolvedArgs && Object.keys(step.resolvedArgs).length > 0 && (
        <div className="text-xs font-mono text-muted-foreground/70" style={{ paddingLeft: `${8 + indent + 24}px` }}>
          {Object.entries(step.resolvedArgs).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1 py-0.5 px-2">
              <span className="w-3 shrink-0" />
              <span className="text-orange-400/70">{k}</span>
              <span>=</span>
              <span>{formatValue(v)}</span>
            </div>
          ))}
        </div>
      )}
      
      {/* Children */}
      {isExpanded && step.children?.map(child => (
        <RuntimeStepRow 
          key={child.id} 
          step={child} 
          expanded={expanded} 
          onToggle={onToggle} 
          getHighlightLevel={getHighlightLevel}
          onStepClick={onStepClick}
          onIRValueClick={onIRValueClick}
          selectedStepId={selectedStepId}
          selectedValueKey={selectedValueKey}
          highlightedStepIds={highlightedStepIds}
          elementHighlightedStepId={elementHighlightedStepId}
        />
      ))}
    </>
  );
};

export const RuntimePanel: React.FC<RuntimePanelProps> = ({ 
  steps, 
  selectedElementId,
  zoomLevel = 100,
  onStepClick,
  selectedStepId,
  highlightedStepIds = [],
  dependencyAnalysis,
  onOutputClick,
}) => {
  // Initialize with top-level items expanded
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    return new Set(steps.filter(s => s.depth === 0).map(s => s.id));
  });
  
  // Track selected value (for highlighting)
  const [selectedValueKey, setSelectedValueKey] = useState<string | null>(null);
  
  // Reinitialize expanded when steps change
  useEffect(() => {
    setExpanded(new Set(steps.filter(s => s.depth === 0).map(s => s.id)));
  }, [steps]);
  
  // Build flat list of all steps for lookup
  const allStepsMap = useMemo(() => {
    const map = new Map<string, RuntimeStep>();
    const addSteps = (items: RuntimeStep[]) => {
      for (const step of items) {
        map.set(step.id, step);
        if (step.children) addSteps(step.children);
      }
    };
    addSteps(steps);
    return map;
  }, [steps]);
  
  // Find the single IR step that created the selected element
  const elementHighlightedStepId = useMemo(() => {
    if (!selectedElementId) return null;
    for (const [stepId, step] of allStepsMap) {
      if (step.type === 'ir' && step.createdElementIds?.includes(selectedElementId)) {
        return stepId;
      }
    }
    return null;
  }, [selectedElementId, allStepsMap]);
  
  // Auto-expand ancestors when element is clicked
  useEffect(() => {
    if (!elementHighlightedStepId) return;
    
    const parentMap = new Map<string, string>();
    const buildParentMap = (items: RuntimeStep[], parentId: string | null = null) => {
      for (const step of items) {
        if (parentId) {
          parentMap.set(step.id, parentId);
        }
        if (step.children) {
          buildParentMap(step.children, step.id);
        }
      }
    };
    buildParentMap(steps);
    
    const toExpand = new Set<string>();
    let currentId: string | undefined = elementHighlightedStepId;
    while (currentId) {
      const parentId = parentMap.get(currentId);
      if (parentId) {
        toExpand.add(parentId);
      }
      currentId = parentId;
    }
    
    if (toExpand.size > 0) {
      setExpanded(prev => {
        const next = new Set(prev);
        let changed = false;
        toExpand.forEach(id => {
          if (!next.has(id)) {
            next.add(id);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }
  }, [elementHighlightedStepId, steps]);
  
  // Handle step click
  const handleStepClick = useCallback((step: RuntimeStep) => {
    setSelectedValueKey(null);
    onStepClick?.(step);
  }, [onStepClick]);
  
  // Handle IR value click - find dependent constants and notify parent
  const handleIRValueClick = useCallback((step: RuntimeStep, paramName: string, value: unknown) => {
    if (!step.functionName || !dependencyAnalysis) {
      setSelectedValueKey(`${step.id}:${paramName}`);
      return;
    }
    
    // Find the output path in the dependency matrix
    const { findOutputPath, getConstantsForOutput } = require('../core/dependencyAnalyzer');
    const outputPath = findOutputPath(dependencyAnalysis, step.functionName, paramName, value);
    
    if (outputPath) {
      const dependentConstants = getConstantsForOutput(dependencyAnalysis, outputPath);
      setSelectedValueKey(`${step.id}:${paramName}`);
      onOutputClick?.(step.functionName, paramName, value, dependentConstants);
    } else {
      setSelectedValueKey(`${step.id}:${paramName}`);
      onOutputClick?.(step.functionName, paramName, value, []);
    }
  }, [dependencyAnalysis, onOutputClick]);
  
  // Get highlight level for a step
  const getHighlightLevel = (step: RuntimeStep): 'primary' | 'secondary' | null => {
    if (!elementHighlightedStepId) return null;
    if (step.id === elementHighlightedStepId) {
      return 'primary';
    }
    return null;
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Collect all expandable step IDs
  const allExpandableIds = useMemo(() => {
    const ids: string[] = [];
    const collect = (items: RuntimeStep[]) => {
      for (const step of items) {
        if (step.children && step.children.length > 0) {
          ids.push(step.id);
          collect(step.children);
        }
      }
    };
    collect(steps);
    return ids;
  }, [steps]);

  const expandAll = useCallback(() => {
    setExpanded(new Set(allExpandableIds));
  }, [allExpandableIds]);

  const collapseAll = useCallback(() => {
    setExpanded(new Set());
  }, []);

  return (
    <div className="panel h-full min-h-0 flex flex-col overflow-hidden">
      <div className="panel-header shrink-0 flex items-center justify-between">
        <span className="panel-title">4. Runtime</span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={expandAll}
              title="Expand all"
            >
              <ChevronsDownUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={collapseAll}
              title="Collapse all"
            >
              <ChevronsUpDown className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-0.5" style={{ fontSize: `${zoomLevel}%` }}>
          {steps.map(step => (
            <RuntimeStepRow 
              key={step.id} 
              step={step} 
              expanded={expanded} 
              onToggle={toggleExpand}
              getHighlightLevel={getHighlightLevel}
              onStepClick={handleStepClick}
              onIRValueClick={handleIRValueClick}
              selectedStepId={selectedStepId}
              selectedValueKey={selectedValueKey}
              highlightedStepIds={highlightedStepIds}
              elementHighlightedStepId={elementHighlightedStepId}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default RuntimePanel;
