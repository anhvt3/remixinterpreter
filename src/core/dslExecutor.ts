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
import { reportMissingFunctionOnce } from './missingFunctionRegistry';

export interface ExecutionResult {
  timeline: TimelineEvent[];
  returnValue: unknown;
}

let eventCounter = 0;

export function execute(spec: YAMLSpec): ExecutionResult {
  eventCounter = 0;
  const timeline: TimelineEvent[] = [];
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
  
  const result = executeFunction(entryFn, resolvedArgs, spec, timeline, globalEnv);
  
  return { timeline, returnValue: result };
}

function executeFunction(
  fn: FunctionDef,
  args: Record<string, unknown>,
  spec: YAMLSpec,
  timeline: TimelineEvent[],
  parentEnv: Environment
): unknown {
  const env: Environment = new Map(parentEnv);
  
  for (const param of fn.params) {
    if (args[param] !== undefined) {
      env.set(param, args[param]);
    }
  }
  
  for (const stmt of fn.body) {
    const result = executeStatement(stmt, spec, timeline, env);
    if (result !== undefined && 'return' in stmt) {
      return result;
    }
  }
  
  return undefined;
}

function executeStatement(
  stmt: Statement,
  spec: YAMLSpec,
  timeline: TimelineEvent[],
  env: Environment
): unknown {
  if ('call' in stmt) return executeCall(stmt.call, spec, timeline, env);
  if ('let' in stmt) return executeLet(stmt.let, spec, env);
  if ('foreach' in stmt) return executeForeach(stmt.foreach, spec, timeline, env);
  if ('return' in stmt) return resolveValue(stmt.return, env, spec);
  if ('ir' in stmt) return executeIR(stmt.ir, spec, timeline, env);
  return undefined;
}

function executeCall(call: CallStatement, spec: YAMLSpec, timeline: TimelineEvent[], env: Environment): unknown {
  const fnDef = spec.defs[call.fn];
  
  if (!fnDef) {
    // Check if it's a known IR pattern
    if (call.fn.startsWith('board.') || call.fn.startsWith('text.') || call.fn.startsWith('shape.')) {
      return executeIR({ fn: call.fn, args: call.args }, spec, timeline, env);
    }
    // Report as missing DSL function
    reportMissingFunctionOnce(call.fn, 'dsl');
    
    // Create a text element displaying the missing function name
    const missingId = `missing_${call.fn}_${eventCounter}`;
    timeline.push({
      id: `event_${eventCounter++}`,
      type: 'text.create' as TimelineEvent['type'],
      args: {
        id: missingId,
        content: `⚠ ${call.fn}()`,
        mode: 'text',
        atX: 0,
        atY: 0,
        fontSize: 0.3,
        color: '#ff6b6b',
        opacity: 0.7,
      },
      timestamp: eventCounter,
    });
    
    return undefined;
  }
  
  const resolvedArgs: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(call.args)) {
    resolvedArgs[key] = resolveValue(val, env, spec);
  }
  
  const result = executeFunction(fnDef, resolvedArgs, spec, timeline, env);
  if (call.out) env.set(call.out, result);
  return result;
}

function executeLet(letStmt: Record<string, unknown>, spec: YAMLSpec, env: Environment): void {
  for (const [varName, value] of Object.entries(letStmt)) {
    env.set(varName, resolveValue(value, env, spec));
  }
}

function executeForeach(foreach: ForeachStatement, spec: YAMLSpec, timeline: TimelineEvent[], env: Environment): void {
  const rangeValue = resolveValue(foreach.range, env, spec);
  if (!Array.isArray(rangeValue)) throw new Error(`Foreach range must be array`);
  
  for (const value of rangeValue) {
    const loopEnv: Environment = new Map(env);
    loopEnv.set(foreach.var, value);
    for (const stmt of foreach.do) {
      executeStatement(stmt, spec, timeline, loopEnv);
    }
  }
}

function executeIR(ir: { fn: string; args: Record<string, unknown> }, spec: YAMLSpec, timeline: TimelineEvent[], env: Environment): void {
  const resolvedArgs: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(ir.args)) {
    const resolved = resolveValue(val, env, spec);
    resolvedArgs[key] = resolved;
    // Debug: log unresolved values
    if (typeof resolved === 'string' && resolved.startsWith('$')) {
      console.warn(`IR ${ir.fn}: arg "${key}" not resolved: ${resolved}`);
    }
  }
  
  
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
    
    // Also resolve any $.path references in the expression by adding spec to env
    const exprEnv: Environment = new Map(env);
    exprEnv.set('$', spec); // Allow $. paths to resolve
    
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
