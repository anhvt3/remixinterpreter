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

// Call chain entry: function name and statement index
export interface CallChainEntry {
  fnName: string;
  stmtIndex: number;
}

// Map from element ID to its creation call chain
// The chain is ordered from innermost (direct creator) to outermost (entry point)
export type ElementCallChainMap = Map<string, CallChainEntry[]>;

export interface TracedExecutionResult {
  timeline: TimelineEvent[];
  returnValue: unknown;
  steps: RuntimeStep[];
  elementCallChains: ElementCallChainMap;
  // Map from step ID to call chain (for reverse lookup when clicking runtime steps)
  stepCallChains: Map<string, CallChainEntry[]>;
  // Map from step ID to element IDs created by that step (including children)
  stepCreatedElements: Map<string, string[]>;
}

let eventCounter = 0;
let stepCounter = 0;

// Call stack for tracking element creation chains
interface CallStackFrame {
  fnName: string;
  stmtIndex: number;
}

export function executeWithTrace(spec: YAMLSpec): TracedExecutionResult {
  eventCounter = 0;
  stepCounter = 0;
  const timeline: TimelineEvent[] = [];
  const steps: RuntimeStep[] = [];
  const elementCallChains: ElementCallChainMap = new Map();
  const stepCallChains = new Map<string, CallChainEntry[]>();
  const stepCreatedElements = new Map<string, string[]>();
  const callStack: CallStackFrame[] = [];
  const globalEnv: Environment = new Map();
  
  const entry = spec.program.entry.call;
  const entryFn = spec.defs[entry.fn];
  
  if (!entryFn) {
    throw new Error(`Entry function "${entry.fn}" not found`);
  }
  
  const resolvedArgs: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(entry.args)) {
    resolvedArgs[key] = resolveValue(val, globalEnv, spec);
  }
  
  const result = executeFunctionTraced(entryFn, entry.fn, resolvedArgs, spec, timeline, steps, globalEnv, 0, callStack, elementCallChains, stepCallChains, stepCreatedElements);
  
  return { timeline, returnValue: result, steps, elementCallChains, stepCallChains, stepCreatedElements };
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
  callStack: CallStackFrame[],
  elementCallChains: ElementCallChainMap,
  stepCallChains: Map<string, CallChainEntry[]>,
  stepCreatedElements: Map<string, string[]>
): unknown {
  const env: Environment = new Map(parentEnv);
  
  // Capture current call chain for this function step
  const currentChain = [...callStack].reverse();
  
  // Create step for this function call
  const fnStep: RuntimeStep = {
    id: `step_${stepCounter++}`,
    type: 'call',
    functionName: fnName,
    fnName: fnName,
    args: { ...args },
    resolvedArgs: { ...args },
    depth,
    children: [],
    createdElementIds: [],
  };
  steps.push(fnStep);
  
  // Store the call chain for this step
  stepCallChains.set(fnStep.id, currentChain);
  
  for (const param of fn.params) {
    if (args[param] !== undefined) {
      env.set(param, args[param]);
    }
  }
  
  for (let stmtIdx = 0; stmtIdx < fn.body.length; stmtIdx++) {
    const stmt = fn.body[stmtIdx];
    // Push current frame onto call stack
    callStack.push({ fnName, stmtIndex: stmtIdx });
    
    const result = executeStatementTraced(stmt, spec, timeline, fnStep.children!, env, depth + 1, callStack, elementCallChains, stepCallChains, stepCreatedElements, fnStep);
    
    // Pop the frame
    callStack.pop();
    
    if (result !== undefined && 'return' in stmt) {
      // Propagate created elements to parent
      stepCreatedElements.set(fnStep.id, fnStep.createdElementIds || []);
      return result;
    }
  }
  
  // Store created elements for this step
  stepCreatedElements.set(fnStep.id, fnStep.createdElementIds || []);
  
  return undefined;
}

function executeStatementTraced(
  stmt: Statement,
  spec: YAMLSpec,
  timeline: TimelineEvent[],
  steps: RuntimeStep[],
  env: Environment,
  depth: number,
  callStack: CallStackFrame[],
  elementCallChains: ElementCallChainMap,
  stepCallChains: Map<string, CallChainEntry[]>,
  stepCreatedElements: Map<string, string[]>,
  parentStep?: RuntimeStep
): unknown {
  if ('call' in stmt) return executeCallTraced(stmt.call, spec, timeline, steps, env, depth, callStack, elementCallChains, stepCallChains, stepCreatedElements, parentStep);
  if ('let' in stmt) return executeLetTraced(stmt.let, spec, steps, env, depth, stepCallChains, callStack);
  if ('foreach' in stmt) return executeForeachTraced(stmt.foreach, spec, timeline, steps, env, depth, callStack, elementCallChains, stepCallChains, stepCreatedElements, parentStep);
  if ('return' in stmt) {
    const value = resolveValue(stmt.return, env, spec);
    const returnStep: RuntimeStep = {
      id: `step_${stepCounter++}`,
      type: 'return',
      returnValue: value,
      depth,
    };
    steps.push(returnStep);
    stepCallChains.set(returnStep.id, [...callStack].reverse());
    return value;
  }
  if ('ir' in stmt) return executeIRTraced(stmt.ir, spec, timeline, steps, env, depth, callStack, elementCallChains, stepCallChains, stepCreatedElements, parentStep);
  return undefined;
}

