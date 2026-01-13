/**
 * IR Runtime - Scene Graph & Canvas Renderer
 * 
 * Handles:
 * - Node registration and scene graph management
 * - Transform resolution (local → world)
 * - Animation keyframe interpolation
 * - Canvas rendering with proper glow/opacity compositing
 */

import type {
  NodeProps,
  SceneConfig,
  AnimationKeyframe,
  IRProgram,
  Transform,
  NodeStyle,
  Color,
  GroupProps,
  TextProps,
} from './types';
import katex from 'katex';
import {
  colorToRGBA,
  lerpColor,
  lerpTransform,
  createDefaultTransform,
} from './types';
import { getEasingFunction, getProgress } from './easing';
import { theme } from './theme';

// ============================================================================
// RUNTIME STATE
// ============================================================================

export interface RuntimeState {
  scene: SceneConfig;

  /**
   * Mutable nodes for the current frame.
   * NOTE: These are reset from baseNodes inside applyAnimations() to support scrubbing.
   */
  nodes: Map<string, NodeProps>;

  /**
   * Immutable snapshot of nodes as loaded from the IR program (after parent/child wiring).
   * Used to reset the runtime every frame before applying animations.
   */
  baseNodes: Map<string, NodeProps>;

  animations: AnimationKeyframe[];
  currentTime: number;
  isPlaying: boolean;
  canvas: HTMLCanvasElement | null;
  ctx: CanvasRenderingContext2D | null;
}

export function createRuntime(): RuntimeState {
  return {
    scene: {
      width: 800,
      height: 600,
      fps: 60,
      duration: 10,
      background: theme.background,
    },
    nodes: new Map(),
    baseNodes: new Map(),
    animations: [],
    currentTime: 0,
    isPlaying: false,
    canvas: null,
    ctx: null,
  };
}

// ============================================================================
// SCENE MANAGEMENT
// ============================================================================

export function initScene(state: RuntimeState, config: Partial<SceneConfig>): void {
  state.scene = { ...state.scene, ...config };
}

export function attachCanvas(state: RuntimeState, canvas: HTMLCanvasElement): void {
  state.canvas = canvas;
  state.ctx = canvas.getContext('2d');
  canvas.width = state.scene.width;
  canvas.height = state.scene.height;
}

// ============================================================================
// NODE MANAGEMENT
// ============================================================================

export function addNode(state: RuntimeState, node: NodeProps): void {
  state.nodes.set(node.id, JSON.parse(JSON.stringify(node)));
  
  // If node has a parent, add to parent's children
  if (node.parentId) {
    const parent = state.nodes.get(node.parentId);
    if (parent && parent.type === 'group') {
      (parent as GroupProps).children.push(node.id);
    }
  }
}

export function updateNode(state: RuntimeState, id: string, updates: Partial<NodeProps>): void {
  const node = state.nodes.get(id);
  if (!node) return;
  
  // Deep merge updates
  deepMerge(node as unknown as Record<string, unknown>, updates as unknown as Record<string, unknown>);
}

export function removeNode(state: RuntimeState, id: string): void {
  const node = state.nodes.get(id);
  if (!node) return;
  
  // Remove from parent's children
  if (node.parentId) {
    const parent = state.nodes.get(node.parentId);
    if (parent && parent.type === 'group') {
      const groupParent = parent as GroupProps;
      groupParent.children = groupParent.children.filter(c => c !== id);
    }
  }
  
  state.nodes.delete(id);
}

export function getNode(state: RuntimeState, id: string): NodeProps | undefined {
  return state.nodes.get(id);
}

// ============================================================================
// ANIMATION MANAGEMENT
// ============================================================================

export function addAnimation(state: RuntimeState, anim: AnimationKeyframe): void {
  state.animations.push(anim);
}

export function removeAnimation(state: RuntimeState, id: string): void {
  state.animations = state.animations.filter(a => a.id !== id);
}

export function clearAnimations(state: RuntimeState): void {
  state.animations = [];
}

// ============================================================================
// ANIMATION INTERPOLATION
// ============================================================================

/**
 * Get the interpolated value for a property at a given time
 */
function interpolateProperty(
  fromValue: unknown,
  toValue: unknown,
  t: number
): unknown {
  // Number interpolation
  if (typeof fromValue === 'number' && typeof toValue === 'number') {
    return fromValue + (toValue - fromValue) * t;
  }
  
  // Color interpolation
  if (isColor(fromValue) && isColor(toValue)) {
    return lerpColor(fromValue as Color, toValue as Color, t);
  }
  
  // Transform interpolation
  if (isTransform(fromValue) && isTransform(toValue)) {
    return lerpTransform(fromValue as Transform, toValue as Transform, t);
  }
  
  // Default: snap at midpoint
  return t < 0.5 ? fromValue : toValue;
}

