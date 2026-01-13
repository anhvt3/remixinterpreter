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
  elementCallChain?: CallChainEntry[] | null;
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

const RuntimeStepRow: React.FC<{ 
  step: RuntimeStep; 
  expanded: Set<string>;
  onToggle: (id: string) => void;
  getHighlightLevel: (step: RuntimeStep) => 'primary' | 'secondary' | null;
  onStepClick?: (step: RuntimeStep) => void;
  selectedStepId?: string | null;
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
  // Key to trigger scroll when element selection changes
  highlightedIRKey?: string | null;
}> = ({ 
  step, expanded, onToggle, getHighlightLevel, onStepClick, selectedStepId, highlightedStepIds = [], 
  currentNavigationStepId, chainStepIds = [],
  canGoUp, canGoDown, onNavigateUp, onNavigateDown, navIndex = 0, chainLength = 0,
  deepestHighlightedStepId, highlightedIRKey
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

  // Auto-scroll to the highlighted IR step when element selection changes
  useEffect(() => {
    if ((isDeepestHighlighted || highlightLevel === 'primary' || isCurrentNav) && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isDeepestHighlighted, highlightLevel, isCurrentNav, highlightedIRKey]);

  // Match TreeView color scheme
  const typeColors: Record<RuntimeStep['type'], string> = {
    call: 'text-purple-400',
    let: 'text-purple-400',
    foreach: 'text-purple-400',
    return: 'text-purple-400',
    ir: 'text-cyan-400',
  };

  // Highlight styles: current position is bright green, chain (anchor + ancestors) is dim yellow
  const highlightStyles = isCurrentNav
    ? 'bg-green-500/40 border-l-4 border-green-400 ring-2 ring-green-400/70 shadow-lg shadow-green-500/20'
    : isInChain
    ? 'bg-yellow-500/10 border-l-2 border-yellow-400/40'
    : isSelected
    ? 'bg-yellow-500/30 border-l-4 border-yellow-400 ring-2 ring-yellow-400/70 shadow-lg shadow-yellow-500/20'
    : isHighlightedFromTreeView
    ? 'bg-yellow-500/20 border-l-2 border-yellow-400/60 ring-1 ring-yellow-400/40'
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
          highlightedIRKey={highlightedIRKey}
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
  highlightedStepIds = [],
  stepCallChains,
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  
  // Navigation state: anchor is the clicked step, navIndex is current position in chain
  const [anchorStepId, setAnchorStepId] = useState<string | null>(null);
  const [navIndex, setNavIndex] = useState<number>(0);
  
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
  
  // Chain step IDs: all steps that should be dimly highlighted
  // This includes anchor (when not current) and all ancestors (except current)
  const chainStepIds = useMemo(() => {
    if (!anchorStepId) return [];
    const allInChain = [anchorStepId, ...ancestorChain];
    // Exclude the current navigation position
    return allInChain.filter(id => id !== currentNavStepId);
  }, [anchorStepId, ancestorChain, currentNavStepId]);
  
  // Handle step click - set as anchor
  const handleStepClick = useCallback((step: RuntimeStep) => {
    if (anchorStepId === step.id) {
      // Click same step - clear navigation
      setAnchorStepId(null);
      setNavIndex(0);
    } else {
      setAnchorStepId(step.id);
      setNavIndex(0);
    }
    onStepClick?.(step);
  }, [anchorStepId, onStepClick]);
  
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
  
  // Get the specific IR step to highlight (first entry in chain = lowest level creator)
  const highlightedIRKey = React.useMemo(() => {
    if (elementCallChain && elementCallChain.length > 0) {
      const firstEntry = elementCallChain[0];
      return `${firstEntry.fnName}:${firstEntry.stmtIndex}`;
    }
    return null;
  }, [elementCallChain]);

  // Get highlight level for a step - only highlight the specific IR step
  const getHighlightLevel = (step: RuntimeStep): 'primary' | 'secondary' | null => {
    if (!highlightedIRKey) return null;
    // Only highlight IR steps that match both fnName and stmtIndex
    if (step.type === 'ir' && step.fnName !== undefined && step.stmtIndex !== undefined) {
      const stepKey = `${step.fnName}:${step.stmtIndex}`;
      if (stepKey === highlightedIRKey) {
        return 'primary';
      }
    }
    return null;
  };
  

  // Auto-expand top-level items and items in call chain
  useEffect(() => {
    const topLevel = new Set(steps.filter(s => s.depth === 0).map(s => s.id));
    
    // Also expand parents of the highlighted IR step
    if (highlightedIRKey) {
      const expandParents = (items: RuntimeStep[], parentIds: string[] = []) => {
        for (const step of items) {
          // Check if this is the highlighted IR step
          const isHighlightedIR = step.type === 'ir' && 
            step.fnName !== undefined && 
            step.stmtIndex !== undefined &&
            `${step.fnName}:${step.stmtIndex}` === highlightedIRKey;
          if (isHighlightedIR) {
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
    
    // Also expand ancestors when navigating
    if (anchorStepId) {
      topLevel.add(anchorStepId);
      ancestorChain.forEach(id => topLevel.add(id));
    }
    
    setExpanded(topLevel);
  }, [steps, highlightedIRKey, anchorStepId, ancestorChain]);

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
                selectedStepId={selectedStepId}
                highlightedStepIds={highlightedStepIds}
                currentNavigationStepId={currentNavStepId}
                chainStepIds={chainStepIds}
                canGoUp={!!canGoUp}
                canGoDown={!!canGoDown}
                onNavigateUp={navigateUp}
                onNavigateDown={navigateDown}
                navIndex={navIndex}
                chainLength={ancestorChain.length}
                deepestHighlightedStepId={deepestHighlightedStepRef.current}
                highlightedIRKey={highlightedIRKey}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default RuntimePanel;
