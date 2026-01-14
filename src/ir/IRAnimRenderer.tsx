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
import type { IRProgram, TextProps, NodeProps, GroupProps } from './types';
import { colorToRGBA } from './types';
import { theme } from './theme';
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

  // Debug: show computed clickable boxes for text overlays
  const [showHitDebug, setShowHitDebug] = useState(false);
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
      // Important: runtime renders with style.text OR theme.defaultText.
      // Hit-testing must follow the same rule so small digits ("2", "3") are selectable.
      const textStyle = node.style.text ?? theme.defaultText;

      ctx.save();
      ctx.font = `${textStyle.fontStyle} ${textStyle.fontWeight} ${textStyle.fontSize}px ${textStyle.fontFamily}`;

      const raw = node.content as unknown; const content = (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') ? String(raw) : '';
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

    const latexOverlays: Array<{
      id: string;
      x: number;
      y: number;
      latex: string;
      fontSize: number;
      color: string;
      opacity: number;
      zIndex: number;
    }> = [];

    const plainTextHitTargets: Array<{
      id: string;
      x: number;
      y: number;
      w: number;
      h: number;
      opacity: number;
      zIndex: number;
      content: string;
    }> = [];

    const localToWorld = (
      localPoint: { x: number; y: number },
      t: { x: number; y: number; scaleX: number; scaleY: number; rotation: number; originX: number; originY: number }
    ) => {
      // Matches: T(x,y) · R(rot) · S(scale) · T(-origin)
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

    for (const node of runtime.nodes.values()) {
      if (node.type !== 'text') continue;
      const raw = (node as TextProps).content as unknown; const content = (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') ? String(raw) : null;
      if (content === null) continue;

      // Skip invisible nodes
      if (!node.visible || node.style.opacity <= 0) continue;
      if (node.visibilitySpan) {
        const { t0, t1 } = node.visibilitySpan;
        if (currentTime < t0 || currentTime > t1) continue;
      }

      const wt = getWorldTransform(runtime, node.id);
      const style = node.style;
      const textStyle = style.text;
      const zIndex = node.zIndex;

      // Compute a robust (rotation-aware) screen-space bounding box for this text.
      let xMin = 0;
      let xMax = 0;
      let yMin = 0;
      let yMax = 0;

      if (ctx && textStyle) {
        ctx.save();
        ctx.font = `${textStyle.fontStyle} ${textStyle.fontWeight} ${textStyle.fontSize}px ${textStyle.fontFamily}`;
        ctx.textAlign = textStyle.textAlign;
        ctx.textBaseline = textStyle.textBaseline;

        const m = ctx.measureText(content);

        // Prefer actual glyph boxes when available.
        const ascent = (m as any).actualBoundingBoxAscent ?? textStyle.fontSize * 0.8;
        const descent = (m as any).actualBoundingBoxDescent ?? textStyle.fontSize * 0.2;
        const left = (m as any).actualBoundingBoxLeft;
        const right = (m as any).actualBoundingBoxRight;

        if (typeof left === 'number' && typeof right === 'number') {
          xMin = -left;
          xMax = right;
          yMin = -ascent;
          yMax = descent;
        } else {
          const widthPx = m.width;
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

          xMin = x0;
          xMax = x0 + widthPx;
          yMin = y0;
          yMax = y0 + heightPx;
        }

        ctx.restore();
      }

      const padLocal = 10;
      const cornersLocal = [
        { x: xMin - padLocal, y: yMin - padLocal },
        { x: xMax + padLocal, y: yMin - padLocal },
        { x: xMax + padLocal, y: yMax + padLocal },
        { x: xMin - padLocal, y: yMax + padLocal },
      ];

      const cornersScreen = cornersLocal
        .map((p) => localToWorld(p, wt))
        .map((p) => ({ x: p.x * scaleX, y: p.y * scaleY }));

      const minX = Math.min(...cornersScreen.map((p) => p.x));
      const maxX = Math.max(...cornersScreen.map((p) => p.x));
      const minY = Math.min(...cornersScreen.map((p) => p.y));
      const maxY = Math.max(...cornersScreen.map((p) => p.y));

      const x = (minX + maxX) / 2;
      const y = (minY + maxY) / 2;

      const w = Math.max(44, maxX - minX);
      const h = Math.max(44, maxY - minY);

      const opacity = style.opacity;

      if (isLatexContent(content)) {
        // LaTeX: visible DOM overlay
        const latex = content
          .replace(/^\\\(|\\\)$/g, '')
          .replace(/^\\\[|\\\]$/g, '')
          .replace(/^\$|\$$/g, '');

        latexOverlays.push({
          id: node.id,
          x,
          y,
          latex,
          fontSize: textStyle?.fontSize ?? 16,
          color: style.fill?.color ? colorToRGBA(style.fill.color) : 'black',
          opacity,
          zIndex,
        });
      } else {
        // Plain text: invisible hit target overlay
        plainTextHitTargets.push({
          id: node.id,
          x,
          y,
          w,
          h,
          opacity,
          zIndex,
          content,
        });
      }
    }

    // Highest zIndex should be on top in DOM
    latexOverlays.sort((a, b) => a.zIndex - b.zIndex);
    plainTextHitTargets.sort((a, b) => a.zIndex - b.zIndex);

    return { latexOverlays, plainTextHitTargets };
  }, [program, displayWidth, displayHeight, renderKey, currentTime]);

  // Selected element highlight (works for canvas-drawn shapes too)
  const selectionRect = useMemo(() => {
    if (!program || !selectedElementId) return null;

    // Fast path: if the selected element is a plain-text hit target, reuse its
    // already-computed screen-space bounds (this covers tiny digits reliably).
    const hit = plainTextHitTargets.find((t) => t.id === selectedElementId);
    if (hit) {
      return {
        left: hit.x - hit.w / 2,
        top: hit.y - hit.h / 2,
        width: hit.w,
        height: hit.h,
        zIndex: 1200 + hit.zIndex,
      };
    }

    if (!runtimeRef.current) return null;

    const runtime = runtimeRef.current;

    // Keep selection bounds aligned with current frame.
    setTime(runtime, currentTime);
    applyAnimations(runtime);

    const root = runtime.nodes.get(selectedElementId);
    if (!root) return null;

    const scaleX = displayWidth / (program.scene.width || 800);
    const scaleY = displayHeight / (program.scene.height || 600);

    const localToWorld = (
      localPoint: { x: number; y: number },
      t: { x: number; y: number; scaleX: number; scaleY: number; rotation: number; originX: number; originY: number }
    ) => {
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

    const isVisibleAtTime = (n: NodeProps) => {
      if (!n.visible) return false;
      if (n.style.opacity <= 0) return false;
      if (n.visibilitySpan) {
        const { t0, t1 } = n.visibilitySpan;
        if (currentTime < t0 || currentTime > t1) return false;
      }
      return true;
    };

    const getCornersLocal = (n: NodeProps): Array<{ x: number; y: number }> | null => {
      const strokePad = n.style.stroke?.enabled ? Math.max(n.style.stroke.width ?? 0, 2) / 2 + 3 : 3;

      switch (n.type) {
        case 'rect':
        case 'roundedRect': {
          const w = (n as any).width as number;
          const h = (n as any).height as number;
          return [
            { x: -strokePad, y: -strokePad },
            { x: w + strokePad, y: -strokePad },
            { x: w + strokePad, y: h + strokePad },
            { x: -strokePad, y: h + strokePad },
          ];
        }
        case 'circle': {
          const r = ((n as any).radius as number) + strokePad;
          return [
            { x: -r, y: -r },
            { x: r, y: -r },
            { x: r, y: r },
            { x: -r, y: r },
          ];
        }
        case 'ellipse': {
          const rx = ((n as any).radiusX as number) + strokePad;
          const ry = ((n as any).radiusY as number) + strokePad;
          return [
            { x: -rx, y: -ry },
            { x: rx, y: -ry },
            { x: rx, y: ry },
            { x: -rx, y: ry },
          ];
        }
        case 'arc': {
          const r = ((n as any).radius as number) + strokePad;
          return [
            { x: -r, y: -r },
            { x: r, y: -r },
            { x: r, y: r },
            { x: -r, y: r },
          ];
        }
        case 'line': {
          const x1 = (n as any).x1 as number;
          const y1 = (n as any).y1 as number;
          const x2 = (n as any).x2 as number;
          const y2 = (n as any).y2 as number;
          const minX = Math.min(x1, x2) - strokePad;
          const maxX = Math.max(x1, x2) + strokePad;
          const minY = Math.min(y1, y2) - strokePad;
          const maxY = Math.max(y1, y2) + strokePad;
          return [
            { x: minX, y: minY },
            { x: maxX, y: minY },
            { x: maxX, y: maxY },
            { x: minX, y: maxY },
          ];
        }
        case 'polyline':
        case 'polygon': {
          const pts = ((n as any).points as Array<{ x: number; y: number }>) ?? [];
          if (!pts.length) return null;
          const minX = Math.min(...pts.map((p) => p.x)) - strokePad;
          const maxX = Math.max(...pts.map((p) => p.x)) + strokePad;
          const minY = Math.min(...pts.map((p) => p.y)) - strokePad;
          const maxY = Math.max(...pts.map((p) => p.y)) + strokePad;
          return [
            { x: minX, y: minY },
            { x: maxX, y: minY },
            { x: maxX, y: maxY },
            { x: minX, y: maxY },
          ];
        }
        case 'text': {
           const raw = (n as TextProps).content as unknown;
           const content = (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') ? String(raw) : null;
           const ctx = runtime.ctx;
           const textStyle = n.style.text ?? theme.defaultText; if (!ctx || content === null) return null;

          ctx.save();
          ctx.font = `${textStyle.fontStyle} ${textStyle.fontWeight} ${textStyle.fontSize}px ${textStyle.fontFamily}`;
          ctx.textAlign = textStyle.textAlign;
          ctx.textBaseline = textStyle.textBaseline;

          const m = ctx.measureText(content);
          const ascent = (m as any).actualBoundingBoxAscent ?? textStyle.fontSize * 0.8;
          const descent = (m as any).actualBoundingBoxDescent ?? textStyle.fontSize * 0.2;
          const left = (m as any).actualBoundingBoxLeft;
          const right = (m as any).actualBoundingBoxRight;

          let xMin = 0;
          let xMax = 0;
          let yMin = 0;
          let yMax = 0;

          if (typeof left === 'number' && typeof right === 'number') {
            xMin = -left;
            xMax = right;
            yMin = -ascent;
            yMax = descent;
          } else {
            const widthPx = m.width;
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

            xMin = x0;
            xMax = x0 + widthPx;
            yMin = y0;
            yMax = y0 + heightPx;
          }

          ctx.restore();

          const pad = 8; // make tiny numerals clearly highlightable
          return [
            { x: xMin - pad, y: yMin - pad },
            { x: xMax + pad, y: yMin - pad },
            { x: xMax + pad, y: yMax + pad },
            { x: xMin - pad, y: yMax + pad },
          ];
        }
        case 'path':
        default:
          return null;
      }
    };

    const collectLeafNodes = (n: NodeProps, out: NodeProps[]) => {
      if (n.type !== 'group') {
        out.push(n);
        return;
      }

      const children = ((n as unknown as GroupProps).children ?? []) as string[];
      for (const childId of children) {
        const child = runtime.nodes.get(childId);
        if (child) collectLeafNodes(child, out);
      }
    };

    const targets: NodeProps[] = [];
    collectLeafNodes(root, targets);

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let used = false;

    let topZ = Number.NEGATIVE_INFINITY;

    for (const n of targets) {
      if (!isVisibleAtTime(n)) continue;

      const cornersLocal = getCornersLocal(n);
      if (!cornersLocal) continue;

      const wt = getWorldTransform(runtime, n.id);
      const cornersScreen = cornersLocal
        .map((p) => localToWorld(p, wt))
        .map((p) => ({ x: p.x * scaleX, y: p.y * scaleY }));

      for (const p of cornersScreen) {
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
        used = true;
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }

      topZ = Math.max(topZ, n.zIndex);
    }

    if (!used) return null;

    // Extra padding in screen-space so thin outlines remain visible.
    const padScreen = 8;

    let left = minX - padScreen;
    let top = minY - padScreen;
    let w = maxX - minX + padScreen * 2;
    let h = maxY - minY + padScreen * 2;

    // Ensure tiny items (like single digits) still have an obvious highlight.
    const minSize = 32;
    if (w < minSize) {
      left -= (minSize - w) / 2;
      w = minSize;
    }
    if (h < minSize) {
      top -= (minSize - h) / 2;
      h = minSize;
    }

    return {
      left,
      top,
      width: w,
      height: h,
      zIndex: 1200 + (Number.isFinite(topZ) ? topZ : root.zIndex),
    };
  }, [selectedElementId, currentTime, program, displayWidth, displayHeight, renderKey]);

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
            zIndex: 0,
          }}
        />

        {/* Selected element highlight (covers canvas-rendered shapes/text) */}
        {selectionRect && (
          <div
            className="absolute pointer-events-none rounded-sm bg-primary/10 outline outline-2 outline-primary ring-2 ring-primary/50"
            style={{
              left: selectionRect.left,
              top: selectionRect.top,
              width: selectionRect.width,
              height: selectionRect.height,
              zIndex: selectionRect.zIndex,
            }}
          />
        )}

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
                className={`absolute pointer-events-auto bg-transparent rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
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
                  // Keep hit targets invisible, but make selection clearly visible.
                  opacity: isSelected || isHighlighted ? 1 : showHitDebug ? 0.12 : 0,
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
        {selectedElementId && (
          <>
            <span className="ml-2 text-primary">sel: {selectedElementId}</span>
            <span className="ml-1 text-white/40">
              ({runtimeRef.current?.nodes.get(selectedElementId)?.type ?? 'n/a'})
            </span>
            <span className="ml-1 text-white/40">
              {selectionRect
                ? `[${Math.round(selectionRect.width)}×${Math.round(selectionRect.height)}]`
                : '[no-rect]'}
            </span>
          </>
        )}
      </div>
    </div>
  );
};

export default IRAnimRenderer;
