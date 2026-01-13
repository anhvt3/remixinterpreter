/**
 * Easing Functions for Animation
 * 
 * All functions take t in [0, 1] and return value in [0, 1]
 * Default for "instructional" animations: easeInOutCubic (smooth, no bounce)
 */

import type { EasingType } from './types';

/**
 * Linear interpolation (no easing)
 */
export function linear(t: number): number {
  return t;
}

/**
 * Cubic ease-in: slow start, fast end
 */
export function easeInCubic(t: number): number {
  return t * t * t;
}

/**
 * Cubic ease-out: fast start, slow end
 */
export function easeOutCubic(t: number): number {
  const t1 = t - 1;
  return t1 * t1 * t1 + 1;
}

/**
 * Cubic ease-in-out: slow start and end, fast middle
 * This is the default for instructional/educational animations
 */
export function easeInOutCubic(t: number): number {
  if (t < 0.5) {
    return 4 * t * t * t;
  } else {
    const t1 = 2 * t - 2;
    return 0.5 * t1 * t1 * t1 + 1;
  }
}

/**
 * Quadratic ease-out (gentler than cubic)
 */
export function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/**
 * Quadratic ease-in-out
 */
export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Get easing function by name
 */
export function getEasingFunction(type: EasingType): (t: number) => number {
  switch (type) {
    case 'linear': return linear;
    case 'easeInCubic': return easeInCubic;
    case 'easeOutCubic': return easeOutCubic;
    case 'easeInOutCubic': return easeInOutCubic;
    default: return easeInOutCubic; // Default to smooth instructional easing
  }
}

/**
 * Apply easing to interpolate between two values
 */
export function easedLerp(
  from: number,
  to: number,
  t: number,
  easing: EasingType = 'easeInOutCubic'
): number {
  const easedT = getEasingFunction(easing)(t);
  return from + (to - from) * easedT;
}

/**
 * Calculate progress t for a given time within a span
 * Returns 0 before t0, 1 after t1, interpolated value in between
 */
export function getProgress(time: number, t0: number, t1: number): number {
  if (time <= t0) return 0;
  if (time >= t1) return 1;
  return (time - t0) / (t1 - t0);
}
