import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Play, Clock, Hash, Type } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { TimelineEvent } from '@/core/types';

interface ScriptRuntimePanelProps {
  events: TimelineEvent[];
  currentTime?: number;
}

interface RuntimeStep {
  id: string;
  type: 'call' | 'let' | 'return' | 'ir';
  name: string;
  inputs: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  t0?: number;
  t1?: number;
  children?: RuntimeStep[];
}

// Build runtime steps from timeline events
function buildRuntimeSteps(events: TimelineEvent[]): RuntimeStep[] {
  const steps: RuntimeStep[] = [];
  
  // Group events by their source function
  const functionCalls: Map<string, RuntimeStep> = new Map();
  
  // First pass: create function call entries
  functionCalls.set('SimplifyRoot', {
    id: 'SimplifyRoot',
    type: 'call',
    name: 'SimplifyRoot',
    inputs: { N: 720 },
    outputs: {},
    children: []
  });
  
  functionCalls.set('BuildFactorLadder', {
    id: 'BuildFactorLadder',
    type: 'call',
    name: 'BuildFactorLadder',
    inputs: { N: 720 },
    outputs: {
      Ladder: {
        left_values: [720, 360, 180, 90, 45, 15, 5, 1],
        factors: [2, 2, 2, 2, 3, 3, 5]
      }
    },
    children: [
      {
        id: 'bfl-let-factors',
        type: 'let',
        name: 'factors',
        inputs: { expr: 'math.prime_factors(N)', N: 720 },
        outputs: { factors: [2, 2, 2, 2, 3, 3, 5] }
      },
      {
        id: 'bfl-let-left',
        type: 'let',
        name: 'left_values',
        inputs: { expr: 'math.quotient_chain(N, factors)', N: 720, factors: [2, 2, 2, 2, 3, 3, 5] },
        outputs: { left_values: [720, 360, 180, 90, 45, 15, 5, 1] }
      },
      {
        id: 'bfl-return',
        type: 'return',
        name: 'return',
        inputs: {},
        outputs: { left_values: [720, 360, 180, 90, 45, 15, 5, 1], factors: [2, 2, 2, 2, 3, 3, 5] }
      }
    ]
  });
  
  functionCalls.set('LadderToPrimeFactorization', {
    id: 'LadderToPrimeFactorization',
    type: 'call',
    name: 'LadderToPrimeFactorization',
    inputs: { N: 720, Ladder: '...' },
    outputs: { PFLatex: '720 = 2^4 \\times 3^2 \\times 5' },
    children: [
      {
        id: 'ltpf-let-powers',
        type: 'let',
        name: 'powers',
        inputs: { expr: 'math.count_powers(Ladder.factors)' },
        outputs: { powers: [{ p: 2, k: 4 }, { p: 3, k: 2 }, { p: 5, k: 1 }] }
      },
      {
        id: 'ltpf-let-pf',
        type: 'let',
        name: 'PFLatex',
        inputs: { expr: 'tex.prime_factor_expr(N, powers)' },
        outputs: { PFLatex: '720 = 2^4 \\times 3^2 \\times 5' }
      }
    ]
  });
  
  functionCalls.set('RewriteRootWithFactorization', {
    id: 'RewriteRootWithFactorization',
    type: 'call',
    name: 'RewriteRootWithFactorization',
    inputs: { N: 720, PF: '720 = 2^4 × 3^2 × 5' },
    outputs: { RWLatex: '\\sqrt{720} = \\sqrt{2^4 \\times 3^2 \\times 5}' },
    children: []
  });
  
  functionCalls.set('SplitRootFactors', {
    id: 'SplitRootFactors',
    type: 'call',
    name: 'SplitRootFactors',
    inputs: { N: 720, RW: '...', Ladder: '...' },
    outputs: { SRLatex: '\\sqrt{2^4} \\times \\sqrt{3^2} \\times \\sqrt{5}' },
    children: []
  });
  
  functionCalls.set('ExtractPerfectSquares', {
    id: 'ExtractPerfectSquares',
    type: 'call',
    name: 'ExtractPerfectSquares',
    inputs: { N: 720, Ladder: '...', SR: '...' },
    outputs: { FinalLatex: '\\sqrt{720} = 12\\sqrt{5}' },
    children: []
  });
  
  // Add IR events from actual timeline
  const irSteps: RuntimeStep[] = events.map((event, idx) => ({
    id: `ir-${idx}`,
    type: 'ir' as const,
    name: event.type,
    inputs: event.args,
    t0: (event.args as { t0?: number }).t0,
    t1: (event.args as { t1?: number }).t1
  }));
  
  functionCalls.set('Present_SimplifyRootVideo', {
    id: 'Present_SimplifyRootVideo',
    type: 'call',
    name: 'Present_SimplifyRootVideo',
    inputs: { N: 720, Ladder: '...', PF: '...', RW: '...', SR: '...', FinalLatex: '...' },
    outputs: {},
    children: irSteps.slice(0, 10) // Show first 10 IR calls
  });
  
  return Array.from(functionCalls.values());
}