function executeCallTraced(
  call: CallStatement, 
  spec: YAMLSpec, 
  timeline: TimelineEvent[], 
  steps: RuntimeStep[],
  env: Environment,
  depth: number,
  callStack: CallStackFrame[],
  elementCallChains: ElementCallChainMap,
  stepCallChains: Map<string, CallChainEntry[]>,
  stepCreatedElements: Map<string, string[]>,
  parentStep?: RuntimeStep
): unknown {
  const fnDef = spec.defs[call.fn];
  
  if (!fnDef) {
    if (call.fn.startsWith('board.') || call.fn.startsWith('text.')) {
      return executeIRTraced({ fn: call.fn, args: call.args }, spec, timeline, steps, env, depth, callStack, elementCallChains, stepCallChains, stepCreatedElements, parentStep);
    }
    throw new Error(`Function "${call.fn}" not found`);
  }
  
  const resolvedArgs: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(call.args)) {
    resolvedArgs[key] = resolveValue(val, env, spec);
  }
  
  const result = executeFunctionTraced(fnDef, call.fn, resolvedArgs, spec, timeline, steps, env, depth, callStack, elementCallChains, stepCallChains, stepCreatedElements);
  if (call.out) env.set(call.out, result);
  return result;
}

function executeLetTraced(
  letStmt: Record<string, unknown>, 
  spec: YAMLSpec, 
  steps: RuntimeStep[],
  env: Environment,
  depth: number,
  stepCallChains: Map<string, CallChainEntry[]>,
  callStack: CallStackFrame[]
): void {
  for (const [varName, value] of Object.entries(letStmt)) {
    const resolved = resolveValue(value, env, spec);
    env.set(varName, resolved);
    const letStep: RuntimeStep = {
      id: `step_${stepCounter++}`,
      type: 'let',
      variable: varName,
      value: resolved,
      depth,
    };
    steps.push(letStep);
    stepCallChains.set(letStep.id, [...callStack].reverse());
  }
}

function executeForeachTraced(
  foreach: ForeachStatement, 
  spec: YAMLSpec, 
  timeline: TimelineEvent[], 
  steps: RuntimeStep[],
  env: Environment,
  depth: number,
  callStack: CallStackFrame[],
  elementCallChains: ElementCallChainMap,
  stepCallChains: Map<string, CallChainEntry[]>,
  stepCreatedElements: Map<string, string[]>,
  parentStep?: RuntimeStep
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
      createdElementIds: [],
    };
    steps.push(iterStep);
    stepCallChains.set(iterStep.id, [...callStack].reverse());
    
    for (let stmtIdx = 0; stmtIdx < foreach.do.length; stmtIdx++) {
      const stmt = foreach.do[stmtIdx];
      executeStatementTraced(stmt, spec, timeline, iterStep.children!, loopEnv, depth + 1, callStack, elementCallChains, stepCallChains, stepCreatedElements, iterStep);
    }
    
    // Store created elements for this iteration
    stepCreatedElements.set(iterStep.id, iterStep.createdElementIds || []);
    
    // Propagate to parent
    if (parentStep && parentStep.createdElementIds) {
      parentStep.createdElementIds.push(...(iterStep.createdElementIds || []));
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
  callStack: CallStackFrame[],
  elementCallChains: ElementCallChainMap,
  stepCallChains: Map<string, CallChainEntry[]>,
  stepCreatedElements: Map<string, string[]>,
  parentStep?: RuntimeStep
): void {
  const resolvedArgs: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(ir.args)) {
    resolvedArgs[key] = resolveValue(val, env, spec);
  }
  
  // Track element creation - if this IR creates an element with an id
  const elementId = resolvedArgs.id;
  const createdIds: string[] = [];
  if (typeof elementId === 'string') {
    // Save the current call chain for this element
    // Clone the stack and reverse it so innermost is first
    const chain = [...callStack].reverse();
    elementCallChains.set(elementId, chain);
    createdIds.push(elementId);
    
    // Propagate to parent step
    if (parentStep && parentStep.createdElementIds) {
      parentStep.createdElementIds.push(elementId);
    }
  }
  
  const irStep: RuntimeStep = {
    id: `step_${stepCounter++}`,
    type: 'ir',
    functionName: ir.fn,
    resolvedArgs,
    depth,
    createdElementIds: createdIds,
  };
  steps.push(irStep);
  stepCallChains.set(irStep.id, [...callStack].reverse());
  stepCreatedElements.set(irStep.id, createdIds);
  
  timeline.push({
    id: `event_${eventCounter++}`,
    type: ir.fn as TimelineEvent['type'],
    args: resolvedArgs,
    timestamp: eventCounter,
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