function isColor(v: unknown): v is Color {
  return typeof v === 'object' && v !== null && 'r' in v && 'g' in v && 'b' in v && 'a' in v;
}

function isTransform(v: unknown): v is Transform {
  return typeof v === 'object' && v !== null && 'x' in v && 'y' in v && 'scaleX' in v;
}

/**
 * Apply all active animations to nodes at current time
 * 
 * Animation behavior:
 * - Before t0: Use fromValue
 * - Between t0 and t1: Interpolate with easing
 * - After t1: Use toValue (animation "sticks" at final value)
 */
export function applyAnimations(state: RuntimeState): void {
  const time = state.currentTime;
  
  // Reset nodes from baseNodes so scrubbing backwards works correctly
  // Guard: only reset if baseNodes exists and is iterable
  if (state.baseNodes && state.baseNodes.size > 0) {
    state.nodes.clear();
    for (const [id, node] of state.baseNodes) {
      state.nodes.set(id, JSON.parse(JSON.stringify(node)));
    }
  }
  
  for (const anim of state.animations) {
    const node = state.nodes.get(anim.nodeId);
    if (!node) continue;
    
    let value: unknown;
    
    if (time < anim.t0) {
      // Before animation starts - use initial value
      value = anim.fromValue;
    } else if (time >= anim.t1) {
      // After animation ends - stick at final value
      value = anim.toValue;
    } else {
      // During animation - interpolate with easing
      const rawProgress = getProgress(time, anim.t0, anim.t1);
      const easingFn = getEasingFunction(anim.easing);
      const easedProgress = easingFn(rawProgress);
      value = interpolateProperty(anim.fromValue, anim.toValue, easedProgress);
    }
    
    // Apply to node via property path
    setPropertyByPath(node, anim.propertyPath, value);
  }
}

/**
 * Set a nested property value by dot-separated path
 */
function setPropertyByPath(obj: unknown, path: string, value: unknown): void {
  const parts = path.split('.');
  let current = obj as Record<string, unknown>;
  
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] === undefined) {
      current[parts[i]] = {};
    }
    current = current[parts[i]] as Record<string, unknown>;
  }
  
  current[parts[parts.length - 1]] = value;
}

/**
 * Get a nested property value by dot-separated path
 */
export function getPropertyByPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current = obj as Record<string, unknown>;
  
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part] as Record<string, unknown>;
  }
  
  return current;
}

// ============================================================================
// TRANSFORM RESOLUTION
// ============================================================================

/**
 * Compute world transform by concatenating parent transforms
 */
export function getWorldTransform(state: RuntimeState, nodeId: string): Transform {
  const node = state.nodes.get(nodeId);
  if (!node) return createDefaultTransform();
  
  // Get local transform
  const local = node.transform;
  
  // If no parent, local is world
  if (!node.parentId) return local;
  
  // Get parent's world transform
  const parentWorld = getWorldTransform(state, node.parentId);
  
  // Concatenate transforms
  return concatenateTransforms(parentWorld, local);
}

function concatenateTransforms(parent: Transform, child: Transform): Transform {
  // Apply parent's scale and rotation to child's translation
  const cos = Math.cos(parent.rotation);
  const sin = Math.sin(parent.rotation);
  
  const x = parent.x + (child.x * parent.scaleX * cos - child.y * parent.scaleY * sin);
  const y = parent.y + (child.x * parent.scaleX * sin + child.y * parent.scaleY * cos);
  
  return {
    x,
    y,
    scaleX: parent.scaleX * child.scaleX,
    scaleY: parent.scaleY * child.scaleY,
    rotation: parent.rotation + child.rotation,
    originX: child.originX,
    originY: child.originY,
  };
}

// ============================================================================
// VISIBILITY
// ============================================================================

/**
 * Check if a node is visible at current time
 */
function isNodeVisible(node: NodeProps, time: number): boolean {
  if (!node.visible) return false;
  
  if (node.visibilitySpan) {
    const { t0, t1 } = node.visibilitySpan;
    if (time < t0 || time > t1) return false;
  }
  
  return true;
}

// ============================================================================
// RENDERING
// ============================================================================

/**
 * Render the entire scene at current time
 */