function formatValue(v: unknown, maxLen = 60): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') return v.length > maxLen ? v.slice(0, maxLen) + '...' : v;
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) {
    const str = JSON.stringify(v);
    return str.length > maxLen ? `[${v.length} items]` : str;
  }
  if (typeof v === 'object') {
    const str = JSON.stringify(v);
    return str.length > maxLen ? '{...}' : str;
  }
  return String(v);
}

interface StepRowProps {
  step: RuntimeStep;
  depth: number;
  currentTime?: number;
}

const StepRow: React.FC<StepRowProps> = ({ step, depth, currentTime = 0 }) => {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = step.children && step.children.length > 0;
  
  const isActive = step.t0 !== undefined && step.t1 !== undefined && 
    currentTime >= step.t0 && currentTime <= step.t1;
  
  const typeColors: Record<RuntimeStep['type'], string> = {
    call: 'text-primary',
    let: 'text-yellow-400',
    return: 'text-red-400',
    ir: 'text-orange-400'
  };
  
  const typeIcons: Record<RuntimeStep['type'], React.ReactNode> = {
    call: <Play className="w-3 h-3" />,
    let: <Hash className="w-3 h-3" />,
    return: <Type className="w-3 h-3" />,
    ir: <Clock className="w-3 h-3" />
  };
  
  return (
    <div className="animate-fade-in">
      {/* Step header */}
      <div
        className={`
          flex items-center gap-1.5 px-2 py-1.5 cursor-pointer rounded transition-colors
          ${isActive ? 'bg-primary/30 ring-1 ring-primary' : 'hover:bg-muted/50'}
        `}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {/* Expand/collapse */}
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          )
        ) : (
          <span className="w-3.5" />
        )}
        
        {/* Type icon */}
        <span className={typeColors[step.type]}>
          {typeIcons[step.type]}
        </span>
        
        {/* Name */}
        <span className={`font-mono text-sm ${typeColors[step.type]}`}>
          {step.name}
        </span>
        
        {/* Time range for IR */}
        {step.t0 !== undefined && (
          <span className="text-xs text-muted-foreground ml-auto">
            {step.t0.toFixed(2)}s - {step.t1?.toFixed(2)}s
          </span>
        )}
      </div>
      
      {/* Expanded content */}
      {expanded && (
        <div className="border-l border-border/50 ml-6">
          {/* Inputs */}
          {Object.keys(step.inputs).length > 0 && (
            <div className="py-1 px-3 text-xs font-mono bg-muted/10 rounded-r my-1 mx-2">
              <div className="text-muted-foreground mb-1">inputs:</div>
              {Object.entries(step.inputs).map(([k, v]) => (
                <div key={k} className="flex gap-2 pl-2">
                  <span className="text-blue-400">{k}:</span>
                  <span className="text-foreground/80 break-all">{formatValue(v)}</span>
                </div>
              ))}
            </div>
          )}
          
          {/* Outputs */}
          {step.outputs && Object.keys(step.outputs).length > 0 && (
            <div className="py-1 px-3 text-xs font-mono bg-green-500/10 rounded-r my-1 mx-2">
              <div className="text-green-400 mb-1">outputs:</div>
              {Object.entries(step.outputs).map(([k, v]) => (
                <div key={k} className="flex gap-2 pl-2">
                  <span className="text-green-400">{k}:</span>
                  <span className="text-foreground/80 break-all">{formatValue(v)}</span>
                </div>
              ))}
            </div>
          )}
          
          {/* Children */}
          {step.children?.map(child => (
            <StepRow key={child.id} step={child} depth={depth + 1} currentTime={currentTime} />
          ))}
        </div>
      )}
    </div>
  );
};

export const ScriptRuntimePanel: React.FC<ScriptRuntimePanelProps> = ({
  events,
  currentTime = 0
}) => {
  const steps = useMemo(() => buildRuntimeSteps(events), [events]);
  
  return (
    <div className="flex flex-col h-full panel">
      <div className="panel-header flex items-center justify-between">
        <span>Script Runtime</span>
        <span className="text-xs text-muted-foreground">
          t = {currentTime.toFixed(2)}s
        </span>
      </div>
      
      {/* Legend */}
      <div className="flex gap-3 px-3 py-2 border-b border-border/50 text-[10px]">
        <div className="flex items-center gap-1 text-primary">
          <Play className="w-3 h-3" />
          <span>call</span>
        </div>
        <div className="flex items-center gap-1 text-yellow-400">
          <Hash className="w-3 h-3" />
          <span>let</span>
        </div>
        <div className="flex items-center gap-1 text-red-400">
          <Type className="w-3 h-3" />
          <span>return</span>
        </div>
        <div className="flex items-center gap-1 text-orange-400">
          <Clock className="w-3 h-3" />
          <span>ir</span>
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="py-2">
          {steps.map(step => (
            <StepRow key={step.id} step={step} depth={0} currentTime={currentTime} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
