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
          variant="outline" 
          size="sm" 
          className="h-8 gap-2 px-3 hover-glow border-primary/30"
        >
          <span className="text-base">{currentTheme?.icon}</span>
          <Palette className="h-4 w-4 text-primary" />
          <span className="text-xs hidden sm:inline">{currentTheme?.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 bg-popover/95 backdrop-blur-sm border-border">
        {themes.map((t) => (
          <DropdownMenuItem
            key={t.name}
            onClick={() => setTheme(t.name)}
            className={`gap-3 cursor-pointer py-2.5 ${theme === t.name ? 'bg-primary/20 text-primary font-medium' : 'hover:bg-muted'}`}
          >
            <span className="text-lg">{t.icon}</span>
            <span className="flex-1">{t.label}</span>
            {theme === t.name && (
              <span className="text-primary font-bold">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
