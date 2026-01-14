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
  selectedValueKey?: string | null;
  onValueClick?: (valueKey: string) => void;
  // Value navigation props
  isCurrentNav?: boolean;
  canGoUp?: boolean;
  canGoDown?: boolean;
  onNavigateUp?: () => void;
  onNavigateDown?: () => void;
  navIndex?: number;
  chainLength?: number;
  valueChain?: string[];
}> = ({ 
  label, value, indent, labelColor = 'text-muted-foreground/60', valueKey, selectedValueKey, onValueClick,
  isCurrentNav = false, canGoUp = false, canGoDown = false, onNavigateUp, onNavigateDown, navIndex = 0, chainLength = 0, valueChain = []
}) => {
  const isArray = Array.isArray(value);
  const isObject = value && typeof value === 'object' && !isArray;
  const expandable = isExpandable(value);
  const rowRef = useRef<HTMLDivElement>(null);

  // Check if this value is directly selected
  const isSelected = selectedValueKey === valueKey;
  
  // Check if this value is in the upstream chain
  const isInChain = valueChain.includes(valueKey) && !isCurrentNav && !isSelected;

  // Auto-expand if this value is in the chain or a child is selected
  const hasChildInChain = valueChain.some(v => v.startsWith(valueKey + '[') || v.startsWith(valueKey + '.'));
  const [isExpanded, setIsExpanded] = useState(hasChildInChain);
  
  useEffect(() => {
    if ((hasChildInChain || (selectedValueKey && selectedValueKey.startsWith(valueKey) && selectedValueKey !== valueKey)) && expandable && !isExpanded) {
      setIsExpanded(true);
    }
  }, [hasChildInChain, selectedValueKey, expandable, valueKey]);

  // Auto-scroll when this is the current nav position
  useEffect(() => {
    if (isCurrentNav && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isCurrentNav]);

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const getCollapsedPreview = () => {
    if (isArray) return `[...${(value as unknown[]).length} items]`;
    if (isObject) return `{...${Object.keys(value as object).length} keys}`;
    return formatValue(value);
  };

  const highlight = isCurrentNav
    ? 'bg-primary/30 ring-2 ring-primary/60 rounded'
    : isSelected 
    ? 'bg-primary/30 ring-2 ring-primary/60 rounded' 
    : isInChain 
    ? 'bg-primary/10 ring-1 ring-primary/30 rounded'
    : '';

  // Render navigation buttons directly on the value row
  const renderNavButtons = () => {
    if (!isCurrentNav) return null;
    return (
      <div className="flex items-center gap-0.5 shrink-0 ml-auto" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 hover:bg-muted"
          onClick={(e) => { e.stopPropagation(); onNavigateUp?.(); }}
          disabled={!canGoUp}
          title="Navigate up to source value"
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
    );
  };

  return (
    <>
      <div 
        ref={rowRef}
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
        {renderNavButtons()}
      </div>
      
      {/* Expanded children - pass navigation props */}
      {expandable && isExpanded && (
        <>
          {isArray && (value as unknown[]).map((item, idx) => {
            const childKey = `${valueKey}[${idx}]`;
            const isChildCurrentNav = valueChain[navIndex] === childKey;
            return (
              <ValueRow
                key={idx}
                label={`[${idx}]`}
                value={item}
                indent={indent + 16}
                valueKey={childKey}
                selectedValueKey={selectedValueKey}
                onValueClick={onValueClick}
                isCurrentNav={isChildCurrentNav}
                canGoUp={isChildCurrentNav ? canGoUp : false}
                canGoDown={isChildCurrentNav ? canGoDown : false}
                onNavigateUp={onNavigateUp}
                onNavigateDown={onNavigateDown}
                navIndex={navIndex}
                chainLength={chainLength}
                valueChain={valueChain}
              />
            );
          })}
          {isObject && Object.entries(value as object).map(([k, v]) => {
            const childKey = `${valueKey}.${k}`;
            const isChildCurrentNav = valueChain[navIndex] === childKey;
            return (
              <ValueRow
                key={k}
                label={`${k}:`}
                value={v}
                indent={indent + 16}
                labelColor="text-cyan-400/70"
                valueKey={childKey}
                selectedValueKey={selectedValueKey}
                onValueClick={onValueClick}
                isCurrentNav={isChildCurrentNav}
                canGoUp={isChildCurrentNav ? canGoUp : false}
                canGoDown={isChildCurrentNav ? canGoDown : false}
                onNavigateUp={onNavigateUp}
                onNavigateDown={onNavigateDown}
                navIndex={navIndex}
                chainLength={chainLength}
                valueChain={valueChain}
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
  // Value chain for navigation (values only, not params/steps)
  valueChain?: string[];
  currentNavValueKey?: string | null;
  // Navigation props (for param-level, kept for backward compat)
  isCurrentNav?: boolean;
  canGoUp?: boolean;
  canGoDown?: boolean;
  onNavigateUp?: () => void;
  onNavigateDown?: () => void;
  navIndex?: number;
  chainLength?: number;
}> = ({ 
  paramName, paramValue, paramKey, isSelected, isInChain, separator, indent, onParamClick, selectedValueKey, onValueClick,
  valueChain = [], currentNavValueKey,
  isCurrentNav = false, canGoUp = false, canGoDown = false, onNavigateUp, onNavigateDown, navIndex = 0, chainLength = 0
}) => {
  const isArray = Array.isArray(paramValue);
  const isObject = paramValue && typeof paramValue === 'object' && !isArray;
  const expandable = isExpandable(paramValue);
  const rowRef = useRef<HTMLDivElement>(null);
  
  // Check if this param is the current value nav position
  const isThisCurrentValueNav = currentNavValueKey === paramKey;
  
  // Check if this param is in the value chain (but not currently navigated)
  const isThisInValueChain = valueChain.includes(paramKey) && !isThisCurrentValueNav;
  
  // Check if a child value is selected (not the param itself)
  const hasChildSelected = selectedValueKey ? 
    (selectedValueKey.startsWith(paramKey + '[') || selectedValueKey.startsWith(paramKey + '.')) : false;
  
  // Check if any child is in the value chain
  const hasChildInChain = valueChain.some(v => v.startsWith(paramKey + '[') || v.startsWith(paramKey + '.'));
  
  // Check if any child is the current nav value
  const hasChildAsCurrentNav = currentNavValueKey ? 
    (currentNavValueKey.startsWith(paramKey + '[') || currentNavValueKey.startsWith(paramKey + '.')) : false;
  
  // Auto-expand if a child value is selected, in chain, or is current nav
  const [isExpanded, setIsExpanded] = useState(hasChildSelected || hasChildInChain || hasChildAsCurrentNav);
  
  useEffect(() => {
    if ((hasChildSelected || hasChildInChain || hasChildAsCurrentNav) && expandable && !isExpanded) {
      setIsExpanded(true);
    }
  }, [hasChildSelected, hasChildInChain, hasChildAsCurrentNav, expandable]);
  
  // Auto-scroll when this param is the current value navigation position
  useEffect(() => {
    if (isThisCurrentValueNav && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isThisCurrentValueNav]);
  
  // Param highlighting
  const paramHighlight = isThisCurrentValueNav
    ? 'bg-primary/30 ring-2 ring-primary/60 rounded'
    : isThisInValueChain
    ? 'bg-primary/10 ring-1 ring-primary/30 rounded'
    : (isCurrentNav && valueChain.length === 0) // Old param-level nav (when no value selected)
    ? 'bg-primary/30 ring-2 ring-primary/60 rounded'
    : (selectedValueKey === paramKey) // Direct selection
    ? 'bg-primary/30 ring-2 ring-primary/60 rounded'
    : hasChildSelected || hasChildInChain || hasChildAsCurrentNav
    ? '' // No highlight when child is the focus
    : isInChain
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

  // Render navigation buttons for value chain navigation
  const renderValueNavButtons = () => {
    if (!isThisCurrentValueNav) return null;
    return (
      <div className="flex items-center gap-0.5 shrink-0 ml-auto" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 hover:bg-muted"
          onClick={(e) => { e.stopPropagation(); onNavigateUp?.(); }}
          disabled={!canGoUp}
          title="Navigate up to source value"
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
    );
  };

  return (
    <>
      <div 
        ref={rowRef}
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
        {renderValueNavButtons()}
      </div>
      
      {/* Expanded children - using recursive ValueRow with value chain navigation */}
      {expandable && isExpanded && (
        <>
          {isArray && (paramValue as unknown[]).map((item, idx) => {
            const childKey = `${paramKey}[${idx}]`;
            const isChildCurrentNav = currentNavValueKey === childKey;
            return (
              <ValueRow
                key={idx}
                label={`[${idx}]`}
                value={item}
                indent={indent + 16}
                valueKey={childKey}
                selectedValueKey={selectedValueKey}
                onValueClick={onValueClick}
                isCurrentNav={isChildCurrentNav}
                canGoUp={isChildCurrentNav ? canGoUp : false}
                canGoDown={isChildCurrentNav ? canGoDown : false}
                onNavigateUp={onNavigateUp}
                onNavigateDown={onNavigateDown}
                navIndex={navIndex}
                chainLength={chainLength}
                valueChain={valueChain}
              />
            );
          })}
          {isObject && Object.entries(paramValue as object).map(([k, v]) => {
            const childKey = `${paramKey}.${k}`;
            const isChildCurrentNav = currentNavValueKey === childKey;
            return (
              <ValueRow
                key={k}
                label={`${k}:`}
                value={v}
                indent={indent + 16}
                labelColor="text-cyan-400/70"
                valueKey={childKey}
                selectedValueKey={selectedValueKey}
                onValueClick={onValueClick}
                isCurrentNav={isChildCurrentNav}
                canGoUp={isChildCurrentNav ? canGoUp : false}
                canGoDown={isChildCurrentNav ? canGoDown : false}
                onNavigateUp={onNavigateUp}
                onNavigateDown={onNavigateDown}
                navIndex={navIndex}
                chainLength={chainLength}
                valueChain={valueChain}
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
  currentNavigationParamKey?: string | null; // for param-level navigation
  currentNavValueKey?: string | null; // for value-level navigation
  valueChain?: string[]; // chain of value keys only
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
  currentNavigationStepId, currentNavigationParamKey, currentNavValueKey, valueChain = [], chainStepIds = [],
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

  // Auto-scroll when this step is the current navigation position or element-highlighted
  const isElementHighlighted = step.id === elementHighlightedStepId;
  useEffect(() => {
    if ((isCurrentNav || isElementHighlighted) && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isCurrentNav, isElementHighlighted]);

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
              <span className="text-primary">{step.functionName}</span>
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
              <span className="text-primary">{step.functionName}</span>
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
            // Only mark param selected if the param itself is selected, NOT when a child value is selected
            const isParamSelected = selectedParamKey === paramKey;
            const isParamInChain = chainStepIds.includes(paramKey);
            const isParamCurrentNav = currentNavigationParamKey === paramKey;
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
                valueChain={valueChain}
                currentNavValueKey={currentNavValueKey}
                isCurrentNav={isParamCurrentNav}
                canGoUp={canGoUp}
                canGoDown={canGoDown}
                onNavigateUp={onNavigateUp}
                onNavigateDown={onNavigateDown}
                navIndex={navIndex}
                chainLength={chainLength}
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
          currentNavigationParamKey={currentNavigationParamKey}
          currentNavValueKey={currentNavValueKey}
          valueChain={valueChain}
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
  
  // Auto-expand ancestors when element is clicked in Anim panel (to reveal the IR step)
  useEffect(() => {
    if (!elementHighlightedStepId) return;
    
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
    
    // Walk up parent chain and expand each ancestor
    const toExpand = new Set<string>();
    let currentId: string | undefined = elementHighlightedStepId;
    while (currentId) {
      const parentId = parentMap.get(currentId);
      if (parentId) {
        toExpand.add(parentId);
      }
      currentId = parentId;
    }
    
    // Update expanded set
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
  
  // Current navigation param key (when navigating at param level - only when no value selected)
  const currentNavParamKey = useMemo(() => {
    if (selectedValueKey) return null; // Value takes precedence
    if (!anchorParamKey) return null;
    if (navIndex === 0) return anchorParamKey;
    return null;
  }, [anchorParamKey, selectedValueKey, navIndex]);
  
  // Build value chain - trace upstream values within the same step and parent values
  // For a selected value like "stepId:param.x.y", include parent path values and sibling params
  const valueChain = useMemo(() => {
    if (!selectedValueKey || !anchorStepId) return [];
    
    const chain: string[] = [selectedValueKey];
    
    // Get the step containing this value
    const step = allStepsMap.get(anchorStepId);
    if (!step?.resolvedArgs) return chain;
    
    // Parse the selected value key to understand its structure
    // Format: "stepId:paramName" or "stepId:paramName.key" or "stepId:paramName[idx]..."
    const colonIdx = selectedValueKey.indexOf(':');
    if (colonIdx === -1) return chain;
    
    const pathPart = selectedValueKey.slice(colonIdx + 1); // e.g., "param.x.y" or "param[0].x"
    
    // Build parent path values (walk up the object/array path)
    // For "stepId:span.x.y", add "stepId:span.x" and "stepId:span"
    let currentPath = pathPart;
    while (currentPath.includes('.') || currentPath.includes('[')) {
      // Find the last accessor (. or [)
      const lastDot = currentPath.lastIndexOf('.');
      const lastBracket = currentPath.lastIndexOf('[');
      const cutPoint = Math.max(lastDot, lastBracket);
      
      if (cutPoint > 0) {
        currentPath = currentPath.slice(0, cutPoint);
        const parentKey = `${anchorStepId}:${currentPath}`;
        if (!chain.includes(parentKey)) {
          chain.push(parentKey);
        }
      } else {
        break;
      }
    }
    
    // Also add other params from the same step as related values
    // (they're siblings in the calculation context)
    const entries = Object.entries(step.resolvedArgs);
    for (const [paramName] of entries) {
      const siblingKey = `${anchorStepId}:${paramName}`;
      // Don't add if it's already in chain or is ancestor of selected value
      if (!chain.includes(siblingKey) && !selectedValueKey.startsWith(siblingKey)) {
        chain.push(siblingKey);
      }
    }
    
    return chain;
  }, [selectedValueKey, anchorStepId, allStepsMap]);
  
  // Current navigation value key - which value in the chain is currently focused
  const currentNavValueKey = useMemo(() => {
    if (!selectedValueKey || valueChain.length === 0) return null;
    if (navIndex < valueChain.length) {
      return valueChain[navIndex];
    }
    return null;
  }, [selectedValueKey, valueChain, navIndex]);
  
  // Chain step IDs: all steps and params that should be dimly highlighted
  // When a value is selected, we DON'T highlight steps - only values in the valueChain
  const chainStepIds = useMemo(() => {
    // When a value is selected, don't highlight steps at all - value chain handles it
    if (selectedValueKey) return [];
    
    if (!anchorStepId) return [];
    const allInChain: string[] = [anchorStepId, ...ancestorChain];

    if (anchorParamKey) {
      allInChain.push(anchorParamKey);
    }

    return allInChain.filter(
      (id) => id !== currentNavStepId && id !== currentNavParamKey
    );
  }, [anchorStepId, ancestorChain, anchorParamKey, selectedValueKey, currentNavStepId, currentNavParamKey]);
  
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
  
  // Navigate up (to higher level / parent) - use valueChain when value selected
  const navigateUp = useCallback(() => {
    const maxIndex = selectedValueKey ? valueChain.length - 1 : ancestorChain.length;
    if (navIndex < maxIndex) {
      setNavIndex(navIndex + 1);
    }
  }, [navIndex, ancestorChain.length, selectedValueKey, valueChain.length]);
  
  // Navigate down (back toward anchor)
  const navigateDown = useCallback(() => {
    if (navIndex > 0) {
      setNavIndex(navIndex - 1);
    }
  }, [navIndex]);
  
  // Can navigate - use valueChain when value selected
  const canGoUp = selectedValueKey 
    ? navIndex < valueChain.length - 1 
    : anchorStepId && navIndex < ancestorChain.length;
  const canGoDown = navIndex > 0;
  
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
                selectedParamKey={selectedValueKey ? null : anchorParamKey}
                selectedValueKey={selectedValueKey}
                highlightedStepIds={highlightedStepIds}
                currentNavigationStepId={selectedValueKey ? null : (anchorParamKey ? null : currentNavStepId)}
                currentNavigationParamKey={selectedValueKey ? null : currentNavParamKey}
                currentNavValueKey={currentNavValueKey}
                valueChain={valueChain}
                chainStepIds={chainStepIds}
                canGoUp={!!canGoUp}
                canGoDown={!!canGoDown}
                onNavigateUp={navigateUp}
                onNavigateDown={navigateDown}
                navIndex={navIndex}
                chainLength={selectedValueKey ? valueChain.length - 1 : ancestorChain.length}
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
