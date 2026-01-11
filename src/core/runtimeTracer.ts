import type { 
  YAMLSpec, 
  Environment, 
  Statement, 
  TimelineEvent,
  FunctionDef,
  CallStatement,
  ForeachStatement
} from './types';
import { resolve } from './resolver';
import { evaluate, isExpression } from './exprEngine';
import type { RuntimeStep } from '../ui/RuntimePanel';
import { 
  type ProvenanceMap, 
  type CreatorMap, 
  type AnimatorMap, 
  type ElementProvenance,
  makeStatementKey 
} from './provenanceTracker';

export interface TracedExecutionResult {
  timeline: TimelineEvent[];
  returnValue: unknown;
  steps: RuntimeStep[];
  provenance: ProvenanceMap;
  creatorMap: CreatorMap;
  animatorMap: AnimatorMap;
}

// Execution context passed through the call stack
interface ExecutionContext {
  currentFn: string;
  currentStmtIndex: number;
}

let eventCounter = 0;
let stepCounter = 0;

export function executeWithTrace(spec: YAMLSpec): TracedExecutionResult {
  eventCounter = 0;
  stepCounter = 0;
  const timeline: TimelineEvent[] = [];
  const steps: RuntimeStep[] = [];
  const globalEnv: Environment = new Map();
  const provenance: ProvenanceMap = new Map();
  const creatorMap: CreatorMap = new Map();
  const animatorMap: AnimatorMap = new Map();
  
  const entry = spec.program.entry.call;
  const entryFn = spec.defs[entry.fn];
  
  if (!entryFn) {
    throw new Error(`Entry function "${entry.fn}" not found`);
  }
  
  const resolvedArgs: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(entry.args)) {
    resolvedArgs[key] = resolveValue(val, globalEnv, spec);
  }
  
  const ctx: ExecutionContext = { currentFn: entry.fn, currentStmtIndex: 0 };
  const result = executeFunctionTraced(entryFn, entry.fn, resolvedArgs, spec, timeline, steps, globalEnv, 0, provenance, creatorMap, animatorMap, ctx);
  
  return { timeline, returnValue: result, steps, provenance, creatorMap, animatorMap };
}

function executeFunctionTraced(
  fn: FunctionDef,
  fnName: string,
  args: Record<string, unknown>,
  spec: YAMLSpec,
  timeline: TimelineEvent[],
  steps: RuntimeStep[],
  parentEnv: Environment,
  depth: number,
  provenance: ProvenanceMap,
  creatorMap: CreatorMap,
  animatorMap: AnimatorMap,
  ctx: ExecutionContext
): unknown {
  const env: Environment = new Map(parentEnv);
  
  // Create step for this function call
  const fnStep: RuntimeStep = {
    id: `step_${stepCounter++}`,
    type: 'call',
    functionName: fnName,
    args: { ...args },
    resolvedArgs: { ...args },
    depth,
    children: [],
  };
  steps.push(fnStep);
  
  for (const param of fn.params) {
    if (args[param] !== undefined) {
      env.set(param, args[param]);
    }
  }
  
  for (let stmtIndex = 0; stmtIndex < fn.body.length; stmtIndex++) {
    const stmt = fn.body[stmtIndex];
    const stmtCtx: ExecutionContext = { currentFn: fnName, currentStmtIndex: stmtIndex };
    const result = executeStatementTraced(stmt, spec, timeline, fnStep.children!, env, depth + 1, provenance, creatorMap, animatorMap, stmtCtx);
    if (result !== undefined && 'return' in stmt) {
      return result;
    }
  }
  
  return undefined;
}

function executeStatementTraced(
  stmt: Statement,
  spec: YAMLSpec,
  timeline: TimelineEvent[],
  steps: RuntimeStep[],
  env: Environment,
  depth: number,
  provenance: ProvenanceMap,
  creatorMap: CreatorMap,
  animatorMap: AnimatorMap,
  ctx: ExecutionContext
): unknown {
  if ('call' in stmt) return executeCallTraced(stmt.call, spec, timeline, steps, env, depth, provenance, creatorMap, animatorMap, ctx);
  if ('let' in stmt) return executeLetTraced(stmt.let, spec, steps, env, depth);
  if ('foreach' in stmt) return executeForeachTraced(stmt.foreach, spec, timeline, steps, env, depth, provenance, creatorMap, animatorMap, ctx);
  if ('return' in stmt) {
    const value = resolveValue(stmt.return, env, spec);
    steps.push({
      id: `step_${stepCounter++}`,
      type: 'return',
      returnValue: value,
      depth,
    });
    return value;
  }
  if ('ir' in stmt) return executeIRTraced(stmt.ir, spec, timeline, steps, env, depth, provenance, creatorMap, animatorMap, ctx);
  return undefined;
}

