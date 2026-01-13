import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Trash2, AlertTriangle, Code, Zap } from 'lucide-react';
import { useMissingFunctions, type MissingFunctionType } from '@/contexts/MissingFunctionsContext';

interface IRFMissingPanelProps {
  zoomLevel?: number;
}

const typeIcons: Record<MissingFunctionType, React.ReactNode> = {
  expression: <Code className="w-3 h-3 text-blue-400" />,
  ir: <Zap className="w-3 h-3 text-orange-400" />,
  dsl: <AlertTriangle className="w-3 h-3 text-yellow-400" />,
};

const typeLabels: Record<MissingFunctionType, string> = {
  expression: 'Expr',
  ir: 'IR',
  dsl: 'DSL',
};

const typeColors: Record<MissingFunctionType, string> = {
  expression: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  ir: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  dsl: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

export const IRFMissingPanel: React.FC<IRFMissingPanelProps> = ({ zoomLevel = 100 }) => {
  const { missingFunctions, clearMissingFunctions } = useMissingFunctions();
  const scale = zoomLevel / 100;

  // Group by type
  const expressionFns = missingFunctions.filter(f => f.type === 'expression');
  const irFns = missingFunctions.filter(f => f.type === 'ir');
  const dslFns = missingFunctions.filter(f => f.type === 'dsl');

  return (
    <div className="h-full min-h-0 overflow-hidden border border-border rounded-lg bg-card flex flex-col">
      <div className="h-8 px-3 flex items-center justify-between border-b border-border bg-muted/50 shrink-0">
        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
          Missing Functions ({missingFunctions.length})
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 hover:bg-destructive/20 hover:text-destructive"
          onClick={clearMissingFunctions}
          title="Clear all"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-3" style={{ fontSize: `${0.75 * scale}rem` }}>
          {missingFunctions.length === 0 ? (
            <div className="text-xs text-muted-foreground p-3 text-center">
              No missing functions detected
            </div>
          ) : (
            <>
              {/* Expression Functions */}
              {expressionFns.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[0.65rem] uppercase tracking-wider text-blue-400 font-medium flex items-center gap-1 px-1">
                    <Code className="w-3 h-3" />
                    Expression Functions ({expressionFns.length})
                  </div>
                  {expressionFns.map((fn, idx) => (
                    <FunctionItem key={`expr-${idx}`} fn={fn} />
                  ))}
                </div>
              )}

              {/* IR Functions */}
              {irFns.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[0.65rem] uppercase tracking-wider text-orange-400 font-medium flex items-center gap-1 px-1">
                    <Zap className="w-3 h-3" />
                    IR Functions ({irFns.length})
                  </div>
                  {irFns.map((fn, idx) => (
                    <FunctionItem key={`ir-${idx}`} fn={fn} />
                  ))}
                </div>
              )}

              {/* DSL Functions */}
              {dslFns.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[0.65rem] uppercase tracking-wider text-yellow-400 font-medium flex items-center gap-1 px-1">
                    <AlertTriangle className="w-3 h-3" />
                    DSL Functions ({dslFns.length})
                  </div>
                  {dslFns.map((fn, idx) => (
                    <FunctionItem key={`dsl-${idx}`} fn={fn} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

interface FunctionItemProps {
  fn: {
    name: string;
    type: MissingFunctionType;
    calledFrom?: string;
  };
}

const FunctionItem: React.FC<FunctionItemProps> = ({ fn }) => (
  <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-muted/30 hover:bg-muted/50 transition-colors">
    {typeIcons[fn.type]}
    <code className="text-xs font-mono text-foreground flex-1 truncate">
      {fn.name}
    </code>
    <span className={`text-[0.6rem] px-1.5 py-0.5 rounded border ${typeColors[fn.type]}`}>
      {typeLabels[fn.type]}
    </span>
  </div>
);
