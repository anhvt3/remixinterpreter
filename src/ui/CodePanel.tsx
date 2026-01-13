import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { Undo2, Redo2, Save, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { SyntaxHighlighter, SyntaxHighlightedLine } from './SyntaxHighlighter';
import { lintYAML, LintError } from '@/core/yamlLinter';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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

  /**
   * Shows the built-in "Unsaved Changes" dialog when the editor blurs.
   * Disable this when the parent component handles save prompting.
   */
  enableSavePromptOnBlur?: boolean;

  /**
   * Enables Ctrl/Cmd+S inside the textarea.
   */
  enableSaveHotkey?: boolean;
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
  enableSavePromptOnBlur = true,
  enableSaveHotkey = true,
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
  
  // YAML linting
  const lintErrors = useMemo(() => {
    if (language !== 'yaml') return [];
    return lintYAML(localContent);
  }, [localContent, language]);
  
  // Create a map of line -> errors for quick lookup
  const errorsByLine = useMemo(() => {
    const map = new Map<number, LintError[]>();
    lintErrors.forEach(error => {
      const existing = map.get(error.line) || [];
      existing.push(error);
      map.set(error.line, existing);
    });
    return map;
  }, [lintErrors]);
  
  // If we have line click handlers, render as clickable lines overlay
  const hasLineInteraction = !!onLineClick;
  
  // Undo/redo for editable mode
  const { setValue, undo, redo, canUndo, canRedo } = useUndoRedo(localContent, (val) => {
    setLocalContent(val);
    onChange?.(val); // Notify parent of changes for tracking
  });

  const handleSave = useCallback(() => {
    if (onSave) {
      onSave(localContent);
    } else if (onChange) {
      onChange(localContent);
    }
  }, [localContent, onSave, onChange]);

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
    if (!readOnly && enableSaveHotkey && (e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  }, [undo, redo, handleSave, readOnly, enableSaveHotkey]);

  const handleDiscard = useCallback(() => {
    setLocalContent(content);
    setShowSaveDialog(false);
  }, [content]);

  // Handle blur - check if cursor is leaving the panel
  const handlePanelBlur = useCallback((e: React.FocusEvent) => {
    if (!enableSavePromptOnBlur) return;

    // Check if the new focus target is outside this panel
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    const isInsidePanel = panelRef.current?.contains(relatedTarget);

    if (!isInsidePanel && hasUnsavedChanges && !readOnly) {
      pendingBlurRef.current = true;
      setShowSaveDialog(true);
    }
  }, [enableSavePromptOnBlur, hasUnsavedChanges, readOnly]);

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
      {lintErrors.length > 0 && (() => {
        const hasRealError = lintErrors.some(e => e.severity === 'error');
        const hasWarning = lintErrors.some(e => e.severity === 'warning');
        const onlyInfo = !hasRealError && !hasWarning;
        return (
          <span className={`text-xs ml-1 flex items-center gap-0.5 ${
            hasRealError ? 'text-destructive' : hasWarning ? 'text-yellow-500' : 'text-cyan-500'
          }`}>
            {onlyInfo ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
            {lintErrors.filter(e => e.severity !== 'info').length || (onlyInfo ? '✓' : lintErrors.length)}
          </span>
        );
      })()}
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
          {/* Using fontSize scaling instead of zoom to avoid browser rendering limits */}
          <TooltipProvider delayDuration={200}>
            <div className="p-4 pr-10 font-mono" style={{ fontSize: `${14 * zoomLevel / 100}px` }}>
              {lines.map((line, idx) => {
                const isHighlighted = highlightedLines.includes(idx);
                const lineErrors = errorsByLine.get(idx);
                const hasError = lineErrors && lineErrors.some(e => e.severity === 'error');
                const hasWarning = lineErrors && lineErrors.some(e => e.severity === 'warning');
                const hasInfo = lineErrors && lineErrors.some(e => e.severity === 'info');
                const onlyInfo = hasInfo && !hasError && !hasWarning;
                
                return (
                  <div
                    key={idx}
                    onClick={() => onLineClick?.(idx)}
                    className={`
                      px-2 py-0.5 -mx-2 rounded cursor-pointer transition-colors duration-150 flex
                      ${isHighlighted 
                        ? 'bg-primary/30 border-l-2 border-primary' 
                        : hasError
                          ? 'bg-destructive/10 border-l-2 border-destructive'
                          : hasWarning
                            ? 'bg-yellow-500/10 border-l-2 border-yellow-500'
                            : 'hover:bg-muted/50'
                      }
                    `}
                    style={{ lineHeight: '1.6' }}
                  >
                    <span className="flex items-center gap-1 select-none w-12 justify-end mr-3 shrink-0" style={{ fontSize: '0.75em' }}>
                      {lineErrors && lineErrors.length > 0 && !onlyInfo ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={`flex items-center ${hasError ? 'text-destructive' : hasWarning ? 'text-yellow-500' : 'text-cyan-500'}`}>
                              {onlyInfo ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent 
                            side="right" 
                            className="max-w-xs bg-popover border-border z-50"
                          >
                            <div className="space-y-1">
                              {lineErrors.map((err, errIdx) => (
                                <div key={errIdx} className={`text-xs ${
                                  err.severity === 'error' ? 'text-destructive' 
                                    : err.severity === 'warning' ? 'text-yellow-500' 
                                    : 'text-cyan-500'
                                }`}>
                                  {err.message}
                                </div>
                              ))}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ) : null}
                      <span className={`${hasError ? 'text-destructive' : hasWarning ? 'text-yellow-500' : 'text-muted-foreground/50'}`}>
                        {idx + 1}
                      </span>
                    </span>
                    <span className="flex-1">
                      <SyntaxHighlightedLine line={line} language={language} />
                    </span>
                  </div>
                );
              })}
            </div>
          </TooltipProvider>
        </ScrollArea>
      ) : (
        <ScrollArea ref={containerRef} type="always" className="flex-1 min-h-0 overflow-hidden">
          {/* Render as editable textarea with syntax highlighting overlay and line numbers */}
          {/* Using fontSize scaling instead of zoom to avoid browser rendering limits */}
          <div 
            className="relative font-mono cursor-text" 
            style={{ fontSize: `${14 * zoomLevel / 100}px` }}
            onClick={() => textareaRef.current?.focus()}
          >
            {/* Line numbers column with error indicators */}
            <div className="flex">
              <TooltipProvider delayDuration={200}>
                <div className="w-14 bg-muted/20 border-r border-border/30 select-none shrink-0">
                  <div className="py-4 pr-1" style={{ minHeight: `${Math.max(localContent.split('\n').length + 5, 20) * 1.6}em` }}>
                    {localContent.split('\n').map((_, idx) => {
                      const lineErrors = errorsByLine.get(idx);
                      const hasError = lineErrors && lineErrors.some(e => e.severity === 'error');
                      const hasWarning = lineErrors && lineErrors.some(e => e.severity === 'warning');
                      const hasInfo = lineErrors && lineErrors.some(e => e.severity === 'info');
                      const onlyInfo = hasInfo && !hasError && !hasWarning;
                      
                      return (
                        <div 
                          key={idx} 
                          className="flex items-center justify-end gap-0.5 px-1"
                          style={{ height: '1.6em', lineHeight: '1.6em', fontSize: '0.75em' }}
                        >
                          {lineErrors && lineErrors.length > 0 && !onlyInfo ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={`flex items-center ${
                                  hasError ? 'text-destructive' : hasWarning ? 'text-yellow-500' : 'text-cyan-500'
                                }`}>
                                  {onlyInfo ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent 
                                side="right" 
                                className="max-w-xs bg-popover border-border z-50"
                              >
                                <div className="space-y-1">
                                  {lineErrors.map((err, errIdx) => (
                                    <div key={errIdx} className={`text-xs ${
                                      err.severity === 'error' ? 'text-destructive' 
                                        : err.severity === 'warning' ? 'text-yellow-500' 
                                        : 'text-cyan-500'
                                    }`}>
                                      {err.message}
                                    </div>
                                  ))}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          ) : null}
                          <span className={`text-right w-6 ${hasError ? 'text-destructive' : hasWarning ? 'text-yellow-500' : 'text-muted-foreground/50'}`}>
                            {idx + 1}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </TooltipProvider>
              
              {/* Content area */}
              <div className="flex-1 relative pl-2 pr-4 min-w-0">
                {/* Syntax highlighted layer (behind) */}
                <div
                  className="absolute left-2 right-4 top-0 py-4 pointer-events-none select-none"
                  aria-hidden="true"
                  style={{
                    lineHeight: '1.6',
                    minHeight: `${Math.max(localContent.split('\n').length + 5, 20) * 1.6}em`,
                  }}
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
                  wrap="off"
                  className="relative w-full py-4 bg-transparent text-transparent caret-foreground resize-none focus:outline-none border-none selection:bg-primary/40 selection:text-foreground z-10"
                  style={{
                    lineHeight: '1.6',
                    tabSize: 2,
                    height: `${Math.max(localContent.split('\n').length + 5, 20) * 1.6}em`,
                    minHeight: '100%',
                    caretColor: 'hsl(var(--foreground))',
                  }}
                  spellCheck={false}
                />
              </div>
            </div>
          </div>
        </ScrollArea>
      )}

      {/* Cancel/Save Dialog */}
      {enableSavePromptOnBlur && (
        <AlertDialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
              <AlertDialogDescription>
                You have unsaved changes. Would you like to save them?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowSaveDialog(false)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => { handleSave(); setShowSaveDialog(false); }}>
                Save
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};

// Export controls renderer for external use
export const CodePanelControls = CodePanel;
