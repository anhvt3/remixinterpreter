/**
 * IR Compiler - Converts DSL TimelineEvents to IR Program
 * 
 * This bridges the DSL executor output (timeline events) to the IR runtime format.
 */

import type { TimelineEvent } from '@/core/types';
import type { 
  IRProgram, 
  NodeProps, 
  AnimationKeyframe, 
  SceneConfig,
  NodeStyle,
  EasingType,
  Transform,
  Color,
} from './types';
import { 
  hexToColor, 
  createDefaultTransform, 
  createDefaultNodeStyle,
  createDefaultTextStyle,
} from './types';
import { theme, createThemedStyle } from './theme';
import { generateId } from './commands';

// ============================================================================
// COMPILER STATE
// ============================================================================

interface NodeCurrentState {
  content: string;
  opacity: number;
}

interface CompilerState {
  scene: SceneConfig;
  nodes: Map<string, NodeProps>;
  animations: AnimationKeyframe[];
  nodeOrder: string[]; // Track creation order for z-index
  nodeCurrentState: Map<string, NodeCurrentState>; // Track animated state for chaining
}

function createCompilerState(): CompilerState {
  return {
    scene: {
      width: 800,
      height: 600,
      fps: 60,
      duration: 10,
      background: theme.background,
    },
    nodes: new Map(),
    animations: [],
    nodeOrder: [],
    nodeCurrentState: new Map(),
  };
}

// ============================================================================
// COORDINATE CONVERSION
// ============================================================================

/**
 * Convert board coordinates to pixel coordinates
 * Board: viewbox = [xMin, yMax, xMax, yMin] (y is flipped)
 */
function boardToPixel(
  x: number, 
  y: number, 
  viewbox: number[], 
  width: number, 
  height: number
): { px: number; py: number } {
  const [xMin, yMax, xMax, yMin] = viewbox;
  const boardWidth = xMax - xMin;
  const boardHeight = yMax - yMin;
  
  const px = ((x - xMin) / boardWidth) * width;
  const py = ((yMax - y) / boardHeight) * height;
  
  return { px, py };
}

// ============================================================================
// STYLE CONVERSION
// ============================================================================

/**
 * Convert DSL style to IR NodeStyle
 */
function convertStyle(
  dslStyle?: { color?: string; scale?: number; weight?: string },
  opacity: number = 1
): NodeStyle {
  const style = createThemedStyle();
  
  // Enable fill for text visibility
  style.fill.enabled = true;
  
  if (dslStyle?.color) {
    const color = hexToColor(dslStyle.color);
    style.fill.color = color;
    style.stroke.color = color;
    style.glow.color = { ...color, a: 0.6 };
  } else {
    // Default to white text color
    style.fill.color = { r: 1, g: 1, b: 1, a: 1 };
  }
  
  style.opacity = opacity;
  
  // Disable stroke for text (we use fill)
  style.stroke.enabled = false;
  
  if (dslStyle?.scale) {
    style.text = style.text || createDefaultTextStyle();
    style.text.fontSize = dslStyle.scale * 24; // Base font size
  }
  
  if (dslStyle?.weight) {
    style.text = style.text || createDefaultTextStyle();
    style.text.fontWeight = dslStyle.weight as NodeStyle['text']['fontWeight'];
  }
  
  return style;
}

/**
 * Convert easing string to IR EasingType
 */
function convertEasing(ease?: string): EasingType {
  switch (ease) {
    case 'linear': return 'linear';
    case 'easeIn': 
    case 'easeInCubic': return 'easeInCubic';
    case 'easeOut':
    case 'easeOutCubic': return 'easeOutCubic';
    case 'easeInOut':
    case 'easeInOutCubic':
    default: return 'easeInOutCubic';
  }
}

// ============================================================================
// EVENT PROCESSORS
// ============================================================================

