/**
 * Dependency Analyzer - Builds a Constant-Output dependency matrix
 * 
 * Uses perturbation analysis:
 * 1. Identify all DSL constants (entry point params)
 * 2. Identify all Runtime outputs (ALL values from ANY function, not just IR)
 * 3. Perturb each constant and see which outputs change
 * 4. Build a dependency map: Output -> Set<Constants that affect it>
 */

import type { YAMLSpec, Environment, Statement, FunctionDef, CallStatement, ForeachStatement } from './types';
import { resolve } from './resolver';
import { evaluate, isExpression } from './exprEngine';

// A constant is identified by its path in the entry args
export interface ConstantDef {
  path: string;       // e.g., "number", "limits.max_factors"
  originalValue: unknown;
  valueType: 'number' | 'string' | 'boolean' | 'other';
}

// An output is ANY value computed during execution
export interface OutputDef {
  // Where this output comes from
  source: 'ir' | 'let' | 'call-arg' | 'call-return' | 'foreach-iter';
  // For IR: the IR function name (e.g., "text.create")
  // For others: the context (function name + variable/param)
  context: string;
  // The specific field/variable name
  fieldName: string;
  // Unique path for this output: "source:context:callIndex:fieldName"
  path: string;
  // The computed value
  value: unknown;
}

// Dependency map: output path -> set of constant paths that affect it
export type DependencyMatrix = Map<string, Set<string>>;

// Result of analysis
export interface DependencyAnalysisResult {
  constants: ConstantDef[];
  outputs: OutputDef[];
  matrix: DependencyMatrix;
  // Map from output path to its value
  outputValues: Map<string, unknown>;
}

/**
 * Extract all constants from entry point args
 */
function extractConstants(args: Record<string, unknown>, basePath = ''): ConstantDef[] {
  const constants: ConstantDef[] = [];
  
  for (const [key, value] of Object.entries(args)) {
    const path = basePath ? `${basePath}.${key}` : key;
    
    if (value === null || value === undefined) continue;
    
    if (typeof value === 'number') {
      constants.push({ path, originalValue: value, valueType: 'number' });
    } else if (typeof value === 'string') {
      constants.push({ path, originalValue: value, valueType: 'string' });
    } else if (typeof value === 'boolean') {
      constants.push({ path, originalValue: value, valueType: 'boolean' });
    } else if (Array.isArray(value)) {
      // For arrays, add each element as a constant
      value.forEach((item, idx) => {
        const itemConstants = extractConstants({ [idx]: item }, path);
        constants.push(...itemConstants);
      });
    } else if (typeof value === 'object') {
      // Recursively extract from nested objects
      const nestedConstants = extractConstants(value as Record<string, unknown>, path);
      constants.push(...nestedConstants);
    }
  }
  
  return constants;
}

/**
 * Set a value at a path in an object (mutating)
 */
function setValueAtPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current: Record<string, unknown> = obj;
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    // Handle array indices (numeric keys)
    if (current[part] === undefined) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  
  current[parts[parts.length - 1]] = value;
}

/**
 * Generate a perturbed value for a constant
 */
function perturbValue(def: ConstantDef): unknown {
  switch (def.valueType) {
    case 'number': {
      const orig = def.originalValue as number;
      // Use a significant perturbation that's unlikely to be coincidentally equal
      return orig + 7.31415926; // Add an irrational-ish offset
    }
    case 'string':
      return `${def.originalValue}_PERTURBED`;
    case 'boolean':
      return !(def.originalValue as boolean);
    default:
      return def.originalValue;
  }
}

// Execution context for tracking outputs
interface ExecutionContext {
  outputs: OutputDef[];
  callCounts: Map<string, number>; // context -> count for unique paths
}

/**
 * Execute spec silently (no actual IR side effects) and collect ALL outputs
 */
function executeAndCollectOutputs(spec: YAMLSpec): OutputDef[] {
  const ctx: ExecutionContext = {
    outputs: [],
    callCounts: new Map(),
  };
  const globalEnv: Environment = new Map();
  
  const entry = spec.program.entry.call;
  const entryFn = spec.defs[entry.fn];
  
  if (!entryFn) return ctx.outputs;
  
  const resolvedArgs: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(entry.args)) {
    resolvedArgs[key] = resolveValue(val, globalEnv, spec);
  }
  
  // Record entry call args as outputs
  for (const [key, val] of Object.entries(resolvedArgs)) {
    addOutput(ctx, 'call-arg', `entry:${entry.fn}`, key, val);
  }
  
  executeFunction(entryFn, resolvedArgs, spec, globalEnv, ctx, `entry:${entry.fn}`);
  
  return ctx.outputs;
}

