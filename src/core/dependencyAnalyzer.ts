/**
 * Dependency Analyzer - Builds a Constant-Output dependency matrix
 * 
 * Uses perturbation analysis:
 * 1. Identify all constants (entry point params)
 * 2. Identify all outputs (values passed to IR functions)
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

// An output is a value passed to an IR function
export interface OutputDef {
  irFn: string;       // e.g., "text.create", "board.init"
  argName: string;    // e.g., "y", "content"
  path: string;       // Full path: "text.create:0:y" (fn:callIndex:arg)
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

/**
 * Execute spec silently (no IR calls) and collect outputs
 */
function executeAndCollectOutputs(spec: YAMLSpec): OutputDef[] {
  const outputs: OutputDef[] = [];
  const globalEnv: Environment = new Map();
  const irCallCounts = new Map<string, number>();
  
  const entry = spec.program.entry.call;
  const entryFn = spec.defs[entry.fn];
  
  if (!entryFn) return outputs;
  
  const resolvedArgs: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(entry.args)) {
    resolvedArgs[key] = resolveValue(val, globalEnv, spec);
  }
  
  executeFunction(entryFn, resolvedArgs, spec, globalEnv, outputs, irCallCounts);
  
  return outputs;
}

function executeFunction(
  fn: FunctionDef,
  args: Record<string, unknown>,
  spec: YAMLSpec,
  parentEnv: Environment,
  outputs: OutputDef[],
  irCallCounts: Map<string, number>
): unknown {
  const env: Environment = new Map(parentEnv);
  
  for (const param of fn.params) {
    if (args[param] !== undefined) {
      env.set(param, args[param]);
    }
  }
  
  for (const stmt of fn.body) {
    const result = executeStatement(stmt, spec, env, outputs, irCallCounts);
    if (result !== undefined && 'return' in stmt) {
      return result;
    }
  }
  
  return undefined;
}

function executeStatement(
  stmt: Statement,
  spec: YAMLSpec,
  env: Environment,
  outputs: OutputDef[],
  irCallCounts: Map<string, number>
): unknown {
  if ('call' in stmt) return executeCall(stmt.call, spec, env, outputs, irCallCounts);
  if ('let' in stmt) return executeLet(stmt.let, spec, env);
  if ('foreach' in stmt) return executeForeach(stmt.foreach, spec, env, outputs, irCallCounts);
  if ('return' in stmt) return resolveValue(stmt.return, env, spec);
  if ('ir' in stmt) return executeIR(stmt.ir, spec, env, outputs, irCallCounts);
  return undefined;
}

function executeCall(
  call: CallStatement,
  spec: YAMLSpec,
  env: Environment,
  outputs: OutputDef[],
  irCallCounts: Map<string, number>
): unknown {
  const fnDef = spec.defs[call.fn];
  
  if (!fnDef) {
    // IR function or missing function - treat as IR
    if (call.fn.startsWith('board.') || call.fn.startsWith('text.') || call.fn.startsWith('shape.')) {
      return executeIR({ fn: call.fn, args: call.args }, spec, env, outputs, irCallCounts);
    }
    return undefined;
  }
  
  const resolvedArgs: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(call.args)) {
    resolvedArgs[key] = resolveValue(val, env, spec);
  }
  
  const result = executeFunction(fnDef, resolvedArgs, spec, env, outputs, irCallCounts);
  if (call.out) env.set(call.out, result);
  return result;
}

function executeLet(
  letStmt: Record<string, unknown>,
  spec: YAMLSpec,
  env: Environment
): void {
  for (const [varName, value] of Object.entries(letStmt)) {
    const resolved = resolveValue(value, env, spec);
    env.set(varName, resolved);
  }
}

function executeForeach(
  foreach: ForeachStatement,
  spec: YAMLSpec,
  env: Environment,
  outputs: OutputDef[],
  irCallCounts: Map<string, number>
): void {
  const rangeValue = resolveValue(foreach.range, env, spec);
  if (!Array.isArray(rangeValue)) return;
  
  for (let i = 0; i < rangeValue.length; i++) {
    const value = rangeValue[i];
    const loopEnv: Environment = new Map(env);
    loopEnv.set(foreach.var, value);
    
    for (const stmt of foreach.do) {
      executeStatement(stmt, spec, loopEnv, outputs, irCallCounts);
    }
  }
}

function executeIR(
  ir: { fn: string; args: Record<string, unknown> },
  spec: YAMLSpec,
  env: Environment,
  outputs: OutputDef[],
  irCallCounts: Map<string, number>
): void {
  // Get call index for this IR function
  const count = irCallCounts.get(ir.fn) || 0;
  irCallCounts.set(ir.fn, count + 1);
  
  // Resolve all args and record them as outputs
  for (const [argName, value] of Object.entries(ir.args)) {
    const resolved = resolveValue(value, env, spec);
    const outputPath = `${ir.fn}:${count}:${argName}`;
    
    outputs.push({
      irFn: ir.fn,
      argName,
      path: outputPath,
      value: resolved,
    });
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
  // 1. Extract constants from entry point args
  const entryArgs = spec.program.entry.call.args;
  const constants = extractConstants(entryArgs as Record<string, unknown>);
  
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
    const perturbedArgs = perturbedSpec.program.entry.call.args as Record<string, unknown>;
    const perturbedValue = perturbValue(constant);
    setValueAtPath(perturbedArgs, constant.path, perturbedValue);
    
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
      for (const [outputPath, deps] of matrix) {
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
 * Find the output path that matches a runtime IR step's resolved arg
 * Returns the output path or null if not found
 */
export function findOutputPath(
  result: DependencyAnalysisResult,
  irFn: string,
  argName: string,
  argValue: unknown
): string | null {
  // Find matching output by IR function, arg name, and value
  for (const output of result.outputs) {
    if (output.irFn === irFn && output.argName === argName) {
      if (valuesEqual(output.value, argValue)) {
        return output.path;
      }
    }
  }
  
  // If exact match not found, find by just fn and argName (first match)
  for (const output of result.outputs) {
    if (output.irFn === irFn && output.argName === argName) {
      return output.path;
    }
  }
  
  return null;
}