function processBoardInit(state: CompilerState, args: Record<string, unknown>): void {
  const viewbox = args.viewbox as number[] | undefined;
  const themeConfig = args.theme as { bg?: string } | undefined;
  
  if (viewbox) {
    // Calculate scene dimensions from viewbox aspect ratio
    const [xMin, yMax, xMax, yMin] = viewbox;
    const aspectRatio = (xMax - xMin) / (yMax - yMin);
    
    // Keep height fixed, adjust width
    state.scene.height = 600;
    state.scene.width = Math.round(600 * aspectRatio);
  }
  
  if (themeConfig?.bg) {
    state.scene.background = hexToColor(themeConfig.bg);
  }
  
  // Store viewbox in scene for coordinate conversion
  (state.scene as SceneConfig & { viewbox?: number[] }).viewbox = viewbox;
}

function processTextCreate(state: CompilerState, args: Record<string, unknown>): void {
  const id = args.id as string;
  const content = (args.content || args.text || '') as string;
  const mode = (args.mode || 'text') as 'text' | 'math';
  const at = args.at as { x?: number; y?: number } | undefined;
  const atX = (args.atX ?? at?.x ?? 0) as number;
  const atY = (args.atY ?? at?.y ?? 0) as number;
  const dslStyle = args.style as { color?: string; scale?: number; weight?: string } | undefined;
  const opacity = (args.opacity ?? 1) as number;
  const t0 = (args.t0 ?? 0) as number;
  const t1 = (args.t1 ?? t0 + 0.5) as number;
  const ease = args.ease as string | undefined;
  
  // Get viewbox for coordinate conversion
  const viewbox = (state.scene as SceneConfig & { viewbox?: number[] }).viewbox || [-6, 10, 6, -10];
  const { px, py } = boardToPixel(atX, atY, viewbox, state.scene.width, state.scene.height);
  
  // Create style
  const style = convertStyle(dslStyle, 0); // Start with 0 opacity for fade-in
  style.text = style.text || createDefaultTextStyle();
  
  // Handle math mode font
  if (mode === 'math') {
    style.text.fontFamily = '\"Times New Roman\", Times, serif';
    style.text.fontStyle = 'italic';
  }
  
  // Create text node - visible from start, opacity controlled by animation
  const node: NodeProps = {
    id,
    type: 'text',
    zIndex: state.nodeOrder.length,
    visible: true,
    // Don't use visibilitySpan - let opacity animation control visibility
    transform: {
      ...createDefaultTransform(),
      x: px,
      y: py,
    },
    style,
    content: mode === 'math' ? `\\(${content}\\)` : content,
  } as NodeProps;
  
  state.nodes.set(id, node);
  state.nodeOrder.push(id);
  
  // Track current state for chaining animations
  state.nodeCurrentState.set(id, {
    content: mode === 'math' ? `\\(${content}\\)` : content,
    opacity: opacity,
  });
  
  // Add fade-in animation (opacity starts at 0, fades to target)
  state.animations.push({
    id: generateId('anim'),
    nodeId: id,
    propertyPath: 'style.opacity',
    t0,
    t1,
    easing: convertEasing(ease),
    fromValue: 0,
    toValue: opacity,
  });
}

