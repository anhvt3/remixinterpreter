import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Code, Play, Layers, Wand2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { YAMLSpec, FunctionDef, Statement } from '@/core/types';

interface YAMLTreePanelProps {
  spec: YAMLSpec | null;
  onFunctionSelect?: (fnName: string) => void;
  selectedFunction?: string | null;
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

// Statement component with expandable args
interface StatementRowProps {
  stmt: Statement;
  defaultExpanded?: boolean;
}

const StatementRow: React.FC<StatementRowProps> = ({ stmt, defaultExpanded = false }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  
  if ('call' in stmt) {
    const args = Object.entries(stmt.call.args);
    const out = stmt.call.out ? ` → ${stmt.call.out}` : '';
    const hasArgs = args.length > 0;
    
    return (
      <div className="py-1">
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
            {args.map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="text-orange-400">{k}:</span>
                <span className="text-foreground/80 break-all">{formatValue(v)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  
  if ('let' in stmt) {
    const vars = Object.entries(stmt.let);
    const hasVars = vars.length > 0;
    
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
          <div className="ml-6 pl-2 border-l border-border/40 mt-1 space-y-0.5">
            {vars.map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="text-green-400">{k}</span>
                <span className="text-muted-foreground">=</span>
                <span className="text-foreground/80 break-all">{formatValue(v)}</span>
              </div>
            ))}
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
    
    return (
      <div className="py-1">
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
            {args.map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="text-orange-400">{k}:</span>
                <span className="text-foreground/80 break-all">{formatValue(v)}</span>
              </div>
            ))}
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
  logic: 'text-green-400',
  presentation: 'text-purple-400',
  primitive: 'text-orange-400',
};

const categoryIcons: Record<FunctionNode['category'], React.ReactNode> = {
  entry: <Play className="w-3.5 h-3.5" />,
  logic: <Wand2 className="w-3.5 h-3.5" />,
  presentation: <Layers className="w-3.5 h-3.5" />,
  primitive: <Code className="w-3.5 h-3.5" />,
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
}

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  allNodes,
  depth,
  expanded,
  onToggle,
  selected,
  onSelect,
}) => {
  const isExpanded = expanded.has(node.name);
  const hasBody = node.def.body.length > 0;
  const isSelected = selected === node.name;
  
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
            {node.def.body.map((stmt, idx) => (
              <StatementRow key={idx} stmt={stmt} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const YAMLTreePanel: React.FC<YAMLTreePanelProps> = ({
  spec,
  onFunctionSelect,
  selectedFunction,
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['SimplifyRoot']));
  const [selected, setSelected] = useState<string | null>(selectedFunction || null);
  
  const nodes = useMemo(() => {
    if (!spec) return new Map();
    return buildTree(spec);
  }, [spec]);
  
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
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };
  
  const handleSelect = (name: string) => {
    setSelected(name);
    onFunctionSelect?.(name);
  };
  
  // Expand all / collapse all
  const expandAll = () => {
    setExpanded(new Set(nodes.keys()));
  };
  
  const collapseAll = () => {
    setExpanded(new Set());
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
      
      {/* Legend */}
      <div className="flex gap-3 px-3 py-2 border-b border-border/50 text-[10px]">
        {(['entry', 'logic', 'presentation', 'primitive'] as const).map(cat => (
          <div key={cat} className={`flex items-center gap-1 ${categoryColors[cat]}`}>
            {categoryIcons[cat]}
            <span>{categoryLabels[cat]}</span>
          </div>
        ))}
      </div>
      
      <ScrollArea className="flex-1">
        <div className="py-2">
          {allFunctions.map(node => (
            <TreeNode
              key={node.name}
              node={node}
              allNodes={nodes}
              depth={0}
              expanded={expanded}
              onToggle={handleToggle}
              selected={selected}
              onSelect={handleSelect}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
