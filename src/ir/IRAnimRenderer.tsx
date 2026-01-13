/**
 * IR-based Animation Renderer
 * 
 * Renders DSL timeline events using the IR runtime with Canvas.
 * LaTeX content is rendered as DOM overlays for reliable display.
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
  setLatexReadyCallback,
  applyAnimations,
  type RuntimeState,
} from './runtime';
import type { IRProgram, TextProps } from './types';
import { colorToRGBA } from './types';
import katex from 'katex';
import 'katex/dist/katex.min.css';

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
  
  // Force re-render counter for LaTeX loading
  const [renderKey, setRenderKey] = useState(0);
  
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
    
    // Set up LaTeX ready callback to trigger re-render
    setLatexReadyCallback(() => {
      if (runtimeRef.current) {
        render(runtimeRef.current);
        setRenderKey(k => k + 1);
      }
    });
    
    // Set initial time and render
    setTime(runtime, currentTime);
    render(runtime);
    
    setProgram(compiledProgram);
    
    return () => {
      runtimeRef.current = null;
      setLatexReadyCallback(null);
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
  
  // Get LaTeX text nodes from runtime for DOM overlay
  // This needs to run after animations are applied to get current content/opacity
  const latexOverlays = useMemo(() => {
    if (!runtimeRef.current || !program) return [];
    
    const runtime = runtimeRef.current;
    
    // Ensure current time is set and animations applied
    setTime(runtime, currentTime);
    applyAnimations(runtime);
    
    const scale = displayWidth / (program.scene.width || 800);
    const overlays: Array<{
      id: string;
      x: number;
      y: number;
      latex: string;
      fontSize: number;
      color: string;
      opacity: number;
    }> = [];
    
    for (const node of runtime.nodes.values()) {
      if (node.type !== 'text') continue;
      
      const textNode = node as TextProps;
      const content = textNode.content;
      
      // Check if it contains LaTeX
      if (typeof content !== 'string') continue;
      if (!content.includes('\\(') && !content.includes('\\[') && 
          !content.includes('$') && !content.includes('\\frac') &&
          !content.includes('\\sqrt') && !content.includes('^{')) continue;
      
      // Extract LaTeX from delimiters
      let latex = content;
      const inlineMatch = content.match(/\\\(([\s\S]*?)\\\)/);
      if (inlineMatch) {
        latex = inlineMatch[1];
      } else {
        const displayMatch = content.match(/\\\[([\s\S]*?)\\\]/);
        if (displayMatch) {
          latex = displayMatch[1];
        } else {
          const dollarMatch = content.match(/\$([\s\S]*?)\$/);
          if (dollarMatch) {
            latex = dollarMatch[1];
          }
        }
      }
      
      const style = node.style;
      const fontSize = (style.text?.fontSize || 24) * scale;
      const color = colorToRGBA(style.fill.color);
      overlays.push({
        id: node.id,
        x: node.transform.x * scale,
        y: node.transform.y * scale,
        latex,
        fontSize,
        color,
        opacity: style.opacity,
      });
    }
    
    return overlays;
  }, [program, displayWidth, renderKey, currentTime]);
  
  return (
    <div
      className="relative overflow-hidden flex items-center justify-center"
      style={{
        width,
        height,
        backgroundColor: '#1a1a2e',
      }}
    >
      <div className="relative" style={{ width: displayWidth, height: displayHeight }}>
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="cursor-pointer absolute inset-0"
          style={{
            width: displayWidth,
            height: displayHeight,
          }}
        />
        
        {/* LaTeX overlay layer */}
        <div className="absolute inset-0 pointer-events-none">
          {latexOverlays.map((overlay) => (
            <div
              key={overlay.id}
              className="absolute"
              style={{
                left: overlay.x,
                top: overlay.y,
                transform: 'translate(-50%, -50%)',
                fontSize: overlay.fontSize,
                color: overlay.color,
                opacity: overlay.opacity,
                textShadow: '0 0 10px currentColor, 0 0 20px currentColor',
              }}
              dangerouslySetInnerHTML={{
                __html: katex.renderToString(overlay.latex, {
                  throwOnError: false,
                  displayMode: false,
                }),
              }}
            />
          ))}
        </div>
      </div>
      
      {/* Debug overlay */}
      <div className="absolute top-1 left-1 text-[10px] text-white/50 font-mono z-50">
        {program?.nodes.length || 0} nodes @ t={currentTime.toFixed(2)}s
        {selectedElementId && <span className="ml-2 text-primary">sel: {selectedElementId}</span>}
      </div>
    </div>
  );
};

export default IRAnimRenderer;
