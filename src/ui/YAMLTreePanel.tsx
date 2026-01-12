import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronRight, ChevronDown, Code, Play, Layers, Wand2, Settings } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import type { YAMLSpec, FunctionDef, Statement, Params } from '@/core/types';

interface YAMLTreePanelProps {
  spec: YAMLSpec | null;
  onFunctionSelect?: (fnName: string) => void;
  selectedFunction?: string | null;
  onParamsChange?: (params: Params) => void;
  onFunctionArgsChange?: (fnName: string, stmtIndex: number, newArgs: Record<string, unknown>) => void;
  // Controlled state props for persistence
  paramsExpanded?: boolean;
  expandedParams?: Set<string>;
  expandedFunctions?: Set<string>;
  onParamsExpandedChange?: (expanded: boolean) => void;
  onExpandedParamsChange?: (expanded: Set<string>) => void;
  onExpandedFunctionsChange?: (expanded: Set<string>) => void;
  // Highlight element by ID (for Anim -> Tree linking)
  highlightedElementId?: string | null;
}

interface FunctionNode {
  name: string;
  def: FunctionDef;
  children: string[]; // Functions this one calls
  category: 'entry' | 'logic' | 'presentation' | 'primitive';
}

// Extract function calls from statements
function extractCalls(statements: Statement[]): string[] {
  const calls: string[] = [];
  
  for (const stmt of statements) {
    if ('call' in stmt) {
      const fnName = stmt.call.fn;
      // Skip IR functions
      if (!fnName.includes('.')) {
        calls.push(fnName);
      }
    }
    if ('foreach' in stmt) {
      calls.push(...extractCalls(stmt.foreach.do));
    }
  }
  
  return [...new Set(calls)];
}

// Categorize function based on its behavior
function categorizeFunction(name: string, def: FunctionDef, entryFn: string): FunctionNode['category'] {
  if (name === entryFn) return 'entry';
  
  // Check if it only emits IR (primitive)
  const hasOnlyIR = def.body.every(stmt => 'ir' in stmt || 'return' in stmt);
  if (hasOnlyIR) return 'primitive';
  
  // Check if it calls ShowTextTimed, ShowMathTimed, etc. (presentation)
  const calls = extractCalls(def.body);
  const presentationPatterns = ['Show', 'CrossFade', 'Present', 'Animate'];
  const isPresentation = presentationPatterns.some(p => name.includes(p)) ||
    calls.some(c => presentationPatterns.some(p => c.includes(p)));
  if (isPresentation) return 'presentation';
  
  return 'logic';
}

// Build function tree
function buildTree(spec: YAMLSpec): Map<string, FunctionNode> {
  const nodes = new Map<string, FunctionNode>();
  const entryFn = spec.program?.entry?.call?.fn || '';
  
  if (!spec.defs) return nodes;
  
  for (const [name, def] of Object.entries(spec.defs)) {
    const children = extractCalls(def.body);
    nodes.set(name, {
      name,
      def,
      children,
      category: categorizeFunction(name, def, entryFn),
    });
  }
  
  return nodes;
}

function formatValue(v: unknown): string {
  if (typeof v === 'string') {
    if (v.startsWith('$')) return v;
    if (v.startsWith('$.')) return v;
    return `"${v}"`;
  }
  if (typeof v === 'object' && v !== null) {
    if ('expr' in v) return `expr(${(v as {expr: string}).expr})`;
    return JSON.stringify(v);
  }
  return String(v);
}

// Determine if a value is safely editable (won't break DSL execution)
function isSafelyEditable(value: unknown): boolean {
  // Numbers are always safe to edit
  if (typeof value === 'number') return true;
  
  // Strings that start with $ are variable/param references - NOT safe
  if (typeof value === 'string') {
    if (value.startsWith('$')) return false; // Variable ref like $N, $Ladder
    if (value.startsWith('$.')) return false; // Param ref like $.params.number
    return true; // Plain string literals are safe
  }
  
  // Objects (expr, nested) are not directly editable
  return false;
}

// Get visual style class based on editability
function getValueStyle(value: unknown, isEditable: boolean): string {
  if (isEditable && isSafelyEditable(value)) {
    return 'text-foreground'; // Bright, clearly editable
  }
  
  // Read-only styles based on type
  if (typeof value === 'string' && value.startsWith('$')) {
    return 'text-cyan-500/70 italic'; // Variable references
  }
  if (typeof value === 'object' && value !== null && 'expr' in value) {
    return 'text-blue-400/70 italic'; // Expressions
  }
  return 'text-muted-foreground'; // Other read-only
}

