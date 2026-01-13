/**
 * IR-based Animation Renderer
 * 
 * Renders DSL timeline events using the IR runtime with Canvas.
 * This replaces the SVG-based AnimRenderer for better glow/opacity support.
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import type { TimelineEvent } from '@/core/types';
import { compileToIR, getTimelineDuration } from './compiler';
import {
  createRuntime,
  loadProgram,
  render,
  setTime,
  attachCanvas,
  type RuntimeState,
} from './runtime';
import type { IRProgram } from './types';

interface IRAnimRendererProps {
  events: TimelineEvent[];
  currentTime: number;
  width: number;
  height: number;
  selectedElementId?: string | null;
  highlightedElementIds?: string[];
  staticElementIds?: string[];
  onElementClick?: (elementId: string) => void;
}

export const IRAnimRenderer: React.FC<IRAnimRendererProps> = ({
  events,
  currentTime,
  width,
  height,
  selectedElementId,
  highlightedElementIds = [],
  staticElementIds = [],
  onElementClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<RuntimeState | null>(null);
  const [program, setProgram] = useState<IRProgram | null>(null);
  
  // Compile events to IR program when events change
  const compiledProgram = useMemo(() => {
    if (events.length === 0) return null;
    return compileToIR(events);
  }, [events]);
  
  // Initialize runtime and attach canvas
  useEffect(() => {
    if (!canvasRef.current || !compiledProgram) return;
    
    // Create runtime
    const runtime = createRuntime();
    runtimeRef.current = runtime;
    
    // Attach canvas FIRST with correct dimensions
    const canvas = canvasRef.current;
    canvas.width = compiledProgram.scene.width;
    canvas.height = compiledProgram.scene.height;
    attachCanvas(runtime, canvas);
    
    // Load program AFTER canvas is attached
    loadProgram(runtime, compiledProgram);
    
    // Set initial time and render
    setTime(runtime, currentTime);
    render(runtime);
    
    setProgram(compiledProgram);
    
    return () => {
      runtimeRef.current = null;
    };
  }, [compiledProgram]); // Note: currentTime not in deps - we handle time updates separately
  
  // Render on time change
  useEffect(() => {
    if (!runtimeRef.current || !program) return;
    
    setTime(runtimeRef.current, currentTime);
    render(runtimeRef.current);
  }, [currentTime, program]);
  
  // Handle canvas click for element selection
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!runtimeRef.current || !onElementClick) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    // Simple hit testing - check text nodes first (they're usually on top)
    const runtime = runtimeRef.current;
    const nodes = Array.from(runtime.nodes.values()).reverse();
    
    for (const node of nodes) {
      if (node.type === 'text') {
        // Approximate text hit box
        const tx = node.transform.x;
        const ty = node.transform.y;
        const fontSize = node.style.text?.fontSize || 24;
        const content = (node as { content: string }).content || '';
        const approxWidth = content.length * fontSize * 0.6;
        const approxHeight = fontSize * 1.2;
        
        if (
          x >= tx - approxWidth / 2 &&
          x <= tx + approxWidth / 2 &&
          y >= ty - approxHeight / 2 &&
          y <= ty + approxHeight / 2
        ) {
          onElementClick(node.id);
          return;
        }
      }
    }
  }, [onElementClick]);
  
  // Calculate display dimensions maintaining aspect ratio
  const aspectRatio = compiledProgram 
    ? compiledProgram.scene.width / compiledProgram.scene.height 
    : width / height;
  
  let displayWidth = width;
  let displayHeight = height;
  
  if (width / height > aspectRatio) {
    displayWidth = height * aspectRatio;
  } else {
    displayHeight = width / aspectRatio;
  }
  
  return (
    <div
      className="relative overflow-hidden flex items-center justify-center"
      style={{
        width,
        height,
        backgroundColor: '#1a1a2e',
      }}
    >
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="cursor-pointer"
        style={{
          width: displayWidth,
          height: displayHeight,
        }}
      />
      
      {/* Debug overlay */}
      <div className="absolute top-1 left-1 text-[10px] text-white/50 font-mono z-50">
        {program?.nodes.length || 0} nodes @ t={currentTime.toFixed(2)}s
        {selectedElementId && <span className="ml-2 text-primary">sel: {selectedElementId}</span>}
      </div>
      
      {/* Selection highlight overlay */}
      {selectedElementId && runtimeRef.current && (
        <div className="pointer-events-none absolute inset-0">
          {/* Could add selection indicators here */}
        </div>
      )}
    </div>
  );
};

export default IRAnimRenderer;