function executeCallTraced(
  call: CallStatement, 
  spec: YAMLSpec, 
  timeline: TimelineEvent[], 
  steps: RuntimeStep[],
  env: Environment,
  depth: number,
  provenance: ProvenanceMap,
  creatorMap: CreatorMap,
  animatorMap: AnimatorMap,
  ctx: ExecutionContext
): unknown {
  const fnDef = spec.defs[call.fn];
  
  if (!fnDef) {
    if (call.fn.startsWith('board.') || call.fn.startsWith('text.')) {
      return executeIRTraced({ fn: call.fn, args: call.args }, spec, timeline, steps, env, depth, provenance, creatorMap, animatorMap, ctx);
    }
    throw new Error(`Function "${call.fn}" not found`);
  }
  
  const resolvedArgs: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(call.args)) {
    resolvedArgs[key] = resolveValue(val, env, spec);
  }
  
  // Pass the current context (caller's context) for provenance tracking
  const result = executeFunctionTraced(fnDef, call.fn, resolvedArgs, spec, timeline, steps, env, depth, provenance, creatorMap, animatorMap, ctx);
  if (call.out) env.set(call.out, result);
  return result;
}

function executeLetTraced(
  letStmt: Record<string, unknown>, 
  spec: YAMLSpec, 
  steps: RuntimeStep[],
  env: Environment,
  depth: number
): void {
  for (const [varName, value] of Object.entries(letStmt)) {
    const resolved = resolveValue(value, env, spec);
    env.set(varName, resolved);
    steps.push({
      id: `step_${stepCounter++}`,
      type: 'let',
      variable: varName,
      value: resolved,
      depth,
    });
  }
}

function executeForeachTraced(
  foreach: ForeachStatement, 
  spec: YAMLSpec, 
  timeline: TimelineEvent[], 
  steps: RuntimeStep[],
  env: Environment,
  depth: number,
  provenance: ProvenanceMap,
  creatorMap: CreatorMap,
  animatorMap: AnimatorMap,
  ctx: ExecutionContext
): void {
  const rangeValue = resolveValue(foreach.range, env, spec);
  if (!Array.isArray(rangeValue)) throw new Error(`Foreach range must be array`);
  
  for (let i = 0; i < rangeValue.length; i++) {
    const value = rangeValue[i];
    const loopEnv: Environment = new Map(env);
    loopEnv.set(foreach.var, value);
    
    const iterStep: RuntimeStep = {
      id: `step_${stepCounter++}`,
      type: 'foreach',
      iteration: { var: foreach.var, value, index: i },
      depth,
      children: [],
    };
    steps.push(iterStep);
    
    for (let stmtIndex = 0; stmtIndex < foreach.do.length; stmtIndex++) {
      const stmt = foreach.do[stmtIndex];
      // Keep parent context for foreach body statements
      executeStatementTraced(stmt, spec, timeline, iterStep.children!, loopEnv, depth + 1, provenance, creatorMap, animatorMap, ctx);
    }
  }
}

function executeIRTraced(
  ir: { fn: string; args: Record<string, unknown> }, 
  spec: YAMLSpec, 
  timeline: TimelineEvent[], 
  steps: RuntimeStep[],
  env: Environment,
  depth: number,
  provenance: ProvenanceMap,
  creatorMap: CreatorMap,
  animatorMap: AnimatorMap,
  ctx: ExecutionContext
): void {
  const resolvedArgs: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(ir.args)) {
    resolvedArgs[key] = resolveValue(val, env, spec);
  }
  
  steps.push({
    id: `step_${stepCounter++}`,
    type: 'ir',
    functionName: ir.fn,
    resolvedArgs,
    depth,
  });
  
  // Track provenance for element creation/modification
  const elementId = resolvedArgs.id as string | undefined;
  const stmtKey = makeStatementKey(ctx.currentFn, ctx.currentStmtIndex);
  
  if (ir.fn === 'text.create' && elementId) {
    // This is a creator
    const prov: ElementProvenance = {
      elementId,
      creatorFn: ctx.currentFn,
      creatorStmtIndex: ctx.currentStmtIndex,
      creatorType: 'ir',
      animators: [],
    };
    provenance.set(elementId, prov);
    
    // Update creatorMap
    const existing = creatorMap.get(stmtKey) || [];
    existing.push(elementId);
    creatorMap.set(stmtKey, existing);
  } else if (ir.fn === 'text.update' && elementId) {
    // This is an animator
    const prov = provenance.get(elementId);
    if (prov) {
      prov.animators.push({
        fn: ctx.currentFn,
        stmtIndex: ctx.currentStmtIndex,
        irType: ir.fn,
      });
    }
    
    // Update animatorMap
    const existing = animatorMap.get(stmtKey) || [];
    existing.push(elementId);
    animatorMap.set(stmtKey, existing);
  }
  
  timeline.push({
    id: `event_${eventCounter++}`,
    type: ir.fn as TimelineEvent['type'],
    args: resolvedArgs,
    timestamp: eventCounter,
    sourceFn: ctx.currentFn,
    sourceStmtIndex: ctx.currentStmtIndex,
  });
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
