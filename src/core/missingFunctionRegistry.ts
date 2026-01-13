/**
 * Global registry for missing function callbacks.
 * This allows the expression engine and DSL executor to report missing functions
 * without direct React dependencies.
 */

export type MissingFunctionType = 'expression' | 'ir' | 'dsl';

export interface MissingFunctionCallback {
  (name: string, type: MissingFunctionType, calledFrom?: string): void;
}

let missingFunctionCallback: MissingFunctionCallback | null = null;
let activityLogCallback: ((level: string, source: string, message: string) => void) | null = null;

export function setMissingFunctionCallback(callback: MissingFunctionCallback | null): void {
  missingFunctionCallback = callback;
}

export function setActivityLogCallback(callback: ((level: string, source: string, message: string) => void) | null): void {
  activityLogCallback = callback;
}

export function reportMissingFunction(name: string, type: MissingFunctionType, calledFrom?: string): void {
  if (missingFunctionCallback) {
    missingFunctionCallback(name, type, calledFrom);
  }
  if (activityLogCallback) {
    const typeLabel = type === 'expression' ? 'ExpressionFunction' : type === 'ir' ? 'IRFunction' : 'DSLFunction';
    activityLogCallback('warning', 'MissingFn', `Missing ${typeLabel}: ${name}${calledFrom ? ` (called from ${calledFrom})` : ''}`);
  }
}

// Track which functions have been reported to avoid spam
const reportedFunctions = new Set<string>();

export function reportMissingFunctionOnce(name: string, type: MissingFunctionType, calledFrom?: string): void {
  const key = `${type}:${name}`;
  if (reportedFunctions.has(key)) return;
  reportedFunctions.add(key);
  reportMissingFunction(name, type, calledFrom);
}

export function clearReportedFunctions(): void {
  reportedFunctions.clear();
}
