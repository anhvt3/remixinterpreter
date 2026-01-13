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

  const addLog = useCallback((level: ActivityLogLevel, source: string, message: string) => {
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
