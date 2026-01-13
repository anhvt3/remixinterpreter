/**
 * Core IR Data Structures for Vector Animation
 * 
 * Design Philosophy:
 * - Deterministic: Same IR commands always produce identical output
 * - Composable: Styles can be mixed and overridden
 * - Timeline-based: All animations are keyframe-driven
 */

// ============================================================================
// COLOR & BASIC TYPES
// ============================================================================

/**
 * RGBA Color with 0-1 normalized values
 * Alpha is separate for easy animation
 */
export interface Color {
  r: number; // 0-1
  g: number; // 0-1
  b: number; // 0-1
  a: number; // 0-1 (alpha)
}

/**
 * Create a color from hex string
 * Supports: #RGB, #RRGGBB, #RRGGBBAA
 */
export function hexToColor(hex: string, alpha: number = 1): Color {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  const a = h.length === 8 ? parseInt(h.substring(6, 8), 16) / 255 : alpha;
  return { r, g, b, a };
}

/**
 * Convert Color to CSS rgba() string
 */
export function colorToRGBA(c: Color, overrideAlpha?: number): string {
  const a = overrideAlpha ?? c.a;
  return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${a})`;
}

/**
 * Interpolate between two colors
 */
export function lerpColor(a: Color, b: Color, t: number): Color {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
    a: a.a + (b.a - a.a) * t,
  };
}

// ============================================================================
// STYLE TYPES
// ============================================================================

/**
 * Stroke style for paths and shapes
 */
export interface StrokeStyle {
  enabled: boolean;
  color: Color;
  width: number;         // Stroke width in pixels
  lineCap?: 'butt' | 'round' | 'square';
  lineJoin?: 'miter' | 'round' | 'bevel';
  dashArray?: number[];  // For dashed lines
  dashOffset?: number;
}

/**
 * Fill style for shapes
 */
export interface FillStyle {
  enabled: boolean;
  color: Color;
}

/**
 * Glow/shadow effect style
 * 
 * Implementation: Canvas shadowBlur + shadowColor
 * For crisp stroke with soft glow, we draw:
 * 1. First pass: glow only (fill with shadow, then clear fill)
 * 2. Second pass: actual stroke
 */
export interface GlowStyle {
  enabled: boolean;
  color: Color;          // Glow color (usually same as stroke but brighter)
  blurPx: number;        // Shadow blur radius (Canvas shadowBlur)
  spreadPx: number;      // Additional spread (achieved via multi-pass if needed)
  intensity: number;     // Multiplier for glow opacity (1 = normal)
}

/**
 * Text style
 */
export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  fontStyle: 'normal' | 'italic';
  textAlign: 'left' | 'center' | 'right';
  textBaseline: 'top' | 'middle' | 'bottom' | 'alphabetic';
}

/**
 * Combined node style
 */
export interface NodeStyle {
  opacity: number;       // Overall opacity multiplier (0-1)
  fill: FillStyle;
  stroke: StrokeStyle;
  glow: GlowStyle;
  text?: TextStyle;      // Only for text nodes
}

// ============================================================================
// TRANSFORM
// ============================================================================

/**
 * 2D Transform
 * Applied in order: scale → rotate → translate
 */
export interface Transform {
  x: number;             // Translation X
  y: number;             // Translation Y
  scaleX: number;        // Scale X (1 = normal)
  scaleY: number;        // Scale Y (1 = normal)
  rotation: number;      // Rotation in radians
  originX: number;       // Transform origin X (relative to node)
  originY: number;       // Transform origin Y (relative to node)
}

export function createDefaultTransform(): Transform {
  return {
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    originX: 0,
    originY: 0,
  };
}

/**
 * Interpolate between two transforms
 */
export function lerpTransform(a: Transform, b: Transform, t: number): Transform {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    scaleX: a.scaleX + (b.scaleX - a.scaleX) * t,
    scaleY: a.scaleY + (b.scaleY - a.scaleY) * t,
    rotation: a.rotation + (b.rotation - a.rotation) * t,
    originX: a.originX + (b.originX - a.originX) * t,
    originY: a.originY + (b.originY - a.originY) * t,
  };
}

// ============================================================================
// EASING
// ============================================================================

export type EasingType = 'linear' | 'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic';

// ============================================================================
// TIMELINE & ANIMATION
// ============================================================================

/**
 * Timeline span for when a node is visible
 */
export interface TimelineSpan {
  t0: number;            // Start time in seconds
  t1: number;            // End time in seconds (Infinity for forever)
}

/**
 * Animation keyframe for a property
 */
export interface AnimationKeyframe {
  id: string;            // Unique keyframe ID
  nodeId: string;        // Target node
  propertyPath: string;  // Dot-separated path: "transform.x", "style.opacity", "style.glow.intensity"
  t0: number;            // Start time
  t1: number;            // End time
  easing: EasingType;
  fromValue: unknown;    // Start value
  toValue: unknown;      // End value
}

// ============================================================================
// NODE TYPES
// ============================================================================

export type NodeType = 
  | 'group' 
  | 'rect' 
  | 'roundedRect'
  | 'circle' 
  | 'ellipse'
  | 'line' 
  | 'polyline' 
  | 'polygon' 
  | 'path'
  | 'text'
  | 'arc';

/**
 * Base properties shared by all nodes
 */
export interface BaseNodeProps {
  id: string;
  type: NodeType;
  parentId?: string;     // Parent group ID
  zIndex: number;        // Z-order (higher = on top)
  visible: boolean;
  visibilitySpan?: TimelineSpan;  // Auto-show/hide based on time
  transform: Transform;
  style: NodeStyle;
}

/**
 * Rectangle node
 */
export interface RectProps extends BaseNodeProps {
  type: 'rect';
  width: number;
  height: number;
}

/**
 * Rounded rectangle node
 */
export interface RoundedRectProps extends BaseNodeProps {
  type: 'roundedRect';
  width: number;
  height: number;
  cornerRadius: number;
}

/**
 * Circle node
 */
export interface CircleProps extends BaseNodeProps {
  type: 'circle';
  radius: number;
}

/**
 * Ellipse node
 */
export interface EllipseProps extends BaseNodeProps {
  type: 'ellipse';
  radiusX: number;
  radiusY: number;
}

/**
 * Line segment
 */
export interface LineProps extends BaseNodeProps {
  type: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Polyline (connected line segments, not closed)
 */
export interface PolylineProps extends BaseNodeProps {
  type: 'polyline';
  points: Array<{ x: number; y: number }>;
}

/**
 * Polygon (closed shape)
 */
export interface PolygonProps extends BaseNodeProps {
  type: 'polygon';
  points: Array<{ x: number; y: number }>;
}

/**
 * SVG-style path
 */
export interface PathProps extends BaseNodeProps {
  type: 'path';
  d: string;  // SVG path data
}

/**
 * Arc segment
 */
export interface ArcProps extends BaseNodeProps {
  type: 'arc';
  radius: number;
  startAngle: number;    // Radians
  endAngle: number;      // Radians
  counterClockwise?: boolean;
}

/**
 * Text node
 */
export interface TextProps extends BaseNodeProps {
  type: 'text';
  content: string;
  // Position is in transform.x, transform.y
}

/**
 * Group node (container for other nodes)
 */
export interface GroupProps extends BaseNodeProps {
  type: 'group';
  children: string[];    // Child node IDs
}

/**
 * Union of all node props
 */
export type NodeProps = 
  | RectProps
  | RoundedRectProps
  | CircleProps
  | EllipseProps
  | LineProps
  | PolylineProps
  | PolygonProps
  | PathProps
  | ArcProps
  | TextProps
  | GroupProps;

// ============================================================================
// SCENE
// ============================================================================

/**
 * Scene configuration
 */
export interface SceneConfig {
  width: number;
  height: number;
  fps: number;
  duration: number;      // Total duration in seconds
  background: Color;
}

/**
 * Complete IR program
 */
export interface IRProgram {
  version: string;
  scene: SceneConfig;
  nodes: NodeProps[];
  animations: AnimationKeyframe[];
}

// ============================================================================
// HELPER FACTORIES
// ============================================================================

export function createDefaultFill(): FillStyle {
  return {
    enabled: false,
    color: { r: 1, g: 1, b: 1, a: 1 },
  };
}

export function createDefaultStroke(): StrokeStyle {
  return {
    enabled: true,
    color: { r: 1, g: 1, b: 1, a: 1 },
    width: 2,
    lineCap: 'round',
    lineJoin: 'round',
  };
}

export function createDefaultGlow(): GlowStyle {
  return {
    enabled: false,
    color: { r: 1, g: 1, b: 1, a: 0.8 },
    blurPx: 10,
    spreadPx: 0,
    intensity: 1,
  };
}

export function createDefaultTextStyle(): TextStyle {
  return {
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: 24,
    fontWeight: 'normal',
    fontStyle: 'italic',
    textAlign: 'center',
    textBaseline: 'middle',
  };
}

export function createDefaultNodeStyle(): NodeStyle {
  return {
    opacity: 1,
    fill: createDefaultFill(),
    stroke: createDefaultStroke(),
    glow: createDefaultGlow(),
  };
}

/**
 * Deep clone a style object
 */
export function cloneStyle(style: NodeStyle): NodeStyle {
  return JSON.parse(JSON.stringify(style));
}

/**
 * Merge partial style into existing style
 */
export function mergeStyle(base: NodeStyle, partial: Partial<NodeStyle>): NodeStyle {
  const result = cloneStyle(base);
  
  if (partial.opacity !== undefined) result.opacity = partial.opacity;
  if (partial.fill) Object.assign(result.fill, partial.fill);
  if (partial.stroke) Object.assign(result.stroke, partial.stroke);
  if (partial.glow) Object.assign(result.glow, partial.glow);
  if (partial.text) {
    result.text = result.text ? { ...result.text, ...partial.text } : { ...createDefaultTextStyle(), ...partial.text };
  }
  
  return result;
}
