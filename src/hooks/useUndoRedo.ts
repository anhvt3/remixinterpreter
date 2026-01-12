import { useState, useCallback, useRef, useEffect } from 'react';

interface UseUndoRedoOptions {
  maxHistory?: number;
  debounceMs?: number;
}

interface UseUndoRedoReturn {
  value: string;
  setValue: (newValue: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  reset: (newValue: string) => void;
}

export function useUndoRedo(
  initialValue: string,
  onChange?: (value: string) => void,
  options: UseUndoRedoOptions = {}
): UseUndoRedoReturn {
  // maxHistory: undefined or Infinity means unlimited
  const { maxHistory, debounceMs = 300 } = options;
  
  const [history, setHistory] = useState<string[]>([initialValue]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastPushedRef = useRef<string>(initialValue);

  // Sync with external changes
  useEffect(() => {
    if (initialValue !== lastPushedRef.current && initialValue !== history[currentIndex]) {
      // External change - add to history
      setHistory(prev => {
        const newHistory = prev.slice(0, currentIndex + 1);
        newHistory.push(initialValue);
        // Only limit if maxHistory is defined
        if (maxHistory && newHistory.length > maxHistory) {
          newHistory.shift();
          return newHistory;
        }
        return newHistory;
      });
      setCurrentIndex(prev => maxHistory ? Math.min(prev + 1, maxHistory - 1) : prev + 1);
      lastPushedRef.current = initialValue;
    }
  }, [initialValue, currentIndex, history, maxHistory]);

  const currentValue = history[currentIndex] ?? initialValue;

  const setValue = useCallback((newValue: string) => {
    // Immediately notify parent
    onChange?.(newValue);

    // Debounce history push
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      if (newValue !== lastPushedRef.current) {
        setHistory(prev => {
          const newHistory = prev.slice(0, currentIndex + 1);
          newHistory.push(newValue);
          // Only limit if maxHistory is defined
          if (maxHistory && newHistory.length > maxHistory) {
            newHistory.shift();
            return newHistory;
          }
          return newHistory;
        });
        setCurrentIndex(prev => maxHistory ? Math.min(prev + 1, maxHistory - 1) : prev + 1);
        lastPushedRef.current = newValue;
      }
    }, debounceMs);
  }, [onChange, currentIndex, maxHistory, debounceMs]);

  const undo = useCallback(() => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      const newValue = history[newIndex];
      lastPushedRef.current = newValue;
      onChange?.(newValue);
    }
  }, [currentIndex, history, onChange]);

  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      const newValue = history[newIndex];
      lastPushedRef.current = newValue;
      onChange?.(newValue);
    }
  }, [currentIndex, history, onChange]);

  const reset = useCallback((newValue: string) => {
    setHistory([newValue]);
    setCurrentIndex(0);
    lastPushedRef.current = newValue;
  }, []);

  return {
    value: currentValue,
    setValue,
    undo,
    redo,
    canUndo: currentIndex > 0,
    canRedo: currentIndex < history.length - 1,
    reset,
  };
}