// Statement component with expandable args
interface StatementRowProps {
  stmt: Statement;
  defaultExpanded?: boolean;
  editable?: boolean;
  onArgsChange?: (newArgs: Record<string, unknown>) => void;
  isHighlighted?: boolean;
}

const StatementRow: React.FC<StatementRowProps> = ({ 
  stmt, 
  defaultExpanded = false,
  editable = false,
  onArgsChange,
  isHighlighted = false,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const rowRef = useRef<HTMLDivElement>(null);
  
  const highlightClass = isHighlighted ? 'bg-primary/20 ring-1 ring-primary/40 rounded' : '';
  
  // Auto-scroll into view when highlighted
  useEffect(() => {
    if (isHighlighted && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isHighlighted]);
  
  const handleArgChange = (key: string, value: string, originalValue: unknown) => {
    if (!onArgsChange || !('call' in stmt)) return;
    
    // Parse value based on original type
    let parsed: unknown = value;
    if (typeof originalValue === 'number') {
      parsed = value.trim() !== '' && !isNaN(Number(value)) ? Number(value) : value;
    } else if (typeof originalValue === 'boolean') {
      parsed = value === 'true';
    }
    
    const newArgs = { ...stmt.call.args, [key]: parsed };
    onArgsChange(newArgs);
  };
  
  if ('call' in stmt) {
    const args = Object.entries(stmt.call.args);
    const out = stmt.call.out ? ` → ${stmt.call.out}` : '';
    const hasArgs = args.length > 0;
    
    return (
      <div ref={rowRef} className={`py-1 ${highlightClass}`}>
        <div 
          className="flex items-center gap-1 cursor-pointer hover:bg-muted/30 rounded px-1 -mx-1"
          onClick={() => hasArgs && setExpanded(!expanded)}
        >
          {hasArgs ? (
            expanded ? (
              <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
            )
          ) : (
            <span className="w-3" />
          )}
          <span className="text-purple-400">call</span>
          <span className="text-primary">{stmt.call.fn}</span>
          {!expanded && hasArgs && (
            <span className="text-muted-foreground/60">({args.length} args)</span>
          )}
          {out && <span className="text-green-400">{out}</span>}
        </div>
        {expanded && hasArgs && (
          <div className="ml-6 pl-2 border-l border-border/40 mt-1 space-y-0.5">
            {args.map(([k, v]) => {
              const canEdit = editable && isSafelyEditable(v);
              return (
                <div key={k} className="flex items-center gap-2">
                  <span className="text-orange-400 min-w-[60px]">{k}:</span>
                  {canEdit ? (
                    <Input
                      type={typeof v === 'number' ? 'number' : 'text'}
                      value={String(v)}
                      onChange={(e) => handleArgChange(k, e.target.value, v)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-5 text-xs px-1.5 py-0 bg-primary/10 border-primary/30 hover:border-primary/50 focus:border-primary w-24"
                    />
                  ) : (
                    <span className={`break-all text-xs ${getValueStyle(v, editable)}`}>
                      {formatValue(v)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }
  
  if ('let' in stmt) {
    const vars = Object.entries(stmt.let);
    const hasVars = vars.length > 0;
    
    const handleLetArgChange = (varName: string, argKey: string, value: string, originalValue: unknown) => {
      if (!onArgsChange) return;
      
      let parsed: unknown = value;
      if (typeof originalValue === 'number') {
        parsed = value.trim() !== '' && !isNaN(Number(value)) ? Number(value) : value;
      }
      
      const varValue = stmt.let[varName] as { expr: string; args: Record<string, unknown> };
      if (varValue && typeof varValue === 'object' && 'args' in varValue) {
        const newLetStmt = {
          ...stmt.let,
          [varName]: {
            ...varValue,
            args: { ...varValue.args, [argKey]: parsed }
          }
        };
        onArgsChange(newLetStmt);
      }
    };
    
    return (
      <div className="py-1">
        <div 
          className="flex items-center gap-1 cursor-pointer hover:bg-muted/30 rounded px-1 -mx-1"
          onClick={() => hasVars && setExpanded(!expanded)}
        >
          {hasVars ? (
            expanded ? (
              <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
            )
          ) : (
            <span className="w-3" />
          )}
          <span className="text-yellow-400">let</span>
          {!expanded && <span className="text-muted-foreground/60">({vars.length} vars)</span>}
        </div>
        {expanded && hasVars && (
          <div className="ml-6 pl-2 border-l border-border/40 mt-1 space-y-1">
            {vars.map(([k, v]) => {
              // Check if it's an expression with args
              const isExpr = typeof v === 'object' && v !== null && 'expr' in v && 'args' in v;
              const exprObj = isExpr ? v as { expr: string; args: Record<string, unknown> } : null;
              const canEditLet = editable && isSafelyEditable(v);
              
              return (
                <div key={k}>
                  <div className="flex gap-2 items-center">
                    <span className="text-green-400">{k}</span>
                    <span className="text-muted-foreground">=</span>
                    {isExpr ? (
                      <span className="text-blue-400/70 italic text-xs">expr({exprObj?.expr})</span>
                    ) : canEditLet ? (
                      <Input
                        type={typeof v === 'number' ? 'number' : 'text'}
                        value={String(v)}
                        onChange={(e) => {
                          const parsed = typeof v === 'number' && !isNaN(Number(e.target.value)) 
                            ? Number(e.target.value) 
                            : e.target.value;
                          onArgsChange?.({ ...stmt.let, [k]: parsed });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="h-5 text-xs px-1.5 py-0 bg-primary/10 border-primary/30 hover:border-primary/50 focus:border-primary w-24"
                      />
                    ) : (
                      <span className={`break-all text-xs ${getValueStyle(v, editable)}`}>{formatValue(v)}</span>
                    )}
                  </div>
                  {/* Show editable args for expr */}
                  {isExpr && exprObj && Object.keys(exprObj.args).length > 0 && (
                    <div className="ml-4 pl-2 border-l border-border/30 mt-1 space-y-0.5">
                      {Object.entries(exprObj.args).map(([argK, argV]) => {
                        const canEditArg = editable && isSafelyEditable(argV);
                        return (
                          <div key={argK} className="flex items-center gap-2">
                            <span className="text-orange-400 text-xs min-w-[50px]">{argK}:</span>
                            {canEditArg ? (
                              <Input
                                type={typeof argV === 'number' ? 'number' : 'text'}
                                value={String(argV)}
                                onChange={(e) => handleLetArgChange(k, argK, e.target.value, argV)}
                                onClick={(e) => e.stopPropagation()}
                                className="h-5 text-xs px-1.5 py-0 bg-primary/10 border-primary/30 hover:border-primary/50 focus:border-primary w-24"
                              />
                            ) : (
                              <span className={`text-xs ${getValueStyle(argV, editable)}`}>{formatValue(argV)}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }
  
  if ('foreach' in stmt) {
    return (
      <div className="py-1">
        <div 
          className="flex items-center gap-1 cursor-pointer hover:bg-muted/30 rounded px-1 -mx-1"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
          )}
          <span className="text-pink-400">foreach</span>
          <span className="text-green-400">{stmt.foreach.var}</span>
          <span className="text-muted-foreground">in</span>
          <span className="text-foreground/80">{formatValue(stmt.foreach.range)}</span>
        </div>
        {expanded && (
          <div className="ml-6 pl-2 border-l border-border/40 mt-1">
            {stmt.foreach.do.map((s, i) => (
              <StatementRow key={i} stmt={s} />
            ))}
          </div>
        )}
      </div>
    );
  }
  
  if ('ir' in stmt) {
    const args = Object.entries(stmt.ir.args);
    const hasArgs = args.length > 0;
    
    const handleIrArgChange = (key: string, value: string, originalValue: unknown) => {
      if (!onArgsChange) return;
      
      let parsed: unknown = value;
      if (typeof originalValue === 'number') {
        parsed = value.trim() !== '' && !isNaN(Number(value)) ? Number(value) : value;
      }
      
      onArgsChange({ ...stmt.ir.args, [key]: parsed });
    };
    
    return (
      <div ref={rowRef} className={`py-1 ${highlightClass}`}>
        <div 
          className="flex items-center gap-1 cursor-pointer hover:bg-muted/30 rounded px-1 -mx-1"
          onClick={() => hasArgs && setExpanded(!expanded)}
        >
          {hasArgs ? (
            expanded ? (
              <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
            )
          ) : (
            <span className="w-3" />
          )}
          <span className="text-orange-400">ir</span>
          <span className="text-primary">{stmt.ir.fn}</span>
          {!expanded && hasArgs && (
            <span className="text-muted-foreground/60">({args.length} args)</span>
          )}
        </div>
        {expanded && hasArgs && (
          <div className="ml-6 pl-2 border-l border-border/40 mt-1 space-y-0.5">
            {args.map(([k, v]) => {
              const canEdit = editable && isSafelyEditable(v);
              return (
                <div key={k} className="flex items-center gap-2">
                  <span className="text-orange-400 min-w-[50px]">{k}:</span>
                  {canEdit ? (
                    <Input
                      type={typeof v === 'number' ? 'number' : 'text'}
                      value={String(v)}
                      onChange={(e) => handleIrArgChange(k, e.target.value, v)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-5 text-xs px-1.5 py-0 bg-primary/10 border-primary/30 hover:border-primary/50 focus:border-primary w-24"
                    />
                  ) : (
                    <span className={`break-all text-xs ${getValueStyle(v, editable)}`}>{formatValue(v)}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }
  
  if ('return' in stmt) {
    return (
      <div className="py-1 flex items-center gap-1">
        <span className="w-3" />
        <span className="text-red-400">return</span>
        <span className="text-foreground/80">{formatValue(stmt.return)}</span>
      </div>
    );
  }
  
  return <div className="py-1 text-muted-foreground">???</div>;
};

const categoryColors: Record<FunctionNode['category'], string> = {
  entry: 'text-primary',
  logic: 'text-primary',
  presentation: 'text-primary',
  primitive: 'text-primary',
};

const categoryIcons: Record<FunctionNode['category'], React.ReactNode> = {
  entry: <Play className="w-3.5 h-3.5" />,
  logic: <Play className="w-3.5 h-3.5" />,
  presentation: <Play className="w-3.5 h-3.5" />,
  primitive: <Play className="w-3.5 h-3.5" />,
};

const categoryLabels: Record<FunctionNode['category'], string> = {
  entry: 'Entry Point',
  logic: 'Logic',
  presentation: 'Presentation',
  primitive: 'Primitive',
};

interface TreeNodeProps {
  node: FunctionNode;
  allNodes: Map<string, FunctionNode>;
  depth: number;
  expanded: Set<string>;
  onToggle: (name: string) => void;
  selected: string | null;
  onSelect: (name: string) => void;
  editable?: boolean;
  onArgsChange?: (stmtIndex: number, newArgs: Record<string, unknown>) => void;
  highlightedElementId?: string | null;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  allNodes,
  depth,
  expanded,
  onToggle,
  selected,
  onSelect,
  editable = false,
  onArgsChange,
  highlightedElementId,
}) => {
  const isExpanded = expanded.has(node.name);
  const hasBody = node.def.body.length > 0;
  const isSelected = selected === node.name;
  
  // Check if any statement in this node creates/targets the highlighted element
  // This returns an array of all element IDs that could be created by this statement
  const getStatementElementIds = (stmt: Statement): string[] => {
    const ids: string[] = [];
    
    // Check ir statements (primitives)
    if ('ir' in stmt && stmt.ir.args.id) {
      const id = stmt.ir.args.id;
      // Only match if it's a literal string, not a variable reference
      if (typeof id === 'string' && !id.startsWith('$')) {
        ids.push(id);
      }
    }
    // Check call statements with id argument
    if ('call' in stmt && stmt.call.args.id) {
      const id = stmt.call.args.id;
      // Only match if it's a literal string, not a variable reference or expression
      if (typeof id === 'string' && !id.startsWith('$')) {
        ids.push(id);
      }
    }
    // Check foreach loops - if the loop generates IDs with patterns like R0, R1, L0, L1...
    // We mark the foreach as containing the ID if the pattern matches
    if ('foreach' in stmt) {
      // Check inner statements for ID patterns
      for (const innerStmt of stmt.foreach.do) {
        const innerIds = getStatementElementIds(innerStmt);
        ids.push(...innerIds);
      }
    }
    return ids;
  };
  
  // Check if a statement could generate an element with a pattern-based ID
  // This matches IDs like "R0", "R1", "L0", "L1" to foreach loops that generate them
  const statementMatchesElementId = (stmt: Statement, elementId: string): boolean => {
    const directIds = getStatementElementIds(stmt);
    if (directIds.includes(elementId)) return true;
    
    // Check for pattern-based ID generation in call statements (e.g., core.format('R%d', i))
    if ('call' in stmt && stmt.call.args.id) {
      const idArg = stmt.call.args.id;
      if (typeof idArg === 'object' && idArg !== null && 'expr' in idArg) {
        const expr = (idArg as { expr: string }).expr;
        // Match patterns like "core.format('R%d', i)" or "core.format('L%d', ...)"
        const formatMatch = expr.match(/core\.format\s*\(\s*['"]([^'"]+)['"]/);
        if (formatMatch) {
          const pattern = formatMatch[1]; // e.g., "R%d" or "L%d"
          // Convert pattern to regex: "R%d" -> /^R\d+$/
          const regexPattern = pattern.replace(/%d/g, '\\d+');
          const regex = new RegExp(`^${regexPattern}$`);
          if (regex.test(elementId)) return true;
        }
      }
    }
    
    // For foreach loops, check inner statements recursively
    if ('foreach' in stmt) {
      for (const innerStmt of stmt.foreach.do) {
        if (statementMatchesElementId(innerStmt, elementId)) return true;
      }
    }
    return false;
  };
  
  return (
    <div>
      {/* Function header */}
      <div
        className={`
          flex items-center gap-1.5 px-2 py-1.5 cursor-pointer rounded transition-colors
          ${isSelected ? 'bg-primary/20 ring-1 ring-primary/40' : 'hover:bg-muted/50'}
        `}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(node.name)}
      >
        {/* Expand/collapse button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle(node.name);
          }}
          className={`p-0.5 rounded hover:bg-muted ${!hasBody && 'invisible'}`}
        >
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>
        
        {/* Category icon */}
        <span className={categoryColors[node.category]}>
          {categoryIcons[node.category]}
        </span>
        
        {/* Function name */}
        <span className={`font-mono text-sm ${categoryColors[node.category]}`}>
          {node.name}
        </span>
        
        {/* Params */}
        <span className="text-xs text-muted-foreground">
          ({node.def.params.join(', ')})
        </span>
        
        {/* Category badge */}
        <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${categoryColors[node.category]} bg-current/10`}>
          {categoryLabels[node.category]}
        </span>
      </div>
      
      {/* Expanded content - just the function body */}
      {isExpanded && (
        <div className="border-l border-border/50 ml-6">
          <div className="py-1 px-3 text-xs font-mono bg-muted/20 rounded-r my-1 mx-2">
            {node.def.body.map((stmt, idx) => {
              const isStmtHighlighted = highlightedElementId && statementMatchesElementId(stmt, highlightedElementId);
              return (
                <StatementRow 
                  key={idx} 
                  stmt={stmt} 
                  editable={editable}
                  onArgsChange={onArgsChange ? (newArgs) => onArgsChange(idx, newArgs) : undefined}
                  isHighlighted={!!isStmtHighlighted}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// Editable params section component
interface ParamsEditorProps {
  params: Params;
  onChange: (params: Params) => void;
  // Controlled state props
  mainExpanded?: boolean;
  expandedParams?: Set<string>;
  onMainExpandedChange?: (expanded: boolean) => void;
  onExpandedParamsChange?: (expanded: Set<string>) => void;
}

const ParamsEditor: React.FC<ParamsEditorProps> = ({ 
  params, 
  onChange,
  mainExpanded = true,
  expandedParams = new Set(['number']),
  onMainExpandedChange,
  onExpandedParamsChange,
}) => {
  
  const toggleParam = (key: string) => {
    const next = new Set(expandedParams);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onExpandedParamsChange?.(next);
  };
  
  const handleValueChange = (key: string, value: string) => {
    // Try to parse as number, otherwise keep as string
    const parsed = !isNaN(Number(value)) && value.trim() !== '' ? Number(value) : value;
    onChange({ ...params, [key]: parsed } as Params);
  };
  
  const renderNestedValue = (key: string, value: unknown, path: string[] = []): React.ReactNode => {
    const fullPath = [...path, key].join('.');
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Nested object - render recursively
      return (
        <div key={fullPath} className="ml-2 border-l border-border/40 pl-2">
          <div className="text-xs text-muted-foreground py-1">{key}:</div>
          {Object.entries(value).map(([k, v]) => renderNestedValue(k, v, [...path, key]))}
        </div>
      );
    }
    
    if (typeof value === 'number' || typeof value === 'string') {
      return (
        <div key={fullPath} className="flex items-center gap-2 py-1">
          <span className="text-xs text-orange-400 min-w-[80px]">{key}:</span>
          <Input
            type={typeof value === 'number' ? 'number' : 'text'}
            value={String(value)}
            onChange={(e) => {
              // Update nested value
              if (path.length === 0) {
                handleValueChange(key, e.target.value);
              } else {
                // Deep update for nested params
                const newParams = JSON.parse(JSON.stringify(params)) as Params;
                let obj: Record<string, unknown> = newParams as unknown as Record<string, unknown>;
                for (const p of path) {
                  obj = obj[p] as Record<string, unknown>;
                }
                const parsed = !isNaN(Number(e.target.value)) && e.target.value.trim() !== '' 
                  ? Number(e.target.value) 
                  : e.target.value;
                obj[key] = parsed;
                onChange(newParams);
              }
            }}
            className="h-6 text-xs px-2 py-0 bg-muted/50 border-border/50 w-24"
          />
        </div>
      );
    }
    
    // Array or other - display as read-only
    return (
      <div key={fullPath} className="flex items-center gap-2 py-1">
        <span className="text-xs text-orange-400 min-w-[80px]">{key}:</span>
        <span className="text-xs text-foreground/60">{JSON.stringify(value)}</span>
      </div>
    );
  };
  
  const renderParamInput = (key: string, value: unknown) => {
    const isObject = typeof value === 'object' && value !== null && !Array.isArray(value);
    const isExpanded = expandedParams.has(key);
    
    // For primitive values (like 'number'), just render the input directly
    if (!isObject) {
      return (
        <div key={key} className="flex items-center gap-2 py-1.5 px-2 hover:bg-muted/30 rounded">
          <span className="text-xs text-orange-400 font-medium min-w-[80px]">{key}:</span>
          <Input
            type={typeof value === 'number' ? 'number' : 'text'}
            value={String(value)}
            onChange={(e) => handleValueChange(key, e.target.value)}
            className="h-6 text-xs px-2 py-0 bg-primary/10 border-primary/30 hover:border-primary/50 focus:border-primary w-24"
          />
        </div>
      );
    }
    
    // For objects, render as collapsible section
    return (
      <div key={key} className="border-b border-border/30 last:border-b-0">
        <div 
          className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-muted/30 rounded"
          onClick={() => toggleParam(key)}
        >
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
          )}
          <span className="text-xs text-orange-400 font-medium">{key}</span>
          {!isExpanded && (
            <span className="text-xs text-muted-foreground">
              ({Object.keys(value as object).length} fields)
            </span>
          )}
        </div>
        {isExpanded && (
          <div className="ml-4 pl-2 pb-2 border-l border-border/40">
            {Object.entries(value as object).map(([k, v]) => renderNestedValue(k, v, [key]))}
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="border-b border-border/50">
      <div 
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/30"
        onClick={() => onMainExpandedChange?.(!mainExpanded)}
      >
        {mainExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        )}
        <Settings className="w-3.5 h-3.5 text-primary" />
        <span className="text-sm font-medium text-primary">Parameters</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {Object.keys(params).length} params
        </span>
      </div>
      {mainExpanded && (
        <div className="px-2 pb-2">
          {Object.entries(params).map(([k, v]) => renderParamInput(k, v))}
        </div>
      )}
    </div>
  );
};

export const YAMLTreePanel: React.FC<YAMLTreePanelProps> = ({
  spec,
  onFunctionSelect,
  selectedFunction,
  onParamsChange,
  onFunctionArgsChange,
  // Controlled state props with defaults
  paramsExpanded = true,
  expandedParams = new Set(['number']),
  expandedFunctions = new Set(['SimplifyRoot']),
  onParamsExpandedChange,
  onExpandedParamsChange,
  onExpandedFunctionsChange,
  highlightedElementId,
}) => {
  const [selected, setSelected] = useState<string | null>(selectedFunction || null);
  
  const nodes = useMemo(() => {
    if (!spec) return new Map();
    return buildTree(spec);
  }, [spec]);
  
  // Helper to check if a statement contains the highlighted element ID (including pattern-based)
  const statementHasElementId = (stmt: Statement, elementId: string): boolean => {
    // Check direct literal IDs
    if ('ir' in stmt && stmt.ir.args.id) {
      const id = stmt.ir.args.id;
      if (typeof id === 'string' && !id.startsWith('$') && id === elementId) {
        return true;
      }
    }
    if ('call' in stmt && stmt.call.args.id) {
      const id = stmt.call.args.id;
      if (typeof id === 'string' && !id.startsWith('$') && id === elementId) {
        return true;
      }
      // Check for pattern-based ID generation (e.g., core.format('R%d', i))
      if (typeof id === 'object' && id !== null && 'expr' in id) {
        const expr = (id as { expr: string }).expr;
        const formatMatch = expr.match(/core\.format\s*\(\s*['"]([^'"]+)['"]/);
        if (formatMatch) {
          const pattern = formatMatch[1];
          const regexPattern = pattern.replace(/%d/g, '\\d+');
          const regex = new RegExp(`^${regexPattern}$`);
          if (regex.test(elementId)) return true;
        }
      }
    }
    // Check foreach loops recursively
    if ('foreach' in stmt) {
      for (const innerStmt of stmt.foreach.do) {
        if (statementHasElementId(innerStmt, elementId)) return true;
      }
    }
    return false;
  };
  
  // Find which function contains the highlighted element
  const functionWithHighlightedElement = useMemo(() => {
    if (!highlightedElementId || !spec?.defs) return null;
    
    for (const [fnName, fnDef] of Object.entries(spec.defs)) {
      for (const stmt of fnDef.body) {
        if (statementHasElementId(stmt, highlightedElementId)) {
          return fnName;
        }
      }
    }
    return null;
  }, [highlightedElementId, spec]);
  
  // Auto-expand the function containing the highlighted element
  useEffect(() => {
    if (functionWithHighlightedElement && !expandedFunctions.has(functionWithHighlightedElement)) {
      const next = new Set(expandedFunctions);
      next.add(functionWithHighlightedElement);
      onExpandedFunctionsChange?.(next);
    }
  }, [functionWithHighlightedElement, expandedFunctions, onExpandedFunctionsChange]);
  
  // Show all functions as flat list
  const allFunctions = useMemo(() => {
    return Array.from(nodes.values()).sort((a, b) => {
      // Entry first, then by category, then alphabetically
      const categoryOrder = { entry: 0, logic: 1, presentation: 2, primitive: 3 };
      if (a.category !== b.category) {
        return categoryOrder[a.category] - categoryOrder[b.category];
      }
      return a.name.localeCompare(b.name);
    });
  }, [nodes]);
  
  const handleToggle = (name: string) => {
    const next = new Set(expandedFunctions);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    onExpandedFunctionsChange?.(next);
  };
  
  const handleSelect = (name: string) => {
    setSelected(name);
    onFunctionSelect?.(name);
  };
  
  // Expand all / collapse all
  const expandAll = () => {
    onExpandedFunctionsChange?.(new Set(nodes.keys()));
  };
  
  const collapseAll = () => {
    onExpandedFunctionsChange?.(new Set());
  };
  
  if (!spec) {
    return (
      <div className="flex flex-col h-full panel">
        <div className="panel-header">YAMLScript Tree</div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          No spec loaded
        </div>
      </div>
    );
  }
  
  const handleParamsChange = (newParams: Params) => {
    onParamsChange?.(newParams);
  };
  
  return (
    <div className="flex flex-col h-full panel">
      <div className="panel-header flex items-center justify-between">
        <span>YAMLScript Tree</span>
        <div className="flex gap-1">
          <button
            onClick={expandAll}
            className="text-xs px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="text-xs px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground"
          >
            Collapse
          </button>
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        {/* Editable Parameters */}
        {spec?.params && onParamsChange && (
          <ParamsEditor 
            params={spec.params} 
            onChange={handleParamsChange}
            mainExpanded={paramsExpanded}
            expandedParams={expandedParams}
            onMainExpandedChange={onParamsExpandedChange}
            onExpandedParamsChange={onExpandedParamsChange}
          />
        )}
        
        
        <div className="py-2">
          {allFunctions.map(node => (
            <TreeNode
              key={node.name}
              node={node}
              allNodes={nodes}
              depth={0}
              expanded={expandedFunctions}
              onToggle={handleToggle}
              selected={selected}
              onSelect={handleSelect}
              editable={!!onFunctionArgsChange}
              onArgsChange={onFunctionArgsChange ? (stmtIdx, newArgs) => onFunctionArgsChange(node.name, stmtIdx, newArgs) : undefined}
              highlightedElementId={highlightedElementId}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
