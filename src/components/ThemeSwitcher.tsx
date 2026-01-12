import React from 'react';
import { useTheme, type ThemeName } from '@/contexts/ThemeContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Palette } from 'lucide-react';

export const ThemeSwitcher: React.FC = () => {
  const { theme, setTheme, themes } = useTheme();

  const currentTheme = themes.find(t => t.name === theme);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 gap-1.5 px-2 hover-glow"
        >
          <span className="text-sm">{currentTheme?.icon}</span>
          <Palette className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {themes.map((t) => (
          <DropdownMenuItem
            key={t.name}
            onClick={() => setTheme(t.name)}
            className={`gap-2 cursor-pointer ${theme === t.name ? 'bg-primary/20 text-primary' : ''}`}
          >
            <span className="text-base">{t.icon}</span>
            <span className="flex-1">{t.label}</span>
            {theme === t.name && (
              <span className="text-xs text-primary">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
