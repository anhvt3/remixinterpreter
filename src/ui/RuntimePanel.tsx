import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronRight, ChevronDown, Play, Variable, ArrowRight, Repeat, CornerDownRight, ChevronUp, ChevronsUpDown, ChevronsDownUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  // Legacy: kept for compatibility, but we now highlight by element ID for single-step accuracy
  elementCallChain?: CallChainEntry[] | null;
  // Element selected in the Anim panel (used to highlight exactly one IR step)
  selectedElementId?: string | null;
  zoomLevel?: number;
  // New: callback when a runtime step is clicked
  onStepClick?: (step: RuntimeStep) => void;
  // New: currently selected step (from runtime click)
  selectedStepId?: string | null;
  // New: step IDs to highlight (from TreeView statement click)
  highlightedStepIds?: string[];
  // New: step call chains for building ancestor list
  stepCallChains?: Map<string, CallChainEntry[]>;
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

// Helper to check if value is expandable (array or object with keys)
const isExpandable = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return false;
};

// Recursive component for rendering values (arrays and objects) with click support
const ValueRow: React.FC<{
  label: string;
  value: unknown;
  indent: number;
  labelColor?: string;
  valueKey: string;
  isSelected?: boolean;
  isInChain?: boolean;
  onValueClick?: (valueKey: string) => void;
}> = ({ label, value, indent, labelColor = 'text-muted-foreground/60', valueKey, isSelected = false, isInChain = false, onValueClick }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isArray = Array.isArray(value);
  const isObject = value && typeof value === 'object' && !isArray;
  const expandable = isExpandable(value);

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
    : isInChain 
    ? 'bg-primary/10 ring-1 ring-primary/30 rounded'
    : '';

  // Check if a child valueKey is in the upstream chain based on current selected value
  const isChildInChain = (childKey: string): boolean => {
    // Parent passes isSelected/isInChain context, but we need the actual selectedValueKey
    // For now, we use the pattern: if this value is selected, all children are in chain
    return isSelected || isInChain;
  };

  return (
    <>
      <div 
        className={`flex items-center gap-1 py-0.5 px-2 text-muted-foreground hover:bg-muted/30 cursor-pointer ${highlight}`}
        style={{ paddingLeft: `${indent}px` }}
        onClick={(e) => {
          e.stopPropagation();
          onValueClick?.(valueKey);
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
          <span>{formatValue(value)}</span>
        )}
      </div>
      
      {/* Expanded children - pass highlight state for upstream chain */}
      {expandable && isExpanded && (
        <>
          {isArray && (value as unknown[]).map((item, idx) => {
            const childKey = `${valueKey}[${idx}]`;
            return (
              <ValueRow
                key={idx}
                label={`[${idx}]`}
                value={item}
                indent={indent + 16}
                valueKey={childKey}
                isInChain={isChildInChain(childKey)}
                onValueClick={onValueClick}
              />
            );
          })}
          {isObject && Object.entries(value as object).map(([k, v]) => {
            const childKey = `${valueKey}.${k}`;
            return (
              <ValueRow
                key={k}
                label={`${k}:`}
                value={v}
                indent={indent + 16}
                labelColor="text-cyan-400/70"
                valueKey={childKey}
                isInChain={isChildInChain(childKey)}
                onValueClick={onValueClick}
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

// Component for rendering a single param row with collapsible array/object support
const ParamRow: React.FC<{
  paramName: string;
  paramValue: unknown;
  paramKey: string;
  isSelected: boolean;
  isInChain: boolean;
  separator: string;
  indent: number;
  onParamClick: () => void;
  selectedValueKey?: string | null;
  onValueClick?: (valueKey: string) => void;
}> = ({ paramName, paramValue, paramKey, isSelected, isInChain, separator, indent, onParamClick, selectedValueKey, onValueClick }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isArray = Array.isArray(paramValue);
  const isObject = paramValue && typeof paramValue === 'object' && !isArray;
  const expandable = isExpandable(paramValue);
  
  // Check if this param or any of its children are selected
  const isValueSelected = selectedValueKey?.startsWith(paramKey);
  
  // Param itself is highlighted if selected directly (not a child value)
  const isParamDirectlySelected = isSelected || (selectedValueKey === paramKey);
  
  const paramHighlight = isParamDirectlySelected
    ? 'bg-primary/30 ring-2 ring-primary/60 rounded' 
    : isInChain || isValueSelected
    ? 'bg-primary/10 ring-1 ring-primary/30 rounded'
    : '';

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const getCollapsedPreview = () => {
    if (isArray) return `[...${(paramValue as unknown[]).length} items]`;
    if (isObject) return `{...${Object.keys(paramValue as object).length} keys}`;
    return formatValue(paramValue);
  };

  // Check if a valueKey is in the upstream chain of selectedValueKey
  const isValueInChain = (valueKey: string): boolean => {
    if (!selectedValueKey) return false;
    // If selectedValueKey starts with this valueKey, it's a parent (upstream)
    return selectedValueKey.startsWith(valueKey) && selectedValueKey !== valueKey;
  };

  return (
    <>
      <div 
        className={`flex items-center gap-1 py-0.5 px-2 hover:bg-muted/30 cursor-pointer ${paramHighlight}`}
        onClick={(e) => {
          e.stopPropagation();
          onValueClick?.(paramKey) ?? onParamClick();
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
        <span className="text-muted-foreground">{separator}</span>
        {expandable && !isExpanded ? (
          <span className="text-muted-foreground">{getCollapsedPreview()}</span>
        ) : !expandable ? (
          <span className="text-muted-foreground">{formatValue(paramValue)}</span>
        ) : (
          <span className="text-muted-foreground">{isArray ? '[' : '{'}</span>
        )}
      </div>
      
      {/* Expanded children - using recursive ValueRow with value highlighting */}
      {expandable && isExpanded && (
        <>
          {isArray && (paramValue as unknown[]).map((item, idx) => {
            const childKey = `${paramKey}[${idx}]`;
            return (
              <ValueRow
                key={idx}
                label={`[${idx}]`}
                value={item}
                indent={indent + 16}
                valueKey={childKey}
                isSelected={selectedValueKey === childKey}
                isInChain={isValueInChain(childKey)}
                onValueClick={onValueClick}
              />
            );
          })}
          {isObject && Object.entries(paramValue as object).map(([k, v]) => {
            const childKey = `${paramKey}.${k}`;
            return (
              <ValueRow
                key={k}
                label={`${k}:`}
                value={v}
                indent={indent + 16}
                labelColor="text-cyan-400/70"
                valueKey={childKey}
                isSelected={selectedValueKey === childKey}
                isInChain={isValueInChain(childKey)}
                onValueClick={onValueClick}
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
  onParamClick?: (step: RuntimeStep, paramName: string) => void;
  onValueClick?: (step: RuntimeStep, valueKey: string) => void;
  selectedStepId?: string | null;
  selectedParamKey?: string | null; // format: "stepId:paramName"
  selectedValueKey?: string | null; // format: "stepId:paramName[0].key..."
  highlightedStepIds?: string[];
  currentNavigationStepId?: string | null;
  chainStepIds?: string[];
  // Navigation controls
  canGoUp?: boolean;
  canGoDown?: boolean;
  onNavigateUp?: () => void;
  onNavigateDown?: () => void;
  navIndex?: number;
  chainLength?: number;
  // ID of the deepest highlighted step (for auto-scroll)
  deepestHighlightedStepId?: string | null;
  // Trigger for scroll when anim-element selection changes
  elementHighlightedStepId?: string | null;
}> = ({ 
  step, expanded, onToggle, getHighlightLevel, onStepClick, onParamClick, onValueClick, selectedStepId, selectedParamKey, selectedValueKey,
  highlightedStepIds = [], 
  currentNavigationStepId, chainStepIds = [],
  canGoUp, canGoDown, onNavigateUp, onNavigateDown, navIndex = 0, chainLength = 0,
  deepestHighlightedStepId, elementHighlightedStepId
}) => {
  const isSelected = step.id === selectedStepId;
  const isHighlightedFromTreeView = highlightedStepIds.includes(step.id);
  const isCurrentNav = step.id === currentNavigationStepId;
  const isInChain = chainStepIds.includes(step.id);
  const isDeepestHighlighted = step.id === deepestHighlightedStepId;
  const rowRef = useRef<HTMLDivElement>(null);
  const isExpanded = expanded.has(step.id);
  const hasChildren = step.children && step.children.length > 0;
  const indent = step.depth * 16;
  const highlightLevel = getHighlightLevel(step);
  
  // Show nav buttons only on the current navigation position
  const showNavButtons = isCurrentNav;

  // No auto-scroll - user controls scroll position manually

  // Match TreeView primary/secondary color scheme
  const typeColors: Record<RuntimeStep['type'], string> = {
    call: 'text-purple-400',
    let: 'text-yellow-400',
    foreach: 'text-pink-400',
    return: 'text-green-400',
    ir: 'text-orange-400',
  };

  // Unified highlight styles: primary for current position, secondary for chain
  const highlightStyles = isCurrentNav
    ? 'bg-primary/30 ring-2 ring-primary/60'
    : isInChain
    ? 'bg-primary/10 ring-1 ring-primary/30'
    : isSelected
    ? 'bg-primary/30 ring-2 ring-primary/60'
    : isHighlightedFromTreeView
    ? 'bg-primary/10 ring-1 ring-primary/30'
    : highlightLevel === 'primary'
    ? 'bg-primary/30 ring-2 ring-primary/60'
    : highlightLevel === 'secondary'
    ? 'bg-primary/10 ring-1 ring-primary/30'
    : '';

  // Separate expand/collapse from highlighting - clicking toggles highlight, chevron toggles expand
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

  return (
    <>
      <div 
        ref={rowRef}
        className={`flex items-start gap-1.5 py-1 px-2 hover:bg-muted/50 cursor-pointer text-xs font-mono rounded ${highlightStyles}`}
        style={{ paddingLeft: `${8 + indent}px` }}
        onClick={handleRowClick}
      >
        {/* Expand/collapse button - separate from row click */}
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
            </div>
          )}
        </div>
        
        {/* Navigation buttons - shown inline on anchor or current nav */}
        {showNavButtons && (
          <div className="flex items-center gap-0.5 shrink-0 ml-1 mr-3" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 hover:bg-muted"
              onClick={(e) => { e.stopPropagation(); onNavigateUp?.(); }}
              disabled={!canGoUp}
              title="Navigate up to parent caller"
            >
              <ChevronUp className="h-3 w-3" />
            </Button>
            <span className="text-[10px] text-muted-foreground w-6 text-center">
              {navIndex}/{chainLength}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 hover:bg-muted -ml-1"
              onClick={(e) => { e.stopPropagation(); onNavigateDown?.(); }}
              disabled={!canGoDown}
              title="Navigate down toward anchor"
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
      
      {/* Params rows for call/ir - rendered separately with own highlighting */}
      {(step.type === 'call' || step.type === 'ir') && step.resolvedArgs && Object.keys(step.resolvedArgs).length > 0 && (
        <div className="text-xs font-mono" style={{ paddingLeft: `${8 + indent + 24}px` }}>
          {Object.entries(step.resolvedArgs).map(([k, v]) => {
            const paramKey = `${step.id}:${k}`;
            const isParamSelected = selectedParamKey === paramKey || selectedValueKey?.startsWith(paramKey);
            const isParamInChain = chainStepIds.includes(paramKey);
            return (
              <ParamRow
                key={k}
                paramName={k}
                paramValue={v}
                paramKey={paramKey}
                isSelected={selectedParamKey === paramKey}
                isInChain={isParamInChain}
                separator={step.type === 'call' ? '=' : ':'}
                indent={8 + indent + 24}
                onParamClick={() => onParamClick?.(step, k)}
                selectedValueKey={selectedValueKey}
                onValueClick={(valueKey) => onValueClick?.(step, valueKey)}
              />
            );
          })}
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
          onParamClick={onParamClick}
          onValueClick={onValueClick}
          selectedStepId={selectedStepId}
          selectedParamKey={selectedParamKey}
          selectedValueKey={selectedValueKey}
          highlightedStepIds={highlightedStepIds}
          currentNavigationStepId={currentNavigationStepId}
          chainStepIds={chainStepIds}
          canGoUp={canGoUp}
          canGoDown={canGoDown}
          onNavigateUp={onNavigateUp}
          onNavigateDown={onNavigateDown}
          navIndex={navIndex}
          chainLength={chainLength}
          deepestHighlightedStepId={deepestHighlightedStepId}
          elementHighlightedStepId={elementHighlightedStepId}
        />
      ))}
    </>
  );
};

export const RuntimePanel: React.FC<RuntimePanelProps> = ({ 
  steps, 
  elementCallChain, 
  selectedElementId,
  zoomLevel = 100,
  onStepClick,
  selectedStepId,
  highlightedStepIds = [],
  stepCallChains,
}) => {
  // Initialize with top-level items expanded
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    return new Set(steps.filter(s => s.depth === 0).map(s => s.id));
  });
  
  // Navigation state: anchor is the clicked step or param, navIndex is current position in chain
  const [anchorStepId, setAnchorStepId] = useState<string | null>(null);
  const [anchorParamKey, setAnchorParamKey] = useState<string | null>(null); // format: "stepId:paramName"
  const [selectedValueKey, setSelectedValueKey] = useState<string | null>(null); // format: "stepId:paramName[0].key..."
  const [navIndex, setNavIndex] = useState<number>(0);
  
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
  
  // Build ancestor chain for the anchor step (from anchor up to root)
  const ancestorChain = useMemo(() => {
    if (!anchorStepId || !stepCallChains) return [];
    
    const callChain = stepCallChains.get(anchorStepId);
    if (!callChain || callChain.length === 0) return [];
    
    // Find steps that match each call chain entry
    // callChain is ordered innermost first (closest to anchor) to outermost (entry point)
    const ancestorStepIds: string[] = [];
    
    for (const entry of callChain) {
      // Find a step that matches this call chain entry
      for (const [stepId, step] of allStepsMap) {
        if (step.type === 'call' && step.functionName === entry.fnName) {
          if (!ancestorStepIds.includes(stepId)) {
            ancestorStepIds.push(stepId);
            break; // Take first match for each level
          }
        }
      }
    }
    
    return ancestorStepIds;
  }, [anchorStepId, stepCallChains, allStepsMap]);
  
  // Current navigation position step ID
  // navIndex 0 = anchor, navIndex 1 = first ancestor, etc.
  const currentNavStepId = useMemo(() => {
    if (!anchorStepId) return null;
    if (navIndex === 0) return anchorStepId; // At anchor
    if (navIndex > 0 && navIndex <= ancestorChain.length) {
      return ancestorChain[navIndex - 1];
    }
    return null;
  }, [anchorStepId, navIndex, ancestorChain]);
  
  // Chain step IDs: all steps and params that should be dimly highlighted
  // This includes anchor (when not current) and all ancestors (except current)
  // Also includes param key if a param is selected, and upstream value keys
  const chainStepIds = useMemo(() => {
    if (!anchorStepId) return [];
    const allInChain: string[] = [anchorStepId, ...ancestorChain];
    // Add param key if selected
    if (anchorParamKey) {
      allInChain.push(anchorParamKey);
    }
    // Add upstream value keys when a nested value is selected
    // e.g., if "step:param[0].key" is selected, add "step:param", "step:param[0]" to chain
    if (selectedValueKey && anchorParamKey) {
      // Build all parent keys from paramKey to selectedValueKey
      const parts = selectedValueKey.slice(anchorParamKey.length);
      let currentKey = anchorParamKey;
      const regex = /^(\[\d+\]|\.[^.\[]+)/;
      let remaining = parts;
      while (remaining.length > 0) {
        const match = remaining.match(regex);
        if (match) {
          currentKey += match[1];
          if (currentKey !== selectedValueKey) {
            allInChain.push(currentKey);
          }
          remaining = remaining.slice(match[1].length);
        } else {
          break;
        }
      }
    }
    // Exclude the current navigation position (step) and selected value (it gets primary highlight)
    return allInChain.filter(id => id !== currentNavStepId && id !== selectedValueKey);
  }, [anchorStepId, anchorParamKey, selectedValueKey, ancestorChain, currentNavStepId]);
  
  // Handle step click - set as anchor, clear param/value selection
  const handleStepClick = useCallback((step: RuntimeStep) => {
    if (anchorStepId === step.id && !anchorParamKey && !selectedValueKey) {
      // Click same step when no param/value selected - clear navigation
      setAnchorStepId(null);
      setAnchorParamKey(null);
      setSelectedValueKey(null);
      setNavIndex(0);
    } else {
      setAnchorStepId(step.id);
      setAnchorParamKey(null);
      setSelectedValueKey(null);
      setNavIndex(0);
    }
    onStepClick?.(step);
  }, [anchorStepId, anchorParamKey, selectedValueKey, onStepClick]);
  
  // Handle param click - set param as primary anchor, step + upstream as secondary
  const handleParamClick = useCallback((step: RuntimeStep, paramName: string) => {
    const paramKey = `${step.id}:${paramName}`;
    if (anchorParamKey === paramKey && !selectedValueKey) {
      // Click same param when no value selected - clear
      setAnchorStepId(null);
      setAnchorParamKey(null);
      setSelectedValueKey(null);
      setNavIndex(0);
    } else {
      // Set step as anchor (for upstream chain), param as selected
      setAnchorStepId(step.id);
      setAnchorParamKey(paramKey);
      setSelectedValueKey(null);
      setNavIndex(0);
    }
  }, [anchorParamKey, selectedValueKey]);
  
  // Handle value click - set specific value as selected, with upstream highlighting
  const handleValueClick = useCallback((step: RuntimeStep, valueKey: string) => {
    if (selectedValueKey === valueKey) {
      // Click same value - clear
      setAnchorStepId(null);
      setAnchorParamKey(null);
      setSelectedValueKey(null);
      setNavIndex(0);
    } else {
      // Extract param key from value key (format: stepId:paramName[...])
      const colonIndex = valueKey.indexOf(':');
      const bracketIndex = valueKey.indexOf('[');
      const dotIndex = valueKey.indexOf('.');
      
      // Find where the base paramKey ends
      let paramKeyEnd = valueKey.length;
      if (bracketIndex > colonIndex) paramKeyEnd = Math.min(paramKeyEnd, bracketIndex);
      if (dotIndex > colonIndex) paramKeyEnd = Math.min(paramKeyEnd, dotIndex);
      
      const paramKey = valueKey.slice(0, paramKeyEnd);
      
      setAnchorStepId(step.id);
      setAnchorParamKey(paramKey);
      setSelectedValueKey(valueKey);
      setNavIndex(0);
    }
  }, [selectedValueKey]);
  
  // Navigate up (to higher level / parent)
  const navigateUp = useCallback(() => {
    if (navIndex < ancestorChain.length) {
      setNavIndex(navIndex + 1);
    }
  }, [navIndex, ancestorChain.length]);
  
  // Navigate down (back toward anchor)
  const navigateDown = useCallback(() => {
    if (navIndex > 0) {
      setNavIndex(navIndex - 1);
    }
  }, [navIndex]);
  
  const canGoUp = anchorStepId && navIndex < ancestorChain.length;
  const canGoDown = anchorStepId && navIndex > 0;
  
  // Get highlight level for a step - only highlight the single IR step that created the element
  const getHighlightLevel = (step: RuntimeStep): 'primary' | 'secondary' | null => {
    if (!elementHighlightedStepId) return null;
    if (step.id === elementHighlightedStepId) {
      return 'primary';
    }
    return null;
  };
  

  // Auto-expand upstream items only (NOT the clicked item itself) so highlights are visible
  useEffect(() => {
    if (!anchorStepId || ancestorChain.length === 0) return;
    
    // Only expand ancestor chain items, NOT the anchor itself
    setExpanded(prev => {
      const next = new Set(prev);
      let changed = false;
      
      // Also need to expand parents in the tree structure for ancestor steps to be visible
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
      
      // Expand parent tree for each ancestor
      for (const ancestorId of ancestorChain) {
        let currentId: string | undefined = ancestorId;
        while (currentId) {
          const parentId = parentMap.get(currentId);
          if (parentId && !next.has(parentId)) {
            next.add(parentId);
            changed = true;
          }
          currentId = parentId;
        }
      }
      
      return changed ? next : prev;
    });
  }, [anchorStepId, ancestorChain, steps]);

  // Auto-expand ancestors and scroll to deepest highlighted step when highlightedStepIds changes
  // This is triggered when clicking a TreeView statement or function definition
  const deepestHighlightedStepRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (highlightedStepIds.length === 0) {
      deepestHighlightedStepRef.current = null;
      return;
    }
    
    // Build parent map: step ID -> parent step ID
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
    
    // Find all ancestors of highlighted steps and expand them
    const toExpand = new Set<string>();
    let deepestStep: { id: string; depth: number } | null = null;
    
    for (const stepId of highlightedStepIds) {
      const step = allStepsMap.get(stepId);
      if (step) {
        // Track deepest (highest depth) highlighted step for scrolling
        if (!deepestStep || step.depth > deepestStep.depth) {
          deepestStep = { id: stepId, depth: step.depth };
        }
        
        // Walk up parent chain and expand each ancestor
        let currentId: string | undefined = stepId;
        while (currentId) {
          const parentId = parentMap.get(currentId);
          if (parentId) {
            toExpand.add(parentId);
          }
          currentId = parentId;
        }
      }
    }
    
    // Update expanded set
    if (toExpand.size > 0) {
      setExpanded(prev => {
        const next = new Set(prev);
        toExpand.forEach(id => next.add(id));
        return next;
      });
    }
    
    // Set the deepest step for auto-scroll
    deepestHighlightedStepRef.current = deepestStep?.id || null;
  }, [highlightedStepIds, steps, allStepsMap]);

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
          <span className="text-xs text-muted-foreground">{steps.length} steps</span>
        </div>
      </div>
      
      <ScrollArea className="flex-1 min-h-0">
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
                onStepClick={handleStepClick}
                onParamClick={handleParamClick}
                onValueClick={handleValueClick}
                selectedStepId={selectedStepId}
                selectedParamKey={anchorParamKey}
                selectedValueKey={selectedValueKey}
                highlightedStepIds={highlightedStepIds}
                currentNavigationStepId={anchorParamKey ? null : currentNavStepId}
                chainStepIds={chainStepIds}
                canGoUp={!!canGoUp}
                canGoDown={!!canGoDown}
                onNavigateUp={navigateUp}
                onNavigateDown={navigateDown}
                navIndex={navIndex}
                chainLength={ancestorChain.length}
                deepestHighlightedStepId={deepestHighlightedStepRef.current}
                elementHighlightedStepId={elementHighlightedStepId}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default RuntimePanel;
