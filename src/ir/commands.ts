/**
 * IR Commands - Pure functions that return command objects
 */

import type {
  NodeProps,
  SceneConfig,
  AnimationKeyframe,
  EasingType,
  NodeStyle,
  Transform,
} from './types';
import { createDefaultTransform, createDefaultNodeStyle } from './types';
import { theme } from './theme';

let idCounter = 0;
export const generateId = (prefix: string = 'node') => `${prefix}_${++idCounter}`;

// ============================================================================
// SCENE COMMANDS
// ============================================================================

export function sceneInit(config: Partial<SceneConfig>): SceneConfig {
  return {
    width: config.width ?? 800,
    height: config.height ?? 600,
    fps: config.fps ?? 60,
    duration: config.duration ?? 10,
    background: config.background ?? theme.background,
  };
}

// ============================================================================
// NODE COMMANDS
// ============================================================================

export function nodeCreate<T extends NodeProps['type']>(
  type: T,
  id: string,
  props: Partial<NodeProps>,
  style?: Partial<NodeStyle>,
  parentId?: string,
  zIndex: number = 0
): NodeProps {
  const baseNode = {
    id,
    type,
    parentId,
    zIndex,
    visible: true,
    transform: props.transform ?? createDefaultTransform(),
    style: { ...createDefaultNodeStyle(), ...style },
  };
  
  return { ...baseNode, ...props } as NodeProps;
}

export function nodeUpdate(id: string, props: Partial<NodeProps>, style?: Partial<NodeStyle>) {
  return { id, props, style };
}

// ============================================================================
// ANIMATION COMMANDS
// ============================================================================

export function animTo(
  nodeId: string,
  propertyPath: string,
  timing: { t0: number; t1: number; ease?: EasingType },
  fromValue: unknown,
  toValue: unknown
): AnimationKeyframe {
  return {
    id: generateId('anim'),
    nodeId,
    propertyPath,
    t0: timing.t0,
    t1: timing.t1,
    easing: timing.ease ?? 'easeInOutCubic',
    fromValue,
    toValue,
  };
}

export function animSet(nodeId: string, propertyPath: string, value: unknown, atTime: number): AnimationKeyframe {
  return animTo(nodeId, propertyPath, { t0: atTime, t1: atTime + 0.001 }, value, value);
}

// ============================================================================
// EFFECT COMMANDS
// ============================================================================

export function effectFadeIn(nodeId: string, t0: number, duration: number = 0.5): AnimationKeyframe {
  return animTo(nodeId, 'style.opacity', { t0, t1: t0 + duration, ease: 'easeOutCubic' }, 0, 1);
}

export function effectFadeOut(nodeId: string, t0: number, duration: number = 0.5): AnimationKeyframe {
  return animTo(nodeId, 'style.opacity', { t0, t1: t0 + duration, ease: 'easeInCubic' }, 1, 0);
}

export function effectFlash(
  nodeId: string,
  timing: { t0: number; t1: number; peakOpacity?: number; glowBoost?: number }
): AnimationKeyframe[] {
  const mid = (timing.t0 + timing.t1) / 2;
  const peak = timing.peakOpacity ?? 1.2;
  return [
    animTo(nodeId, 'style.glow.intensity', { t0: timing.t0, t1: mid }, 1, timing.glowBoost ?? 2),
    animTo(nodeId, 'style.glow.intensity', { t0: mid, t1: timing.t1 }, timing.glowBoost ?? 2, 1),
  ];
}

// ============================================================================
// HELPER: Create shapes with themed styles
// ============================================================================

export function createRect(
  id: string,
  x: number, y: number, width: number, height: number,
  style?: Partial<NodeStyle>,
  zIndex: number = 0
): NodeProps {
  return nodeCreate('rect', id, {
    width, height,
    transform: { ...createDefaultTransform(), x, y },
  }, style, undefined, zIndex) as NodeProps;
}

export function createPolygon(
  id: string,
  points: Array<{ x: number; y: number }>,
  style?: Partial<NodeStyle>,
  zIndex: number = 0
): NodeProps {
  return nodeCreate('polygon', id, { points }, style, undefined, zIndex) as NodeProps;
}

export function createText(
  id: string,
  content: string,
  x: number, y: number,
  style?: Partial<NodeStyle>,
  zIndex: number = 0
): NodeProps {
  return nodeCreate('text', id, {
    content,
    transform: { ...createDefaultTransform(), x, y },
  }, style, undefined, zIndex) as NodeProps;
}
