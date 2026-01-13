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
    const sceneWidth = program?.scene.width || 800;
    const sceneHeight = program?.scene.height || 600;
    const scale = rect.width / sceneWidth;
    
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    
    // Hit testing for all node types - check in reverse order (top elements first)
    const runtime = runtimeRef.current;
    const nodes = Array.from(runtime.nodes.values()).reverse();
    
    for (const node of nodes) {
      // Skip invisible nodes
      if (!node.visible) continue;
      
      const tx = node.transform.x;
      const ty = node.transform.y;
      let hitWidth = 0;
      let hitHeight = 0;
      
      if (node.type === 'text') {
        // Approximate text hit box
        const fontSize = node.style.text?.fontSize || 24;
        const content = (node as { content: string }).content || '';
        hitWidth = Math.max(content.length * fontSize * 0.6, 50);
        hitHeight = fontSize * 1.5;
      } else if (node.type === 'rect' || node.type === 'roundedRect') {
        // Rectangle hit box
        const rectNode = node as { width: number; height: number };
        hitWidth = rectNode.width || 50;
        hitHeight = rectNode.height || 50;
      } else if (node.type === 'circle') {
        // Circle hit box (use diameter)
        const circleNode = node as { radius: number };
        const diameter = (circleNode.radius || 25) * 2;
        hitWidth = diameter;
        hitHeight = diameter;
      } else if (node.type === 'ellipse') {
        // Ellipse hit box
        const ellipseNode = node as { radiusX: number; radiusY: number };
        hitWidth = (ellipseNode.radiusX || 25) * 2;
        hitHeight = (ellipseNode.radiusY || 25) * 2;
      } else if (node.type === 'line') {
        // Line hit box - use a generous area around the line
        const lineNode = node as { x1: number; y1: number; x2: number; y2: number };
        hitWidth = Math.abs((lineNode.x2 || 0) - (lineNode.x1 || 0)) + 20;
        hitHeight = Math.abs((lineNode.y2 || 0) - (lineNode.y1 || 0)) + 20;
      } else {
        // Default hit box for other shapes
        hitWidth = 50;
        hitHeight = 50;
      }
      
      // Check if click is within the node's bounding box
      if (
        x >= tx - hitWidth / 2 &&
        x <= tx + hitWidth / 2 &&
        y >= ty - hitHeight / 2 &&
        y <= ty + hitHeight / 2
      ) {
        console.log('[IRAnimRenderer] Clicked node:', node.id, 'type:', node.type);
        onElementClick(node.id);
        return;
      }
    }
    console.log('[IRAnimRenderer] No node hit at', x, y);
  }, [onElementClick, program]);
  
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
        
        {/* LaTeX overlay layer - clickable */}
        <div className="absolute inset-0">
          {latexOverlays.map((overlay) => {
            const isSelected = overlay.id === selectedElementId;
            const isHighlighted = highlightedElementIds.includes(overlay.id);
            return (
              <div
                key={overlay.id}
                className={`absolute cursor-pointer rounded transition-all ${
                  isSelected 
                    ? 'outline outline-2 outline-primary ring-2 ring-primary/50' 
                    : isHighlighted 
                    ? 'outline outline-1 outline-yellow-400/60' 
                    : 'hover:outline hover:outline-2 hover:outline-primary/50'
                }`}
                style={{
                  left: overlay.x,
                  top: overlay.y,
                  transform: 'translate(-50%, -50%)',
                  fontSize: overlay.fontSize,
                  color: overlay.color,
                  opacity: overlay.opacity,
                  textShadow: '0 0 10px currentColor, 0 0 20px currentColor',
                  padding: '4px 8px',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onElementClick) {
                    console.log('[IRAnimRenderer] Clicked LaTeX overlay:', overlay.id);
                    onElementClick(overlay.id);
                  }
                }}
                dangerouslySetInnerHTML={{
                  __html: katex.renderToString(overlay.latex, {
                    throwOnError: false,
                    displayMode: false,
                  }),
                }}
              />
            );
          })}
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
