import type { TimelineEvent, TextCreateEvent, TextUpdateEvent, StyleDef, LayoutPosition } from '../core/types';
import { calculateProgress } from '../stdlib/easing';
import katex from 'katex';

export interface SceneElement {
  id: string;
  type: 'text';
  mode: 'text' | 'math';
  content: string;
  at: LayoutPosition;
  style: StyleDef;
  opacity: number;
  visible: boolean;
  
  // For transitions
  previousContent?: string;
  transitionProgress?: number;
}

export interface Scene {
  elements: Map<string, SceneElement>;
  boardConfig?: {
    viewbox: number[];
    theme: { bg: string };
  };
}

/**
 * Compute scene state at a given time t
 * @param staticElementIds - Elements to render at their final state (t1) regardless of current time
 */
export function computeScene(
  events: TimelineEvent[], 
  t: number,
  staticElementIds: string[] = []
): Scene {
  const scene: Scene = {
    elements: new Map(),
  };
  
  // Build a map of element t1 times for static rendering
  const elementT1Map = new Map<string, number>();
  for (const event of events) {
    if (event.type === 'text.create' || event.type === 'text.update') {
      const args = event.args as { id?: string; t1?: number };
      if (args.id && typeof args.t1 === 'number') {
        const existing = elementT1Map.get(args.id) || 0;
        elementT1Map.set(args.id, Math.max(existing, args.t1));
      }
    }
  }
  
  // Process events in order
  for (const event of events) {
    if (event.type === 'board.init') {
      scene.boardConfig = {
        viewbox: event.args.viewbox as number[],
        theme: event.args.theme as { bg: string },
      };
    }
    
    if (event.type === 'text.create') {
      const args = event.args as { id?: string };
      const elementId = args.id;
      // Use t1 time for static elements so they appear fully visible
      const effectiveTime = elementId && staticElementIds.includes(elementId)
        ? (elementT1Map.get(elementId) || t) + 0.1
        : t;
      processTextCreate(scene, event, effectiveTime);
    }
    
    if (event.type === 'text.update') {
      const args = event.args as { id?: string };
      const elementId = args.id;
      const effectiveTime = elementId && staticElementIds.includes(elementId)
        ? (elementT1Map.get(elementId) || t) + 0.1
        : t;
      processTextUpdate(scene, event, effectiveTime);
    }
  }
  
  return scene;
}

function processTextCreate(scene: Scene, event: TimelineEvent, t: number): void {
  const args = event.args as Record<string, unknown>;
  const id = args.id as string;
  const text = args.text;
  // Force math mode for known math elements (prompt, factline, etc.)
  const mathIds = ['prompt', 'factline'];
  const mode: 'text' | 'math' = args.mode === 'math' || mathIds.includes(id) ? 'math' : 'text';
  const style = args.style as StyleDef;
  const ease = (args.ease as string) || 'easeOutCubic';
  
  // Parse time values - ensure they're numbers
  const t0 = typeof args.t0 === 'number' ? args.t0 : parseFloat(String(args.t0)) || 0;
  const t1 = typeof args.t1 === 'number' ? args.t1 : parseFloat(String(args.t1)) || 0;
  
  // Parse position - handle both object and unresolved string
  let at: LayoutPosition;
  if (args.at && typeof args.at === 'object') {
    const rawAt = args.at as Record<string, unknown>;
    at = {
      anchor: String(rawAt.anchor || 'Center'),
      x: typeof rawAt.x === 'number' ? rawAt.x : parseFloat(String(rawAt.x)) || 0,
      y: typeof rawAt.y === 'number' ? rawAt.y : parseFloat(String(rawAt.y)) || 0,
    };
  } else {
    // Fallback if at wasn't resolved
    console.warn(`text.create ${id}: 'at' was not resolved:`, args.at);
    at = { anchor: 'Center', x: 0, y: 0 };
  }
  
  // Element not yet visible (use <= to show at exactly t0)
  if (t < t0) {
    return;
  }
  
  // Calculate opacity based on progress (ensure minimum visibility when at t0)
  const progress = calculateProgress(t, t0, t1, ease);
  const opacity = Math.max(0.01, progress); // Ensure at least a tiny bit visible for debugging
  
  const element: SceneElement = {
    id,
    type: 'text',
    mode,
    content: String(text),
    at,
    style,
    opacity,
    visible: true,
  };
  
  scene.elements.set(id, element);
}

function processTextUpdate(scene: Scene, event: TimelineEvent, t: number): void {
  const args = event.args as Record<string, unknown>;
  const id = args.id as string;
  const toText = args.toText;
  const mode = (args.mode as 'text' | 'math') || 'text';
  const style = args.style as StyleDef;
  const ease = (args.ease as string) || 'easeOutCubic';
  const transition = args.transition as string;
  
  // Parse time values
  const t0 = typeof args.t0 === 'number' ? args.t0 : parseFloat(String(args.t0)) || 0;
  const t1 = typeof args.t1 === 'number' ? args.t1 : parseFloat(String(args.t1)) || 0;
  
  // Parse position
  let at: LayoutPosition;
  if (args.at && typeof args.at === 'object') {
    const rawAt = args.at as Record<string, unknown>;
    at = {
      anchor: String(rawAt.anchor || 'Center'),
      x: typeof rawAt.x === 'number' ? rawAt.x : parseFloat(String(rawAt.x)) || 0,
      y: typeof rawAt.y === 'number' ? rawAt.y : parseFloat(String(rawAt.y)) || 0,
    };
  } else {
    at = { anchor: 'Center', x: 0, y: 0 };
  }
  
  // Update hasn't started yet
  if (t < t0) {
    return;
  }
  
  const existing = scene.elements.get(id);
  
  if (!existing) {
    const progress = calculateProgress(t, t0, t1, ease);
    scene.elements.set(id, {
      id,
      type: 'text',
      mode,
      content: String(toText),
      at,
      style,
      opacity: progress,
      visible: true,
    });
    return;
  }
  
  if (transition === 'crossFade') {
    const progress = calculateProgress(t, t0, t1, ease);
    
    if (progress >= 1) {
      existing.content = String(toText);
      existing.style = style;
      existing.previousContent = undefined;
      existing.transitionProgress = undefined;
    } else {
      existing.previousContent = existing.content;
      existing.content = String(toText);
      existing.style = style;
      existing.transitionProgress = progress;
    }
  } else {
    if (t >= t1) {
      existing.content = String(toText);
      existing.style = style;
    }
  }
}

/**
 * Render math content using KaTeX
 */
export function renderMath(latex: string): string {
  console.log('renderMath input:', JSON.stringify(latex), 'length:', latex.length);
  try {
    const result = katex.renderToString(latex, {
      throwOnError: false,
      displayMode: false,
    });
    console.log('renderMath output length:', result.length, 'first 100 chars:', result.substring(0, 100));
    return result;
  } catch (e) {
    console.error('KaTeX error:', e, 'for latex:', latex);
    return `<span style="color:red">${latex}</span>`;
  }
}

/**
 * Convert board coordinates to pixel coordinates
 */
export function boardToPixel(
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