export function render(state: RuntimeState): void {
  const { ctx, canvas, scene, nodes, currentTime } = state;
  if (!ctx || !canvas) return;
  
  // Apply animations
  applyAnimations(state);
  
  // Clear and fill background
  ctx.fillStyle = colorToRGBA(scene.background);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Collect visible nodes and sort by z-index
  const visibleNodes: NodeProps[] = [];
  for (const node of nodes.values()) {
    if (node.type !== 'group' && isNodeVisible(node, currentTime)) {
      visibleNodes.push(node);
    }
  }
  visibleNodes.sort((a, b) => a.zIndex - b.zIndex);
  
  // Render each node
  for (const node of visibleNodes) {
    renderNode(state, node);
  }
}

/**
 * Render a single node
 */
function renderNode(state: RuntimeState, node: NodeProps): void {
  const { ctx } = state;
  if (!ctx) return;
  
  const worldTransform = getWorldTransform(state, node.id);
  const style = node.style;
  
  ctx.save();
  
  // Apply transform
  applyTransform(ctx, worldTransform);
  
  // Apply global opacity
  ctx.globalAlpha = style.opacity;
  
  // Build path for shape
  const path = buildPath(ctx, node);
  
  if (path) {
    // Render order: glow → fill → stroke
    // This ensures glow is behind, fill is in middle, stroke is on top
    
    // 1. Render glow (if enabled)
    if (style.glow.enabled) {
      renderGlow(ctx, path, style, node);
    }
    
    // 2. Render fill (if enabled)
    if (style.fill.enabled) {
      ctx.fillStyle = colorToRGBA(style.fill.color);
      ctx.fill(path);
    }
    
    // 3. Render stroke (if enabled)
    if (style.stroke.enabled) {
      ctx.strokeStyle = colorToRGBA(style.stroke.color);
      ctx.lineWidth = style.stroke.width;
      ctx.lineCap = style.stroke.lineCap || 'round';
      ctx.lineJoin = style.stroke.lineJoin || 'round';
      if (style.stroke.dashArray) {
        ctx.setLineDash(style.stroke.dashArray);
        ctx.lineDashOffset = style.stroke.dashOffset || 0;
      }
      ctx.stroke(path);
    }
  }
  
  // Handle text separately
  if (node.type === 'text') {
    renderText(ctx, node, style);
  }
  
  ctx.restore();
}

/**
 * Apply transform to canvas context
 */
function applyTransform(ctx: CanvasRenderingContext2D, t: Transform): void {
  ctx.translate(t.x, t.y);
  ctx.rotate(t.rotation);
  ctx.scale(t.scaleX, t.scaleY);
  ctx.translate(-t.originX, -t.originY);
}

/**
 * Build a Path2D for a node
 */
function buildPath(ctx: CanvasRenderingContext2D, node: NodeProps): Path2D | null {
  const path = new Path2D();
  
  switch (node.type) {
    case 'rect': {
      path.rect(0, 0, node.width, node.height);
      return path;
    }
    
    case 'roundedRect': {
      roundedRectPath(path, 0, 0, node.width, node.height, node.cornerRadius);
      return path;
    }
    
    case 'circle': {
      path.arc(0, 0, node.radius, 0, Math.PI * 2);
      return path;
    }
    
    case 'ellipse': {
      path.ellipse(0, 0, node.radiusX, node.radiusY, 0, 0, Math.PI * 2);
      return path;
    }
    
    case 'line': {
      path.moveTo(node.x1, node.y1);
      path.lineTo(node.x2, node.y2);
      return path;
    }
    
    case 'polyline': {
      if (node.points.length === 0) return null;
      path.moveTo(node.points[0].x, node.points[0].y);
      for (let i = 1; i < node.points.length; i++) {
        path.lineTo(node.points[i].x, node.points[i].y);
      }
      return path;
    }
    
    case 'polygon': {
      if (node.points.length === 0) return null;
      path.moveTo(node.points[0].x, node.points[0].y);
      for (let i = 1; i < node.points.length; i++) {
        path.lineTo(node.points[i].x, node.points[i].y);
      }
      path.closePath();
      return path;
    }
    
    case 'arc': {
      path.arc(0, 0, node.radius, node.startAngle, node.endAngle, node.counterClockwise);
      return path;
    }
    
    case 'path': {
      // Use Path2D with SVG path data
      return new Path2D(node.d);
    }
    
    case 'text':
    case 'group':
      return null;
      
    default:
      return null;
  }
}

/**
 * Helper for rounded rectangle path
 */
function roundedRectPath(
  path: Path2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y);
  path.quadraticCurveTo(x + w, y, x + w, y + r);
  path.lineTo(x + w, y + h - r);
  path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  path.lineTo(x + r, y + h);
  path.quadraticCurveTo(x, y + h, x, y + h - r);
  path.lineTo(x, y + r);
  path.quadraticCurveTo(x, y, x + r, y);
  path.closePath();
}

