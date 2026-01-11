import React from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface PlayerControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onReset: () => void;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  onSeek,
  onReset,
}) => {
  const formatTime = (t: number) => {
    const seconds = Math.floor(t);
    const ms = Math.floor((t - seconds) * 100);
    return `${seconds}.${ms.toString().padStart(2, '0')}s`;
  };
  
  return (
    <div className="flex items-center gap-4 p-3 bg-panel-header border-t border-panel-border">
      <Button
        variant="ghost"
        size="icon"
        onClick={onReset}
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
      
      <Button
        variant="ghost"
        size="icon"
        onClick={onPlayPause}
        className="h-8 w-8 text-primary hover:text-primary/80"
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>
      
      <div className="flex-1 flex items-center gap-3">
        <span className="text-xs text-muted-foreground font-mono min-w-[60px]">
          {formatTime(currentTime)}
        </span>
        
        <Slider
          value={[currentTime]}
          min={0}
          max={duration}
          step={0.01}
          onValueChange={([value]) => onSeek(value)}
          className="flex-1"
        />
        
        <span className="text-xs text-muted-foreground font-mono min-w-[60px] text-right">
          {formatTime(duration)}
        </span>
      </div>
    </div>
  );
};
