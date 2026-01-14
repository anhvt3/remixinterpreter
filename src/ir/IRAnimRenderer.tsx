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
  getWorldTransform,
  type RuntimeState,
} from './runtime';
import type { IRProgram, TextProps, NodeProps } from './types';
import { colorToRGBA } from './types';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const isLatexContent = (content: unknown): boolean => {
  if (typeof content !== 'string') return false;
  return (
    content.includes('\\(') ||
    content.includes('\\[') ||
    content.includes('$') ||
    content.includes('\\frac') ||
    content.includes('\\sqrt') ||
    content.includes('^{')
  );
};

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
    const runtime = runtimeRef.current;
    const canvas = canvasRef.current;
    if (!runtime || !canvas || !onElementClick) return;

    const rect = canvas.getBoundingClientRect();
    const sceneWidth = program?.scene.width || 800;
    const sceneHeight = program?.scene.height || 600;

    // Use independent scales to avoid drift from rounding/letterboxing.
    const scaleX = rect.width / sceneWidth;
    const scaleY = rect.height / sceneHeight;

    const worldX = (e.clientX - rect.left) / scaleX;
    const worldY = (e.clientY - rect.top) / scaleY;

    const ctx = runtime.ctx;
    if (!ctx) return;

    const isVisibleAtTime = (node: NodeProps) => {
      if (!node.visible) return false;
      if (node.style.opacity <= 0) return false;
      if (node.visibilitySpan) {
        const { t0, t1 } = node.visibilitySpan;
        if (currentTime < t0 || currentTime > t1) return false;
      }
      return true;
    };

    const worldToLocal = (
      worldPoint: { x: number; y: number },
      t: { x: number; y: number; scaleX: number; scaleY: number; rotation: number; originX: number; originY: number }
    ) => {
      // Inverse of: T(x,y) · R(rot) · S(scale) · T(-origin)
      // Return coordinates in the node's local coordinate system (the same one
      // used to build paths / draw text before the origin pivot is applied).
      let x = worldPoint.x - t.x;
      let y = worldPoint.y - t.y;

      const cos = Math.cos(-t.rotation);
      const sin = Math.sin(-t.rotation);
      const rx = x * cos - y * sin;
      const ry = x * sin + y * cos;

      const sx = t.scaleX === 0 ? rx : rx / t.scaleX;
      const sy = t.scaleY === 0 ? ry : ry / t.scaleY;

      return { x: sx + t.originX, y: sy + t.originY };
    };

    const hitTestText = (node: TextProps, localX: number, localY: number) => {
      const textStyle = node.style.text;
      if (!textStyle) return false;

      ctx.save();
      ctx.font = `${textStyle.fontStyle} ${textStyle.fontWeight} ${textStyle.fontSize}px ${textStyle.fontFamily}`;

      const content = node.content ?? '';
      const widthPx = ctx.measureText(content).width;
      const heightPx = textStyle.fontSize;

      let x0 = 0;
      if (textStyle.textAlign === 'center') x0 = -widthPx / 2;
      if (textStyle.textAlign === 'right') x0 = -widthPx;

      let y0 = 0;
      switch (textStyle.textBaseline) {
        case 'middle':
          y0 = -heightPx / 2;
          break;
        case 'bottom':
          y0 = -heightPx;
          break;
        case 'alphabetic':
          y0 = -heightPx * 0.8;
          break;
        case 'top':
        default:
          y0 = 0;
      }

      // Slight padding so small numerals are easy to pick.
      const pad = 8;
      const hit =
        localX >= x0 - pad &&
        localX <= x0 + widthPx + pad &&
        localY >= y0 - pad &&
        localY <= y0 + heightPx + pad;

      ctx.restore();
      return hit;
    };

    const hitTestShapePath = (path: Path2D, nodeStyle: { fill: { enabled: boolean }; stroke: { enabled: boolean; width: number; lineCap?: CanvasLineCap; lineJoin?: CanvasLineJoin; dashArray?: number[]; dashOffset?: number } }, localX: number, localY: number) => {
      let hit = false;

      if (nodeStyle.fill.enabled) {
        hit = hit || ctx.isPointInPath(path, localX, localY);
      }

      if (nodeStyle.stroke.enabled) {
        ctx.save();
        ctx.lineWidth = Math.max(nodeStyle.stroke.width || 1, 10);
        ctx.lineCap = nodeStyle.stroke.lineCap || 'round';
        ctx.lineJoin = nodeStyle.stroke.lineJoin || 'round';
        if (nodeStyle.stroke.dashArray) {
          ctx.setLineDash(nodeStyle.stroke.dashArray);
          ctx.lineDashOffset = nodeStyle.stroke.dashOffset || 0;
        }
        hit = hit || ctx.isPointInStroke(path, localX, localY);
        ctx.restore();
      }

      return hit;
    };

    // Ensure the runtime node snapshot matches the current time before hit testing.
    // (When scrubbing/playing, a click can happen between renders.)
    setTime(runtime, currentTime);
    applyAnimations(runtime);

    // Match render order: sorted by zIndex (ties preserve insertion order), then pick from top-most.
    const candidates = Array.from(runtime.nodes.values())
      .filter((n) => n.type !== 'group' && isVisibleAtTime(n))
      .sort((a, b) => a.zIndex - b.zIndex);

    // PASS 1: Prefer text nodes so small glyphs like "2"/"3" are always selectable
    // even if they overlap a stroked box/line.
    for (let i = candidates.length - 1; i >= 0; i--) {
      const node = candidates[i];
      if (node.type !== 'text') continue;

      const wt = getWorldTransform(runtime, node.id);
      const local = worldToLocal({ x: worldX, y: worldY }, wt);

      if (hitTestText(node as TextProps, local.x, local.y)) {
        onElementClick(node.id);
        return;
      }
    }

    // PASS 2: Shapes
    for (let i = candidates.length - 1; i >= 0; i--) {
      const node = candidates[i];
      if (node.type === 'text') continue;

      const wt = getWorldTransform(runtime, node.id);
      const local = worldToLocal({ x: worldX, y: worldY }, wt);

      const path = new Path2D();
      switch (node.type) {
        case 'rect':
        case 'roundedRect':
          path.rect(0, 0, (node as any).width, (node as any).height);
          break;
        case 'circle':
          path.arc(0, 0, (node as any).radius, 0, Math.PI * 2);
          break;
        case 'ellipse':
          path.ellipse(0, 0, (node as any).radiusX, (node as any).radiusY, 0, 0, Math.PI * 2);
          break;
        case 'line':
          path.moveTo((node as any).x1, (node as any).y1);
          path.lineTo((node as any).x2, (node as any).y2);
          break;
        case 'polyline': {
          const pts = (node as any).points as Array<{ x: number; y: number }>;
          if (pts.length) {
            path.moveTo(pts[0].x, pts[0].y);
            for (let p = 1; p < pts.length; p++) path.lineTo(pts[p].x, pts[p].y);
          }
          break;
        }
        case 'polygon': {
          const pts = (node as any).points as Array<{ x: number; y: number }>;
          if (pts.length) {
            path.moveTo(pts[0].x, pts[0].y);
            for (let p = 1; p < pts.length; p++) path.lineTo(pts[p].x, pts[p].y);
            path.closePath();
          }
          break;
        }
        case 'arc':
          path.arc(0, 0, (node as any).radius, (node as any).startAngle, (node as any).endAngle, (node as any).counterClockwise);
          break;
        case 'path': {
          const svgPath = new Path2D((node as any).d);
          if (hitTestShapePath(svgPath, node.style as any, local.x, local.y)) {
            onElementClick(node.id);
            return;
          }
          continue;
        }
        default:
          continue;
      }

      if (hitTestShapePath(path, node.style as any, local.x, local.y)) {
        onElementClick(node.id);
        return;
      }
    }
  }, [currentTime, onElementClick, program]);
  
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
  
  // Text overlays:
  // - LaTeX is rendered visibly via DOM (canvas skips it)
  // - Plain text keeps rendering on canvas, but we add invisible DOM hit-targets so
  //   tiny items like "2"/"3" are always clickable even when overlapping shapes.
  const { latexOverlays, plainTextHitTargets } = useMemo(() => {
    if (!runtimeRef.current || !program) return { latexOverlays: [], plainTextHitTargets: [] };

    const runtime = runtimeRef.current;

    // Ensure current time is set and animations applied
    setTime(runtime, currentTime);
    applyAnimations(runtime);

    const scaleX = displayWidth / (program.scene.width || 800);
    const scaleY = displayHeight / (program.scene.height || 600);
    const ctx = runtime.ctx;

    const localToWorld = (
      localPoint: { x: number; y: number },
      t: { x: number; y: number; scaleX: number; scaleY: number; rotation: number; originX: number; originY: number }
    ) => {
      // Same order as applyTransform(): translate → rotate → scale → translate(-origin)
      // So local(0,0) in draw commands is pre-origin local(0,0).
      const lx = localPoint.x - t.originX;
      const ly = localPoint.y - t.originY;

      const sx = lx * t.scaleX;
      const sy = ly * t.scaleY;

      const cos = Math.cos(t.rotation);
      const sin = Math.sin(t.rotation);
      const rx = sx * cos - sy * sin;
      const ry = sx * sin + sy * cos;

      return { x: rx + t.x, y: ry + t.y };
    };

      // Anchor at the same point the canvas uses for drawing: local (0,0)
      const anchorWorld = localToWorld({ x: 0, y: 0 }, wt);
      const x = anchorWorld.x * scaleX;
      const y = anchorWorld.y * scaleY;
      const zIndex = node.zIndex;

      if (isLatexContent(content)) {
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

        const fontSize = (textStyle?.fontSize || 24) * Math.abs(wt.scaleY || 1) * scaleY;
        const color = colorToRGBA(style.fill.color);

        latexOverlays.push({
          id: node.id,
          x,
          y,
          latex,
          fontSize,
          color,
          opacity: style.opacity,
          zIndex,
        });
      } else {
        // Invisible click target for plain text.
        // We intentionally overshoot so tiny numerals are easy to select.
        let w = 44;
        let h = 44;

        if (ctx && textStyle) {
          ctx.save();
          ctx.font = `${textStyle.fontStyle} ${textStyle.fontWeight} ${textStyle.fontSize}px ${textStyle.fontFamily}`;
          const widthPx = ctx.measureText(content).width;
          ctx.restore();

          w = Math.max(44, widthPx * Math.abs(wt.scaleX || 1) * scaleX + 20);
          h = Math.max(44, textStyle.fontSize * Math.abs(wt.scaleY || 1) * scaleY + 20);
        }

        plainTextHitTargets.push({
          id: node.id,
          x,
          y,
          w,
          h,
          opacity: style.opacity,
          zIndex,
          content,
        });
      }
    }

    // Highest zIndex should be on top in DOM
    latexOverlays.sort((a, b) => a.zIndex - b.zIndex);
    plainTextHitTargets.sort((a, b) => a.zIndex - b.zIndex);

    return { latexOverlays, plainTextHitTargets };
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

        {/* Plain text hit-target layer (invisible but clickable) */}
        <div className="absolute inset-0 pointer-events-none">
          {plainTextHitTargets.map((t) => {
            const isSelected = t.id === selectedElementId;
            const isHighlighted = highlightedElementIds.includes(t.id);

            return (
              <button
                key={t.id}
                type="button"
                aria-label={`Select text ${t.content}`}
                className={`absolute pointer-events-auto bg-transparent rounded transition-all ${
                  isSelected
                    ? 'outline outline-2 outline-primary ring-2 ring-primary/50'
                    : isHighlighted
                    ? 'outline outline-1 outline-primary/50'
                    : 'hover:outline hover:outline-2 hover:outline-primary/50'
                }`}
                style={{
                  left: t.x,
                  top: t.y,
                  width: t.w,
                  height: t.h,
                  transform: 'translate(-50%, -50%)',
                  opacity: isSelected || isHighlighted ? 0.08 : 0,
                  zIndex: 1000 + t.zIndex,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onElementClick?.(t.id);
                }}
              />
            );
          })}
        </div>

        {/* LaTeX overlay layer - pointer-events-none so canvas clicks pass through */}
        <div className="absolute inset-0 pointer-events-none">
          {latexOverlays.map((overlay) => {
            const isSelected = overlay.id === selectedElementId;
            const isHighlighted = highlightedElementIds.includes(overlay.id);
            return (
              <div
                key={overlay.id}
                className={`absolute cursor-pointer rounded transition-all pointer-events-auto ${
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