function processTextUpdate(state: CompilerState, args: Record<string, unknown>): void {
  const id = args.id as string;
  const toText = (args.toText || args.text || args.content) as string;
  const mode = (args.mode || 'text') as 'text' | 'math';
  const t0 = (args.t0 ?? 0) as number;
  const t1 = (args.t1 ?? t0 + 0.5) as number;
  const ease = args.ease as string | undefined;
  const dslStyle = args.style as { color?: string; scale?: number; weight?: string } | undefined;
  
  const existingNode = state.nodes.get(id);
  if (!existingNode) return;
  
  // Get current tracked state (or fallback to node values)
  const currentState = state.nodeCurrentState.get(id) || {
    content: (existingNode as { content: string }).content,
    opacity: existingNode.style.opacity || 1,
  };
  
  // For text updates, we create a cross-fade by animating to 0, updating content, then back to 1
  const midTime = (t0 + t1) / 2;
  
  // Fade out old content (from current opacity, not node's initial opacity)
  state.animations.push({
    id: generateId('anim'),
    nodeId: id,
    propertyPath: 'style.opacity',
    t0,
    t1: midTime,
    easing: convertEasing(ease),
    fromValue: currentState.opacity,
    toValue: 0,
  });
  
  // Update content at midpoint (instantaneous)
  const newContent = mode === 'math' ? `\\(${toText}\\)` : toText;
  state.animations.push({
    id: generateId('anim'),
    nodeId: id,
    propertyPath: 'content',
    t0: midTime,
    t1: midTime + 0.001,
    easing: 'linear',
    fromValue: currentState.content,
    toValue: newContent,
  });
  
  // Fade in new content
  const targetOpacity = dslStyle ? (convertStyle(dslStyle).opacity || 1) : currentState.opacity;
  state.animations.push({
    id: generateId('anim'),
    nodeId: id,
    propertyPath: 'style.opacity',
    t0: midTime,
    t1,
    easing: convertEasing(ease),
    fromValue: 0,
    toValue: targetOpacity,
  });
  
  // Update tracked state for future chained updates
  state.nodeCurrentState.set(id, {
    content: newContent,
    opacity: targetOpacity,
  });
  
  // Update style if provided
  if (dslStyle) {
    const newStyle = convertStyle(dslStyle, targetOpacity);
    if (dslStyle.color) {
      state.animations.push({
        id: generateId('anim'),
        nodeId: id,
        propertyPath: 'style.fill.color',
        t0: midTime,
        t1,
        easing: convertEasing(ease),
        fromValue: existingNode.style.fill.color,
        toValue: newStyle.fill.color,
      });
    }
  }
}

function processShapeCreate(state: CompilerState, args: Record<string, unknown>): void {
  const id = args.id as string;
  const shapeType = (args.shapeType || args.type || 'rect') as string;
  const at = args.at as { x?: number; y?: number } | undefined;
  const atX = (args.atX ?? at?.x ?? 0) as number;
  const atY = (args.atY ?? at?.y ?? 0) as number;
  const opacity = (args.opacity ?? 1) as number;
  const t0 = (args.t0 ?? 0) as number;
  const t1 = (args.t1 ?? t0 + 0.5) as number;
  const ease = args.ease as string | undefined;
  
  const viewbox = (state.scene as SceneConfig & { viewbox?: number[] }).viewbox || [-6, 10, 6, -10];
  const { px, py } = boardToPixel(atX, atY, viewbox, state.scene.width, state.scene.height);
  
  // Create style with glow
  const style = createThemedStyle();
  style.opacity = 0; // Start hidden for fade-in
  style.fill.enabled = true;
  style.fill.color = { ...theme.defaultFill.color, a: 0.3 };
  style.stroke.enabled = true;
  style.glow.enabled = true;
  
  if (args.fill) {
    style.fill.color = hexToColor(args.fill as string, 0.3);
  }
  if (args.stroke) {
    const strokeColor = hexToColor(args.stroke as string);
    style.stroke.color = strokeColor;
    style.glow.color = { ...strokeColor, a: 0.6 };
  }
  
  let node: NodeProps;
  
  // Scale factors for board to pixel
  const [xMin, yMax, xMax, yMin] = viewbox;
  const scaleX = state.scene.width / (xMax - xMin);
  const scaleY = state.scene.height / (yMax - yMin);
  
  switch (shapeType) {
    case 'circle': {
      const radius = ((args.radius as number) || 0.5) * scaleX;
      node = {
        id,
        type: 'circle',
        zIndex: state.nodeOrder.length,
        visible: true,
        transform: { ...createDefaultTransform(), x: px, y: py },
        style,
        radius,
      } as NodeProps;
      break;
    }
    
    case 'rect': {
      const width = ((args.width as number) || 1) * scaleX;
      const height = ((args.height as number) || 1) * scaleY;
      node = {
        id,
        type: 'rect',
        zIndex: state.nodeOrder.length,
        visible: true,
        transform: { ...createDefaultTransform(), x: px - width/2, y: py - height/2 },
        style,
        width,
        height,
      } as NodeProps;
      break;
    }
    
    case 'line': {
      const from = args.from as { x: number; y: number } | undefined;
      const to = args.to as { x: number; y: number } | undefined;
      if (from && to) {
        const { px: x1, py: y1 } = boardToPixel(from.x, from.y, viewbox, state.scene.width, state.scene.height);
        const { px: x2, py: y2 } = boardToPixel(to.x, to.y, viewbox, state.scene.width, state.scene.height);
        node = {
          id,
          type: 'line',
          zIndex: state.nodeOrder.length,
          visible: true,
          transform: createDefaultTransform(),
          style,
          x1, y1, x2, y2,
        } as NodeProps;
      } else {
        return;
      }
      break;
    }
    
    case 'polygon': {
      const points = args.points as Array<{ x: number; y: number }> | undefined;
      if (points) {
        const pixelPoints = points.map(p => {
          const { px, py } = boardToPixel(p.x, p.y, viewbox, state.scene.width, state.scene.height);
          return { x: px, y: py };
        });
        node = {
          id,
          type: 'polygon',
          zIndex: state.nodeOrder.length,
          visible: true,
          transform: createDefaultTransform(),
          style,
          points: pixelPoints,
        } as NodeProps;
      } else {
        return;
      }
      break;
    }
    
    default:
      return;
  }
  
  state.nodes.set(id, node);
  state.nodeOrder.push(id);
  
  // Add fade-in animation
  state.animations.push({
    id: generateId('anim'),
    nodeId: id,
    propertyPath: 'style.opacity',
    t0,
    t1,
    easing: convertEasing(ease),
    fromValue: 0,
    toValue: opacity,
  });
}