/**
 * Render glow effect
 * 
 * Technique: Use canvas shadowBlur for soft glow
 * For intensity > 1, we draw multiple passes
 */
function renderGlow(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  style: NodeStyle,
  node: NodeProps
): void {
  const { glow, stroke } = style;
  
  ctx.save();
  
  // Set up shadow for glow effect
  ctx.shadowColor = colorToRGBA(glow.color, glow.color.a * glow.intensity);
  ctx.shadowBlur = glow.blurPx;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  
  // For spread, we can stroke with a thicker line
  if (stroke.enabled && glow.spreadPx > 0) {
    ctx.strokeStyle = colorToRGBA(glow.color, glow.color.a * 0.5);
    ctx.lineWidth = stroke.width + glow.spreadPx * 2;
    ctx.stroke(path);
  }
  
  // Draw the main glow (using stroke as base)
  if (stroke.enabled) {
    ctx.strokeStyle = colorToRGBA(stroke.color, 0.01); // Nearly invisible, just for shadow
    ctx.lineWidth = stroke.width;
    ctx.stroke(path);
  }
  
  // For high intensity, add additional glow passes
  if (glow.intensity > 1) {
    const passes = Math.min(Math.ceil(glow.intensity), 3);
    for (let i = 1; i < passes; i++) {
      ctx.shadowBlur = glow.blurPx * (1 + i * 0.5);
      ctx.shadowColor = colorToRGBA(glow.color, glow.color.a * 0.3);
      if (stroke.enabled) {
        ctx.stroke(path);
      }
    }
  }
  
  ctx.restore();
}

// LaTeX rendering cache
const latexCache = new Map<string, { img: HTMLImageElement; width: number; height: number }>();

// Callback to notify when LaTeX images are ready
let onLatexReadyCallback: (() => void) | null = null;

/**
 * Set callback for when LaTeX images finish rendering
 */
export function setLatexReadyCallback(cb: (() => void) | null): void {
  onLatexReadyCallback = cb;
}

/**
 * Check if text contains LaTeX delimiters
 */
function isLatexContent(content: unknown): boolean {
  if (typeof content !== 'string') return false;
  return content.includes('\\(') || content.includes('\\[') || 
         content.includes('$') || content.includes('\\frac') ||
         content.includes('\\sqrt') || content.includes('^{');
}

/**
 * Extract LaTeX from delimiters
 */
function extractLatex(content: string): string {
  // Handle \(...\) inline math
  const inlineMatch = content.match(/\\\((.*?)\\\)/s);
  if (inlineMatch) return inlineMatch[1];
  
  // Handle \[...\] display math
  const displayMatch = content.match(/\\\[(.*?)\\\]/s);
  if (displayMatch) return displayMatch[1];
  
  // Handle $...$ inline math
  const dollarMatch = content.match(/\$(.*?)\$/s);
  if (dollarMatch) return dollarMatch[1];
  
  // Return as-is if no delimiters found
  return content;
}

/**
 * Render LaTeX to an image via SVG foreignObject
 */
