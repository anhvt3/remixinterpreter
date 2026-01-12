import React, { useRef, useEffect, useCallback, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { Undo2, Redo2, Save } from 'lucide-react';
import { SyntaxHighlighter, SyntaxHighlightedLine } from './SyntaxHighlighter';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface CodePanelProps {
  title: string;
  content: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  language?: 'yaml' | 'json' | 'text';
  onLineClick?: (lineIndex: number) => void;
  highlightedLines?: number[];
  zoomLevel?: number;
  showHeader?: boolean;
  onSave?: (value: string) => void;
  hasUnsavedChanges?: boolean;
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
  showHeader = true,
  onSave,
  hasUnsavedChanges: externalUnsaved,
}) => {
  const lines = content.split('\n');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  
  // Track if user has made changes
  const [localContent, setLocalContent] = useState(content);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const pendingBlurRef = useRef(false);
  
  // Sync local content when external content changes (e.g., after save)
  useEffect(() => {
    setLocalContent(content);
  }, [content]);
  
  const hasUnsavedChanges = externalUnsaved !== undefined ? externalUnsaved : localContent !== content;
  
  // If we have line click handlers, render as clickable lines overlay
  const hasLineInteraction = !!onLineClick;
  
  // Undo/redo for editable mode
  const { setValue, undo, redo, canUndo, canRedo } = useUndoRedo(localContent, (val) => {
    setLocalContent(val);
    // Don't call onChange here - only on save
  });

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
    // Ctrl+S to save
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  }, [undo, redo]);

  const handleSave = useCallback(() => {
    if (onSave) {
      onSave(localContent);
    } else if (onChange) {
      onChange(localContent);
    }
  }, [localContent, onSave, onChange]);

  const handleDiscard = useCallback(() => {
    setLocalContent(content);
    setShowSaveDialog(false);
  }, [content]);

  // Handle blur - check if cursor is leaving the panel
  const handlePanelBlur = useCallback((e: React.FocusEvent) => {
    // Check if the new focus target is outside this panel
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    const isInsidePanel = panelRef.current?.contains(relatedTarget);
    
    if (!isInsidePanel && hasUnsavedChanges && !readOnly) {
      pendingBlurRef.current = true;
      setShowSaveDialog(true);
    }
  }, [hasUnsavedChanges, readOnly]);

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

  // Render header controls (for use in parent or standalone)
  const renderControls = () => (
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
      <button
        onClick={handleSave}
        disabled={!hasUnsavedChanges}
        className={`p-1 rounded transition-colors ${
          hasUnsavedChanges 
            ? 'text-primary hover:bg-primary/20' 
            : 'opacity-30 cursor-not-allowed'
        }`}
        title="Save (Ctrl+S)"
      >
        <Save className="w-3.5 h-3.5" />
      </button>
      <span className="text-xs text-syntax-comment ml-1">{language.toUpperCase()}</span>
      {hasUnsavedChanges && (
        <span className="text-xs text-primary ml-1">•</span>
      )}
    </div>
  );

  return (
    <div 
      ref={panelRef}
      className="flex flex-col h-full min-h-0 panel"
      onBlur={handlePanelBlur}
    >
      {showHeader && (
        <div className="panel-header flex items-center justify-between shrink-0">
          <span>{title}</span>
          <div className="flex items-center gap-2">
            {!hasLineInteraction && !readOnly && renderControls()}
            {(hasLineInteraction || readOnly) && (
              <span className="text-xs text-syntax-comment">{language.toUpperCase()}</span>
            )}
          </div>
        </div>
      )}
      
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
                  <span className="text-muted-foreground/50 select-none w-8 inline-block text-right mr-3 text-xs shrink-0">
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
          {/* Render as editable textarea with syntax highlighting overlay and line numbers */}
          <div 
            className="relative text-sm font-mono cursor-text" 
            style={{ zoom: zoomLevel / 100 }}
            onClick={() => textareaRef.current?.focus()}
          >
            {/* Line numbers column */}
            <div className="absolute left-0 top-0 bottom-0 w-10 bg-muted/20 border-r border-border/30 select-none pointer-events-none">
              <div className="py-4 pr-2">
                {lines.map((_, idx) => (
                  <div 
                    key={idx} 
                    className="text-right text-muted-foreground/50 text-xs px-1"
                    style={{ lineHeight: '1.6' }}
                  >
                    {idx + 1}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Content area with padding for line numbers */}
            <div className="pl-12 pr-4">
              {/* Syntax highlighted layer (behind) */}
              <div
                className="absolute left-12 right-4 top-0 py-4 pointer-events-none select-none overflow-hidden"
                aria-hidden="true"
              >
                <SyntaxHighlighter content={localContent} language={language} />
              </div>
              {/* Transparent textarea (front, for editing) */}
              <textarea
                ref={textareaRef}
                value={localContent}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                readOnly={readOnly}
                className="relative w-full py-4 bg-transparent text-transparent caret-foreground resize-none focus:outline-none border-none selection:bg-primary/40 selection:text-foreground z-10"
                style={{
                  lineHeight: '1.6',
                  tabSize: 2,
                  minHeight: `${Math.max(lines.length + 5, 20) * 1.6}em`,
                  caretColor: 'hsl(var(--foreground))',
                }}
                spellCheck={false}
              />
            </div>
          </div>
        </ScrollArea>
      )}

      {/* Save/Discard Dialog */}
      <AlertDialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Would you like to save them before leaving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDiscard}>Discard</AlertDialogCancel>
            <AlertDialogAction onClick={() => { handleSave(); setShowSaveDialog(false); }}>
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// Export controls renderer for external use
export const CodePanelControls = CodePanel;
