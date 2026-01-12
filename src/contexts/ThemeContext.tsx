import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type ThemeName = 'midnight-aurora' | 'warm-terminal' | 'minimal-frost';

interface ThemeInfo {
  name: ThemeName;
  label: string;
  icon: string;
}

export const THEMES: ThemeInfo[] = [
  { name: 'midnight-aurora', label: 'Midnight Aurora', icon: '🌌' },
  { name: 'warm-terminal', label: 'Warm Terminal', icon: '🔥' },
  { name: 'minimal-frost', label: 'Minimal Frost', icon: '❄️' },
];

interface ThemeContextType {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  themes: ThemeInfo[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'animyaml-theme';

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && THEMES.some(t => t.name === stored)) {
        return stored as ThemeName;
      }
    }
    return 'midnight-aurora';
  });

  const setTheme = (newTheme: ThemeName) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
  };

  // Apply theme class to document
  useEffect(() => {
    const root = document.documentElement;
    // Remove all theme classes
    THEMES.forEach(t => root.classList.remove(`theme-${t.name}`));
    // Add current theme class
    root.classList.add(`theme-${theme}`);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
