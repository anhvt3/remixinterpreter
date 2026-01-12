import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import type { TimelineEvent } from '../core/types';
import { normalizeTimeline } from '../core/timeline';
import { AnimRenderer } from '../renderer/AnimRenderer';

interface AnimPanelWithControlsProps {
  events: TimelineEvent[];
  selectedElementId?: string | null;
  onElementClick?: (elementId: string) => void;
  zoomLevel?: number;
}

export const AnimPanelWithControls: React.FC<AnimPanelWithControlsProps> = ({ 
  events,
  selectedElementId,
  onElementClick,
  zoomLevel = 100,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(1.5); // Start at 1.5s to show initial elements
  const [dimensions, setDimensions] = useState({ width: 400, height: 400 });
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  
  const { duration } = normalizeTimeline(events);
  
  // Use ResizeObserver for reliable dimension tracking
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const updateDimensions = () => {
      // Use offsetWidth/offsetHeight which gives actual rendered size
      const w = container.offsetWidth;
      const h = container.offsetHeight;
      if (w > 0 && h > 0 && h < 2000) { // Sanity check on height
        setDimensions({ width: w, height: h });
      }
    };
    
    // Initial measurement after a short delay to let layout settle
    const timer = setTimeout(updateDimensions, 100);
    
    // Use ResizeObserver for dynamic updates
    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(container);
    
    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, []);
  
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }
    
    lastTimeRef.current = performance.now();
    
    const animate = (now: number) => {
      const delta = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;
      
      setCurrentTime((prev) => {
        const next = prev + delta;
        if (next >= duration) {
          setIsPlaying(false);
          return duration;
        }
        return next;
      });
      
      animFrameRef.current = requestAnimationFrame(animate);
    };
    
    animFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, duration]);
  
  const handlePlayPause = useCallback(() => {
    if (currentTime >= duration) setCurrentTime(0);
    setIsPlaying((prev) => !prev);
  }, [currentTime, duration]);
  
  const handleSeek = useCallback((time: number) => setCurrentTime(time), []);
  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);
  
  const formatTime = (t: number) => `${t.toFixed(1)}s`;
  
  return (
    <div className="panel flex flex-col h-full overflow-hidden">
      {/* Header with controls */}
      <div className="panel-header flex items-center gap-2">
        <span className="font-medium">Anim</span>
        <div className="flex-1" />
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePlayPause}
          className="h-6 w-6 p-0 text-primary hover:text-primary/80"
        >
          {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
        </Button>
        
        <span className="text-[10px] text-muted-foreground font-mono w-8">
          {formatTime(currentTime)}
        </span>
        
        <Slider
          value={[currentTime]}
          min={0}
          max={duration || 1}
          step={0.01}
          onValueChange={([value]) => handleSeek(value)}
          className="w-24"
        />
        
        <span className="text-[10px] text-muted-foreground font-mono w-8">
          {formatTime(duration)}
        </span>
      </div>
      
      {/* Animation canvas - scales based on zoom */}
      <div 
        ref={containerRef} 
        className="flex-1 min-h-0 relative overflow-hidden" 
        style={{ minHeight: 200 }}
      >
        {dimensions.width > 0 && dimensions.height > 0 ? (
          <div style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top left', width: `${10000 / zoomLevel}%`, height: `${10000 / zoomLevel}%` }}>
            <AnimRenderer
              events={events}
              currentTime={currentTime}
              width={dimensions.width * (100 / zoomLevel)}
              height={dimensions.height * (100 / zoomLevel)}
              selectedElementId={selectedElementId}
              onElementClick={onElementClick}
            />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
            Loading...
          </div>
        )}
        {dimensions.width > 0 && dimensions.height > 0 ? (
          <AnimRenderer
            events={events}
            currentTime={currentTime}
            width={dimensions.width}
            height={dimensions.height}
            selectedElementId={selectedElementId}
            onElementClick={onElementClick}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
            Loading...
          </div>
        )}
      </div>
    </div>
  );
};