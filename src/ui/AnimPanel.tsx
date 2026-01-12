import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { TimelineEvent } from '../core/types';
import { normalizeTimeline } from '../core/timeline';
import { AnimRenderer } from '../renderer/AnimRenderer';
import { PlayerControls } from './PlayerControls';

interface AnimPanelProps {
  events: TimelineEvent[];
}

export const AnimPanel: React.FC<AnimPanelProps> = ({ events }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  
  // Calculate duration from events
  const { duration } = normalizeTimeline(events);
  
  // Animation loop
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
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
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, duration]);
  
  const handlePlayPause = useCallback(() => {
    if (currentTime >= duration) {
      setCurrentTime(0);
    }
    setIsPlaying((prev) => !prev);
  }, [currentTime, duration]);
  
  const handleSeek = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);
  
  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);
  
  // Get container dimensions
  const [dimensions, setDimensions] = useState({ width: 400, height: 300 });
  
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setDimensions({
            width: rect.width,
            height: rect.height,
          });
        }
      }
    };
    
    // Initial measure after a small delay to ensure DOM is ready
    const timer = setTimeout(updateDimensions, 100);
    window.addEventListener('resize', updateDimensions);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);
  
  return (
    <div className="flex flex-col h-full min-h-0 w-full">
      <div ref={containerRef} className="flex-1 min-h-0 relative overflow-hidden">
        <AnimRenderer
          events={events}
          currentTime={currentTime}
          width={dimensions.width}
          height={Math.max(dimensions.height, 200)}
        />
      </div>
      <div className="shrink-0">
        <PlayerControls
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          onPlayPause={handlePlayPause}
          onSeek={handleSeek}
          onReset={handleReset}
        />
      </div>
    </div>
  );
};
