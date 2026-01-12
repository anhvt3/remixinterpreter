import React, { useRef, useEffect, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { Undo2, Redo2 } from 'lucide-react';
import { SyntaxHighlighter, SyntaxHighlightedLine } from './SyntaxHighlighter';

interface CodePanelProps {
  title: string;
  content: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  language?: 'yaml' | 'json' | 'text';
  onLineClick?: (lineIndex: number) => void;
  highlightedLines?: number[];
  zoomLevel?: number;
}

export const CodePanel: React.FC<CodePanelProps> = ({
  title,
  content,
  onChange,
  readOnly = false,
  language = 'text',
  onLineClick,
  highlightedLines = [],
  zoomLevel = 100,
}) => {
  const lines = content.split('\n');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // If we have line click handlers, render as clickable lines overlay
  const hasLineInteraction = !!onLineClick;
  
  // Undo/redo for editable mode
  const { setValue, undo, redo, canUndo, canRedo } = useUndoRedo(content, onChange);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
      e.preventDefault();
      redo();
    }
  }, [undo, redo]);

  // Scroll to first highlighted line when highlights change (works in both modes)
  useEffect(() => {
    if (highlightedLines.length === 0 || !containerRef.current) return;

    const viewport = containerRef.current.querySelector(
      '[data-radix-scroll-area-viewport]',
    ) as HTMLDivElement | null;

    const scrollEl = viewport ?? containerRef.current;

    const firstLine = Math.min(...highlightedLines);
    const lineHeight = 25.6; // Approximate line height
    scrollEl.scrollTop = Math.max(0, firstLine * lineHeight - 50);
  }, [highlightedLines]);

  return (
    <div className="flex flex-col h-full min-h-0 panel">
      <div className="panel-header flex items-center justify-between shrink-0">
        <span>{title}</span>
        <div className="flex items-center gap-2">
          {!hasLineInteraction && !readOnly && (
            <div className="flex items-center gap-1">
              <button
                onClick={undo}
                disabled={!canUndo}
                className="p-1 rounded hover:bg-muted/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                className="p-1 rounded hover:bg-muted/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Redo (Ctrl+Shift+Z)"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <span className="text-xs text-syntax-comment">{language.toUpperCase()}</span>
        </div>
      </div>
      {hasLineInteraction ? (
        <ScrollArea ref={containerRef} type="always" className="flex-1 min-h-0">
          {/* Render as clickable lines with syntax highlighting */}
          <div className="p-4 pr-10 text-sm font-mono" style={{ zoom: zoomLevel / 100 }}>
            {lines.map((line, idx) => {
              const isHighlighted = highlightedLines.includes(idx);
              return (
                <div
                  key={idx}
                  onClick={() => onLineClick?.(idx)}
                  className={`
                    px-2 py-0.5 -mx-2 rounded cursor-pointer transition-colors duration-150 flex
                    ${isHighlighted 
                      ? 'bg-primary/30 border-l-2 border-primary' 
                      : 'hover:bg-muted/50'
                    }
                  `}
                  style={{ lineHeight: '1.6' }}
                >
                  <span className="text-muted-foreground/50 select-none w-6 inline-block text-right mr-3 text-xs shrink-0">
                    {idx + 1}
                  </span>
                  <span className="flex-1">
                    <SyntaxHighlightedLine line={line} language={language} />
                  </span>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      ) : (
        <ScrollArea ref={containerRef} type="always" className="flex-1 min-h-0">
          {/* Render as editable textarea with syntax highlighting overlay */}
          <div className="relative p-4 pr-10" style={{ zoom: zoomLevel / 100 }}>
            {/* Syntax highlighted layer (behind) */}
            <div
              className="absolute inset-0 p-4 pr-10 pointer-events-none select-none"
              aria-hidden="true"
            >
              <SyntaxHighlighter content={content} language={language} />
            </div>
            {/* Transparent textarea (front, for editing) */}
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              readOnly={readOnly}
              className="relative w-full bg-transparent text-transparent caret-foreground text-sm font-mono resize-none focus:outline-none border-none selection:bg-primary/40 selection:text-foreground"
              style={{
                lineHeight: '1.6',
                tabSize: 2,
                minHeight: `${Math.max(lines.length + 5, 20) * 1.6}em`,
                caretColor: 'hsl(var(--foreground))',
              }}
              spellCheck={false}
            />
          </div>
        </ScrollArea>
      )}
    </div>
  );
};