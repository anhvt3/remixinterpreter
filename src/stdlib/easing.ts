export type EasingFunction = (t: number) => number;

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInCubic(t: number): number {
  return t * t * t;
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function linear(t: number): number {
  return t;
}

export function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

export function easeInQuad(t: number): number {
  return t * t;
}

const easingFunctions: Record<string, EasingFunction> = {
  linear,
  easeOutCubic,
  easeInCubic,
  easeInOutCubic,
  easeOutQuad,
  easeInQuad,
};

export function getEasingFunction(name: string): EasingFunction {
  const fn = easingFunctions[name];
  if (!fn) {
    console.warn(`Unknown easing function: ${name}. Falling back to linear.`);
    return linear;
  }
  return fn;
}

export function isValidEasing(name: string): boolean {
  return name in easingFunctions;
}

/**
 * Calculate eased progress for a time value
 * @param t Current time
 * @param t0 Start time
 * @param t1 End time
 * @param easingName Name of easing function
 * @returns Progress from 0 to 1 (clamped)
 */
export function calculateProgress(
  t: number,
  t0: number,
  t1: number,
  easingName: string
): number {
  if (t <= t0) return 0;
  if (t >= t1) return 1;
  
  const linearProgress = (t - t0) / (t1 - t0);
  const easingFn = getEasingFunction(easingName);
  return easingFn(linearProgress);
}