function renderLatexToImage(
  latex: string,
  fontSize: number,
  color: string
): Promise<{ img: HTMLImageElement; width: number; height: number }> {
  const cacheKey = `${latex}|${fontSize}|${color}`;
  
  const cached = latexCache.get(cacheKey);
  if (cached) return Promise.resolve(cached);
  
  return new Promise((resolve) => {
    // Create temporary container for measurement
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.fontSize = `${fontSize}px`;
    container.style.color = color;
    container.style.visibility = 'hidden';
    document.body.appendChild(container);
    
    try {
      // Render LaTeX using KaTeX
      katex.render(latex, container, {
        throwOnError: false,
        displayMode: false,
        output: 'html',
      });
      
      // Get dimensions
      const rect = container.getBoundingClientRect();
      const width = Math.ceil(rect.width) + 8;
      const height = Math.ceil(rect.height) + 8;
      
      // Create SVG with foreignObject containing the rendered KaTeX
      const scale = 2; // Retina scale
      const svgWidth = width * scale;
      const svgHeight = height * scale;
      
      // Build SVG with inline KaTeX HTML
      const katexHtml = container.innerHTML;
      
      // Need to inline all styles for foreignObject to work
      const svgContent = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml" style="font-size: ${fontSize * scale}px; color: ${color}; font-family: 'Times New Roman', Times, serif; display: flex; align-items: center; justify-content: center; height: 100%;">
              ${katexHtml}
            </div>
          </foreignObject>
        </svg>
      `;
      
      // Convert to data URL
      const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        document.body.removeChild(container);
        
        const result = { img, width, height };
        latexCache.set(cacheKey, result);
        resolve(result);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        document.body.removeChild(container);
        resolve({ img: new Image(), width: 0, height: 0 });
      };
      img.src = url;
      
    } catch (e) {
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
      resolve({ img: new Image(), width: 0, height: 0 });
    }
  });
}

// Store pending LaTeX renders to avoid flicker
const pendingLatexRenders = new Map<string, boolean>();

/**
 * Render text node - handles both plain text and LaTeX
 */
function renderText(
  ctx: CanvasRenderingContext2D,
  node: NodeProps,
  style: NodeStyle
): void {
  if (node.type !== 'text') return;
  
  const textNode = node as TextProps;
  const content = textNode.content;
  const textStyle = style.text || theme.defaultText;
  
  // Check if this is LaTeX content - skip canvas rendering as it's handled by DOM overlay
  if (isLatexContent(content)) {
    // LaTeX is rendered via DOM overlay in IRAnimRenderer, skip canvas rendering
    return;
  }
  
  // Plain text rendering (or fallback)
  ctx.font = `${textStyle.fontStyle} ${textStyle.fontWeight} ${textStyle.fontSize}px ${textStyle.fontFamily}`;
  ctx.textAlign = textStyle.textAlign;
  ctx.textBaseline = textStyle.textBaseline;
  
  // Apply glow to text if enabled
  if (style.glow.enabled) {
    ctx.save();
    ctx.shadowColor = colorToRGBA(style.glow.color, style.glow.color.a * style.glow.intensity);
    ctx.shadowBlur = style.glow.blurPx;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    if (style.fill.enabled) {
      ctx.fillStyle = colorToRGBA(style.fill.color);
      ctx.fillText(content, 0, 0);
    }
    ctx.restore();
  }
  
  // Draw actual text
  if (style.fill.enabled) {
    ctx.fillStyle = colorToRGBA(style.fill.color);
    ctx.fillText(content, 0, 0);
  }
  
  if (style.stroke.enabled) {
    ctx.strokeStyle = colorToRGBA(style.stroke.color);
    ctx.lineWidth = style.stroke.width;
    ctx.strokeText(content, 0, 0);
  }
}

// ============================================================================
// PLAYBACK CONTROL
// ============================================================================

export function setTime(state: RuntimeState, time: number): void {
  state.currentTime = Math.max(0, Math.min(time, state.scene.duration));
}

export function play(state: RuntimeState): void {
  state.isPlaying = true;
}

export function pause(state: RuntimeState): void {
  state.isPlaying = false;
}

export function step(state: RuntimeState, deltaTime: number): void {
  if (state.isPlaying) {
    state.currentTime += deltaTime;
    if (state.currentTime >= state.scene.duration) {
      state.currentTime = 0; // Loop
    }
  }
}

// ============================================================================
// EXPORT
// ============================================================================

/**
 * Export current frame as PNG data URL
 */
export function exportFrameAsPNG(state: RuntimeState): string | null {
  if (!state.canvas) return null;
  render(state);
  return state.canvas.toDataURL('image/png');
}

/**
 * Load an IR program into the runtime
 */
export function loadProgram(state: RuntimeState, program: IRProgram): void {
  // Reset state
  state.nodes.clear();
  state.baseNodes.clear();
  state.animations = [];
  state.currentTime = 0;
  
  // Load scene config
  initScene(state, program.scene);
  
  // Load nodes into baseNodes (the immutable snapshot)
  for (const node of program.nodes) {
    const nodeCopy = JSON.parse(JSON.stringify(node));
    state.baseNodes.set(node.id, nodeCopy);
    
    // If node has a parent, add to parent's children in baseNodes
    if (node.parentId) {
      const parent = state.baseNodes.get(node.parentId);
      if (parent && parent.type === 'group') {
        (parent as GroupProps).children.push(node.id);
      }
    }
  }
  
  // Copy baseNodes to nodes for initial render
  for (const [id, node] of state.baseNodes) {
    state.nodes.set(id, JSON.parse(JSON.stringify(node)));
  }
  
  // Load animations
  for (const anim of program.animations) {
    addAnimation(state, anim);
  }
  
  // Resize canvas if attached
  if (state.canvas) {
    state.canvas.width = state.scene.width;
    state.canvas.height = state.scene.height;
  }
}

// ============================================================================
// UTILITY
// ============================================================================

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
    } else {
      target[key] = source[key];
    }
  }
}