/**
 * Add an output to the context with a unique path
 * @param callIndex - optional explicit call index (for nested field additions)
 */
function addOutput(
  ctx: ExecutionContext,
  source: OutputDef['source'],
  context: string,
  fieldName: string,
  value: unknown,
  callIndex?: number
): void {
  // Get call index for uniqueness (only increment if not provided)
  let count: number;
  if (callIndex !== undefined) {
    count = callIndex;
  } else {
    const countKey = `${source}:${context}`;
    count = ctx.callCounts.get(countKey) || 0;
    ctx.callCounts.set(countKey, count + 1);
  }
  
  const path = `${source}:${context}:${count}:${fieldName}`;
  
  ctx.outputs.push({
    source,
    context,
    fieldName,
    path,
    value,
  });
  
  // If value is an object, also add nested fields (with same call index)
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value)) {
      addOutput(ctx, source, context, `${fieldName}.${k}`, v, count);
    }
  }
}

function executeFunction(
  fn: FunctionDef,
  args: Record<string, unknown>,
  spec: YAMLSpec,
  parentEnv: Environment,
  ctx: ExecutionContext,
  fnContext: string
): unknown {
  const env: Environment = new Map(parentEnv);
  
  for (const param of fn.params) {
    if (args[param] !== undefined) {
      env.set(param, args[param]);
    }
  }
  
  for (const stmt of fn.body) {
    const result = executeStatement(stmt, spec, env, ctx, fnContext);
    if (result !== undefined && 'return' in stmt) {
      // Record return value
      addOutput(ctx, 'call-return', fnContext, 'return', result);
      return result;
    }
  }
  
  return undefined;
}

function executeStatement(
  stmt: Statement,
  spec: YAMLSpec,
  env: Environment,
  ctx: ExecutionContext,
  fnContext: string
): unknown {
  if ('call' in stmt) return executeCall(stmt.call, spec, env, ctx, fnContext);
  if ('let' in stmt) return executeLet(stmt.let, spec, env, ctx, fnContext);
  if ('foreach' in stmt) return executeForeach(stmt.foreach, spec, env, ctx, fnContext);
  if ('return' in stmt) return resolveValue(stmt.return, env, spec);
  if ('ir' in stmt) return executeIR(stmt.ir, spec, env, ctx);
  return undefined;
}

function executeCall(
  call: CallStatement,
  spec: YAMLSpec,
  env: Environment,
  ctx: ExecutionContext,
  fnContext: string
): unknown {
  const fnDef = spec.defs[call.fn];
  
  // Resolve args and record them as outputs
  const resolvedArgs: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(call.args)) {
    resolvedArgs[key] = resolveValue(val, env, spec);
    // Record each resolved arg
    addOutput(ctx, 'call-arg', `${fnContext}:${call.fn}`, key, resolvedArgs[key]);
  }
  
  if (!fnDef) {
    // IR function or missing function
    if (call.fn.startsWith('board.') || call.fn.startsWith('text.') || call.fn.startsWith('shape.')) {
      return executeIR({ fn: call.fn, args: call.args }, spec, env, ctx);
    }
    return undefined;
  }
  
  const newContext = `${fnContext}:${call.fn}`;
  const result = executeFunction(fnDef, resolvedArgs, spec, env, ctx, newContext);
  
  if (call.out) {
    env.set(call.out, result);
    // Record the out assignment
    addOutput(ctx, 'call-return', newContext, call.out, result);
  }
  
  return result;
}

function executeLet(
  letStmt: Record<string, unknown>,
  spec: YAMLSpec,
  env: Environment,
  ctx: ExecutionContext,
  fnContext: string
): void {
  for (const [varName, value] of Object.entries(letStmt)) {
    const resolved = resolveValue(value, env, spec);
    env.set(varName, resolved);
    // Record let assignment as output
    addOutput(ctx, 'let', fnContext, varName, resolved);
  }
}

