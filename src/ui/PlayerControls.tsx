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
    <div className="flex items-center gap-2 px-3 py-2 bg-secondary/50 border-t border-panel-border">
      <Button
        variant="ghost"
        size="sm"
        onClick={onReset}
        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
      >
        <RotateCcw className="h-3 w-3" />
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={onPlayPause}
        className="h-7 w-7 p-0 text-primary hover:text-primary/80"
      >
        {isPlaying ? (
          <Pause className="h-3 w-3" />
        ) : (
          <Play className="h-3 w-3" />
        )}
      </Button>
      
      <span className="text-[10px] text-muted-foreground font-mono w-10">
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
      
      <span className="text-[10px] text-muted-foreground font-mono w-10 text-right">
        {formatTime(duration)}
      </span>
    </div>
  );
};
