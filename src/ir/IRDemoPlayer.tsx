/**
 * IR Demo Player Component
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createRuntime, loadProgram, render, setTime, play, pause, step, exportFrameAsPNG, attachCanvas, RuntimeState } from './runtime';
import type { IRProgram } from './types';
import { exampleProgram } from './exampleProgram';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, Download, RotateCcw } from 'lucide-react';

export const IRDemoPlayer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<RuntimeState | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(10);
  const [fps, setFps] = useState(0);
  
  // Initialize runtime
  useEffect(() => {
    const runtime = createRuntime();
    runtimeRef.current = runtime;
    
    if (canvasRef.current) {
      attachCanvas(runtime, canvasRef.current);
      loadProgram(runtime, exampleProgram);
      setDuration(runtime.scene.duration);
      render(runtime);
    }
    
    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);
  
  // Animation loop
  const animate = useCallback((timestamp: number) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    
    const deltaTime = (timestamp - lastTimeRef.current) / 1000;
    lastTimeRef.current = timestamp;
    
    if (deltaTime > 0 && deltaTime < 1) {
      setFps(Math.round(1 / deltaTime));
    }
    
    if (isPlaying) {
      step(runtime, deltaTime);
      setCurrentTime(runtime.currentTime);
    }
    
    render(runtime);
    animFrameRef.current = requestAnimationFrame(animate);
  }, [isPlaying]);
  
  useEffect(() => {
    lastTimeRef.current = performance.now();
    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [animate]);
  
  const handlePlayPause = () => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    
    if (isPlaying) {
      pause(runtime);
    } else {
      play(runtime);
    }
    setIsPlaying(!isPlaying);
  };
  
  const handleSeek = (value: number[]) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    
    setTime(runtime, value[0]);
    setCurrentTime(value[0]);
    render(runtime);
  };
  
  const handleReset = () => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    
    setTime(runtime, 0);
    setCurrentTime(0);
    pause(runtime);
    setIsPlaying(false);
    render(runtime);
  };
  
  const handleExport = () => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    
    const dataUrl = exportFrameAsPNG(runtime);
    if (dataUrl) {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `frame_${currentTime.toFixed(2)}s.png`;
      a.click();
    }
  };
  
  return (
    <div className="flex flex-col gap-4 p-4 bg-background rounded-lg border">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">IR Demo Player</h2>
        <span className="text-xs text-muted-foreground">{fps} FPS</span>
      </div>
      
      <canvas
        ref={canvasRef}
        className="border rounded-lg bg-black"
        style={{ maxWidth: '100%', height: 'auto' }}
      />
      
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={handlePlayPause}>
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button variant="outline" size="icon" onClick={handleReset}>
          <RotateCcw className="h-4 w-4" />
        </Button>
        
        <div className="flex-1 px-2">
          <Slider
            value={[currentTime]}
            min={0}
            max={duration}
            step={0.01}
            onValueChange={handleSeek}
          />
        </div>
        
        <span className="text-sm font-mono w-20 text-right">
          {currentTime.toFixed(2)}s / {duration}s
        </span>
        
        <Button variant="outline" size="icon" onClick={handleExport}>
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
