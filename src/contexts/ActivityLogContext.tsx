import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type ActivityLogLevel = 'info' | 'success' | 'warning' | 'error';

export interface ActivityLogEntry {
  id: string;
  timestamp: Date;
  level: ActivityLogLevel;
  source: string;
  message: string;
}

interface ActivityLogContextType {
  logs: ActivityLogEntry[];
  addLog: (level: ActivityLogLevel, source: string, message: string) => void;
  clearLogs: () => void;
}

const ActivityLogContext = createContext<ActivityLogContextType | undefined>(undefined);

export const ActivityLogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const lastLogRef = React.useRef<string>('');

  const addLog = useCallback((level: ActivityLogLevel, source: string, message: string) => {
    // Dedupe: prevent duplicate messages added within same tick (React StrictMode)
    const key = `${level}-${source}-${message}`;
    if (lastLogRef.current === key) {
      return;
    }
    lastLogRef.current = key;
    
    // Reset the ref after a short delay to allow same message later
    setTimeout(() => {
      if (lastLogRef.current === key) {
        lastLogRef.current = '';
      }
    }, 100);

    const entry: ActivityLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      level,
      source,
      message,
    };
    setLogs(prev => [...prev, entry]);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return (
    <ActivityLogContext.Provider value={{ logs, addLog, clearLogs }}>
      {children}
    </ActivityLogContext.Provider>
  );
};

export const useActivityLog = (): ActivityLogContextType => {
  const context = useContext(ActivityLogContext);
  if (!context) {
    throw new Error('useActivityLog must be used within an ActivityLogProvider');
  }
  return context;
};
