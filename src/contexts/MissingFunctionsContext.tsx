import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type MissingFunctionType = 'expression' | 'ir' | 'dsl';

export interface MissingFunction {
  name: string;
  type: MissingFunctionType;
  calledFrom?: string;
  timestamp: Date;
}

interface MissingFunctionsContextType {
  missingFunctions: MissingFunction[];
  addMissingFunction: (name: string, type: MissingFunctionType, calledFrom?: string) => void;
  clearMissingFunctions: () => void;
  getMissingByType: (type: MissingFunctionType) => MissingFunction[];
}

const MissingFunctionsContext = createContext<MissingFunctionsContextType | undefined>(undefined);

export const MissingFunctionsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [missingFunctions, setMissingFunctions] = useState<MissingFunction[]>([]);
  const seenRef = React.useRef<Set<string>>(new Set());

  const addMissingFunction = useCallback((name: string, type: MissingFunctionType, calledFrom?: string) => {
    const key = `${type}:${name}`;
    if (seenRef.current.has(key)) return;
    seenRef.current.add(key);

    const entry: MissingFunction = {
      name,
      type,
      calledFrom,
      timestamp: new Date(),
    };
    setMissingFunctions(prev => [...prev, entry]);
  }, []);

  const clearMissingFunctions = useCallback(() => {
    setMissingFunctions([]);
    seenRef.current.clear();
  }, []);

  const getMissingByType = useCallback((type: MissingFunctionType) => {
    return missingFunctions.filter(f => f.type === type);
  }, [missingFunctions]);

  return (
    <MissingFunctionsContext.Provider value={{ 
      missingFunctions, 
      addMissingFunction, 
      clearMissingFunctions,
      getMissingByType 
    }}>
      {children}
    </MissingFunctionsContext.Provider>
  );
};

export const useMissingFunctions = (): MissingFunctionsContextType => {
  const context = useContext(MissingFunctionsContext);
  if (!context) {
    throw new Error('useMissingFunctions must be used within a MissingFunctionsProvider');
  }
  return context;
};
