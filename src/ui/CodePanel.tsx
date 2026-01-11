import React, { useRef, useEffect } from 'react';

interface CodePanelProps {
  title: string;
  content: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  language?: 'yaml' | 'json' | 'text';
  onLineClick?: (lineIndex: number) => void;
  highlightedLines?: number[];
}

export const CodePanel: React.FC<CodePanelProps> = ({
  title,
  content,
  onChange,
  readOnly = false,
  language = 'text',
  onLineClick,
  highlightedLines = [],
}) => {
  const lines = content.split('\n');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Scroll to first highlighted line when selection changes
  useEffect(() => {
    if (highlightedLines.length > 0 && containerRef.current) {
      const firstLine = Math.min(...highlightedLines);
      const lineHeight = 25.6; // Approximate line height
      containerRef.current.scrollTop = Math.max(0, firstLine * lineHeight - 50);
    }
  }, [highlightedLines]);

  // If we have line click handlers, render as clickable lines overlay
  const hasLineInteraction = !!onLineClick;

  return (
    <div className="flex flex-col h-full panel">
      <div className="panel-header flex items-center justify-between shrink-0">
        <span>{title}</span>
        <span className="text-xs text-syntax-comment">{language.toUpperCase()}</span>
      </div>
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/50 relative"
      >
        {hasLineInteraction ? (
          // Render as clickable lines with syntax highlighting
          <div className="p-4 text-sm font-mono">
            {lines.map((line, idx) => {
              const isHighlighted = highlightedLines.includes(idx);
              return (
                <div
                  key={idx}
                  onClick={() => onLineClick?.(idx)}
                  className={`
                    px-2 py-0.5 -mx-2 rounded cursor-pointer transition-colors duration-150
                    ${isHighlighted 
                      ? 'bg-primary/30 border-l-2 border-primary' 
                      : 'hover:bg-muted/50'
                    }
                  `}
                  style={{ lineHeight: '1.6' }}
                >
                  <span className="text-muted-foreground/50 select-none w-6 inline-block text-right mr-3 text-xs">
                    {idx + 1}
                  </span>
                  <span className={`${isHighlighted ? 'text-primary' : 'text-foreground'}`}>
                    {line || ' '}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          // Render as editable textarea
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => onChange?.(e.target.value)}
            readOnly={readOnly}
            className="w-full h-full min-h-[calc(100vh-12rem)] p-4 bg-transparent text-sm font-mono text-foreground resize-none focus:outline-none border-none"
            style={{
              lineHeight: '1.6',
              tabSize: 2,
            }}
            spellCheck={false}
          />
        )}
      </div>
    </div>
  );
};