function executeForeach(
  foreach: ForeachStatement,
  spec: YAMLSpec,
  env: Environment,
  ctx: ExecutionContext,
  fnContext: string
): void {
  const rangeValue = resolveValue(foreach.range, env, spec);
  if (!Array.isArray(rangeValue)) return;
  
  for (let i = 0; i < rangeValue.length; i++) {
    const value = rangeValue[i];
    const loopEnv: Environment = new Map(env);
    loopEnv.set(foreach.var, value);
    
    // Record foreach iteration value
    addOutput(ctx, 'foreach-iter', `${fnContext}:foreach`, `${foreach.var}[${i}]`, value);
    
    const loopContext = `${fnContext}:foreach[${i}]`;
    for (const stmt of foreach.do) {
      executeStatement(stmt, spec, loopEnv, ctx, loopContext);
    }
  }
}

function executeIR(
  ir: { fn: string; args: Record<string, unknown> },
  spec: YAMLSpec,
  env: Environment,
  ctx: ExecutionContext
): void {
  // Resolve all args and record them as outputs
  for (const [argName, value] of Object.entries(ir.args)) {
    const resolved = resolveValue(value, env, spec);
    addOutput(ctx, 'ir', ir.fn, argName, resolved);
  }
}

function resolveValue(value: unknown, env: Environment, spec: YAMLSpec): unknown {
  if (value === null || value === undefined) return value;
  
  if (isExpression(value)) {
    const resolvedArgs: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value.args)) {
      resolvedArgs[key] = resolveValue(val, env, spec);
    }
    
    const exprEnv: Environment = new Map(env);
    exprEnv.set('$', spec);
    
    for (const [key, val] of Object.entries(resolvedArgs)) {
      exprEnv.set(key, val);
    }
    return evaluate(value.expr, resolvedArgs, exprEnv);
  }
  
  if (typeof value === 'string') return resolve(value, env, spec);
  if (Array.isArray(value)) return value.map(v => resolveValue(v, env, spec));
  
  if (typeof value === 'object') {
    const resolved: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      resolved[key] = resolveValue(val, env, spec);
    }
    return resolved;
  }
  
  return value;
}

/**
 * Deep clone an object
 */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Compare two values for equality
 */
function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  
  if (typeof a === 'number' && typeof b === 'number') {
    // Use tolerance for floating point
    return Math.abs(a - b) < 0.0001;
  }
  
  if (typeof a === 'string' || typeof b === 'boolean') {
    return a === b;
  }
  
  // For objects/arrays, use JSON comparison
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Main analysis function - build the constant-output dependency matrix
 */
export function analyzeDependencies(spec: YAMLSpec): DependencyAnalysisResult {
  // 1. Extract DSL constants from spec.params (user-editable constants)
  // NOTE: We intentionally use the same path format as the TreeView params editor (e.g. "number", "layout.title.y").
  const constants = extractConstants(spec.params as unknown as Record<string, unknown>);
  
  // 2. Run baseline execution to get all outputs
  const baselineOutputs = executeAndCollectOutputs(spec);
  
  // Build output value map from baseline
  const outputValues = new Map<string, unknown>();
  for (const output of baselineOutputs) {
    outputValues.set(output.path, output.value);
  }
  
  // 3. Initialize dependency matrix
  const matrix: DependencyMatrix = new Map();
  for (const output of baselineOutputs) {
    matrix.set(output.path, new Set());
  }
  
  // 4. Perturb each constant and see which outputs change
  for (const constant of constants) {
    // Skip non-perturbable types
    if (constant.valueType === 'other') continue;
    
    // Create perturbed spec
    const perturbedSpec = deepClone(spec);
    const perturbedParams = perturbedSpec.params as unknown as Record<string, unknown>;
    const perturbedValue = perturbValue(constant);
    setValueAtPath(perturbedParams, constant.path, perturbedValue);
    
    // Run perturbed execution
    try {
      const perturbedOutputs = executeAndCollectOutputs(perturbedSpec);
      
      // Compare each output to baseline
      for (const perturbedOutput of perturbedOutputs) {
        const baselineValue = outputValues.get(perturbedOutput.path);
        
        if (!valuesEqual(baselineValue, perturbedOutput.value)) {
          // This output depends on this constant
          const deps = matrix.get(perturbedOutput.path);
          if (deps) {
            deps.add(constant.path);
          }
        }
      }
    } catch {
      // If perturbed execution fails, mark all outputs as depending on this constant
      // (the constant might be critical for execution)
      for (const [, deps] of matrix) {
        deps.add(constant.path);
      }
    }
  }
  
  return {
    constants,
    outputs: baselineOutputs,
    matrix,
    outputValues,
  };
}

/**
 * Get the constants that affect a specific output
 */
