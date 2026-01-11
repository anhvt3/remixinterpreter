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
 */
export function computeScene(events: TimelineEvent[], t: number): Scene {
  const scene: Scene = {
    elements: new Map(),
  };
  
  // Process events in order
  for (const event of events) {
    if (event.type === 'board.init') {
      scene.boardConfig = {
        viewbox: event.args.viewbox as number[],
        theme: event.args.theme as { bg: string },
      };
    }
    
    if (event.type === 'text.create') {
      processTextCreate(scene, event as TextCreateEvent, t);
    }
    
    if (event.type === 'text.update') {
      processTextUpdate(scene, event as TextUpdateEvent, t);
    }
  }
  
  return scene;
}

function processTextCreate(scene: Scene, event: TextCreateEvent, t: number): void {
  const { id, text, mode, at, style, t0, t1, ease } = event.args;
  
  // Element not yet visible
  if (t < t0) {
    return;
  }
  
  // Calculate opacity based on progress
  const progress = calculateProgress(t, t0, t1, ease);
  
  const element: SceneElement = {
    id,
    type: 'text',
    mode,
    content: String(text),
    at,
    style,
    opacity: progress,
    visible: true,
  };
  
  scene.elements.set(id, element);
}

function processTextUpdate(scene: Scene, event: TextUpdateEvent, t: number): void {
  const { id, toText, mode, at, style, t0, t1, ease, transition } = event.args;
  
  // Update hasn't started yet
  if (t < t0) {
    return;
  }
  
  const existing = scene.elements.get(id);
  
  if (!existing) {
    // Create new element if doesn't exist
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
  
  // Handle crossFade transition
  if (transition === 'crossFade') {
    const progress = calculateProgress(t, t0, t1, ease);
    
    if (progress >= 1) {
      // Transition complete - show new content
      existing.content = String(toText);
      existing.style = style;
      existing.previousContent = undefined;
      existing.transitionProgress = undefined;
    } else {
      // During transition
      existing.previousContent = existing.content;
      existing.content = String(toText);
      existing.style = style;
      existing.transitionProgress = progress;
    }
  } else {
    // Instant update after t1
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
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode: false,
    });
  } catch (e) {
    console.error('KaTeX error:', e);
    return latex;
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