function processShapeUpdate(state: CompilerState, args: Record<string, unknown>): void {
  const id = args.id as string;
  const existingNode = state.nodes.get(id);
  if (!existingNode) return;
  
  const t0 = (args.t0 ?? 0) as number;
  const t1 = (args.t1 ?? t0 + 0.5) as number;
  const ease = args.ease as string | undefined;
  
  // Animate opacity changes
  if (args.opacity !== undefined) {
    state.animations.push({
      id: generateId('anim'),
      nodeId: id,
      propertyPath: 'style.opacity',
      t0,
      t1,
      easing: convertEasing(ease),
      fromValue: existingNode.style.opacity,
      toValue: args.opacity as number,
    });
  }
  
  // Animate glow changes
  if (args.glow !== undefined) {
    state.animations.push({
      id: generateId('anim'),
      nodeId: id,
      propertyPath: 'style.glow.enabled',
      t0,
      t1: t0 + 0.001,
      easing: 'linear',
      fromValue: existingNode.style.glow.enabled,
      toValue: args.glow as boolean,
    });
    
    if (args.glow) {
      state.animations.push({
        id: generateId('anim'),
        nodeId: id,
        propertyPath: 'style.glow.intensity',
        t0,
        t1,
        easing: convertEasing(ease),
        fromValue: 0,
        toValue: 1.5,
      });
    }
  }
}

// ============================================================================
// MAIN COMPILER
// ============================================================================

/**
 * Compile DSL timeline events to IR program
 */
export function compileToIR(events: TimelineEvent[], duration?: number): IRProgram {
  const state = createCompilerState();
  
  // Calculate duration from events
  let maxTime = 0;
  for (const event of events) {
    const t1 = (event.args.t1 as number) || 0;
    if (t1 > maxTime) maxTime = t1;
  }
  state.scene.duration = duration ?? Math.max(maxTime + 2, 10);
  
  // Process each event
  for (const event of events) {
    switch (event.type) {
      case 'board.init':
        processBoardInit(state, event.args);
        break;
      case 'text.create':
        processTextCreate(state, event.args);
        break;
      case 'text.update':
        processTextUpdate(state, event.args);
        break;
      case 'shape.create':
        processShapeCreate(state, event.args);
        break;
      case 'shape.update':
        processShapeUpdate(state, event.args);
        break;
    }
  }
  
  return {
    version: '1.0.0',
    scene: state.scene,
    nodes: Array.from(state.nodes.values()),
    animations: state.animations,
  };
}

/**
 * Get computed duration from timeline events
 */
export function getTimelineDuration(events: TimelineEvent[]): number {
  let maxTime = 0;
  for (const event of events) {
    const t1 = (event.args.t1 as number) || 0;
    if (t1 > maxTime) maxTime = t1;
  }
  return maxTime;
}