export function getConstantsForOutput(
  result: DependencyAnalysisResult,
  outputPath: string
): ConstantDef[] {
  const constantPaths = result.matrix.get(outputPath);
  if (!constantPaths) return [];
  
  return result.constants.filter(c => constantPaths.has(c.path));
}

/**
 * Find matching output by various criteria
 * Returns the matching output or null
 */
export function findMatchingOutput(
  result: DependencyAnalysisResult,
  criteria: {
    source?: OutputDef['source'];
    context?: string;     // Partial match
    fieldName?: string;   // Exact or partial match
    value?: unknown;      // Value match
  }
): OutputDef | null {
  for (const output of result.outputs) {
    // Check source
    if (criteria.source && output.source !== criteria.source) continue;
    
    // Check context (partial match)
    if (criteria.context && !output.context.includes(criteria.context)) continue;
    
    // Check field name
    if (criteria.fieldName) {
      if (output.fieldName !== criteria.fieldName && !output.fieldName.endsWith(`.${criteria.fieldName}`)) {
        continue;
      }
    }
    
    // Check value
    if (criteria.value !== undefined && !valuesEqual(output.value, criteria.value)) continue;
    
    return output;
  }
  
  return null;
}

/**
 * Find output path for a Runtime step's value
 * This maps runtime panel values back to the dependency matrix
 */
export function findOutputPathForRuntimeValue(
  result: DependencyAnalysisResult,
  stepType: 'ir' | 'let' | 'call' | 'foreach' | 'return',
  functionName: string | undefined,
  fieldName: string,
  value: unknown
): string | null {
  // Map step type to output source
  let sources: OutputDef['source'][];
  switch (stepType) {
    case 'ir':
      sources = ['ir'];
      break;
    case 'let':
      sources = ['let'];
      break;
    case 'call':
      sources = ['call-arg', 'call-return'];
      break;
    case 'foreach':
      sources = ['foreach-iter'];
      break;
    case 'return':
      sources = ['call-return'];
      break;
    default:
      sources = [];
  }
  
  // First pass: exact match on source, context, field, and value
  for (const output of result.outputs) {
    if (!sources.includes(output.source)) continue;
    
    // For IR, match function name exactly
    if (stepType === 'ir' && functionName && output.context !== functionName) continue;
    
    // Match field name exactly or as nested field
    const fieldMatches = output.fieldName === fieldName || 
                         output.fieldName.startsWith(`${fieldName}.`) ||
                         output.fieldName.endsWith(`.${fieldName}`) ||
                         fieldName.startsWith(`${output.fieldName}.`);
    if (!fieldMatches) continue;
    
    // Match value
    if (valuesEqual(output.value, value)) {
      return output.path;
    }
  }
  
  // Second pass: match by source and field, value check with nested objects
  for (const output of result.outputs) {
    if (!sources.includes(output.source)) continue;
    if (stepType === 'ir' && functionName && output.context !== functionName) continue;
    
    // Match field name
    const fieldMatches = output.fieldName === fieldName || 
                         output.fieldName.startsWith(`${fieldName}.`) ||
                         output.fieldName.endsWith(`.${fieldName}`);
    if (!fieldMatches) continue;
    
    // For object values, check if the clicked value is nested within
    if (typeof output.value === 'object' && output.value !== null && typeof value !== 'object') {
      // Check if value exists somewhere in the output object
      const checkValue = (obj: unknown): boolean => {
        if (valuesEqual(obj, value)) return true;
        if (typeof obj === 'object' && obj !== null) {
          for (const v of Object.values(obj)) {
            if (checkValue(v)) return true;
          }
        }
        return false;
      };
      if (checkValue(output.value)) {
        return output.path;
      }
    }
    
    if (valuesEqual(output.value, value)) {
      return output.path;
    }
  }
  
  // Third pass: just match by source and field (first match)
  for (const output of result.outputs) {
    if (!sources.includes(output.source)) continue;
    if (stepType === 'ir' && functionName && output.context !== functionName) continue;
    if (output.fieldName === fieldName || output.fieldName.endsWith(`.${fieldName}`)) {
      return output.path;
    }
  }
  
  return null;
}

/**
 * Find ALL outputs that match the given value (for debugging)
 */
export function findAllMatchingOutputs(
  result: DependencyAnalysisResult,
  value: unknown
): OutputDef[] {
  return result.outputs.filter(output => valuesEqual(output.value, value));
}
