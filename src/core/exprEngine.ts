import type { Environment, Power } from './types';
import * as mathStdlib from '../stdlib/math';
import * as texStdlib from '../stdlib/tex';

/**
 * Evaluate an expression with its arguments
 * Supports: index, len, add, mul, format, concat, map, reduce, let, range
 * Plus stdlib functions: math.*, tex.*
 */
export function evaluate(
  expr: string,
  args: Record<string, unknown>,
  env: Environment
): unknown {
  // Parse the expression
  const parsed = parseExpression(expr);
  
  if (!parsed) {
    throw new Error(`Failed to parse expression: ${expr}`);
  }
  
  return evaluateParsed(parsed, args, env);
}

interface ParsedExpr {
  fn: string;
  args: string[];
}

function parseExpression(expr: string): ParsedExpr | null {
  // Match function call: fnName(arg1, arg2, ...)
  const match = expr.match(/^([a-zA-Z_.]+)\((.+)\)$/);
  if (!match) {
    return null;
  }
  
  const fn = match[1];
  const argsStr = match[2];
  
  // Parse arguments (handling nested parentheses)
  const args = parseArgs(argsStr);
  
  return { fn, args };
}

function parseArgs(argsStr: string): string[] {
  const args: string[] = [];
  let current = '';
  let depth = 0;
  
  for (let i = 0; i < argsStr.length; i++) {
    const char = argsStr[i];
    
    if (char === '(') {
      depth++;
      current += char;
    } else if (char === ')') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    args.push(current.trim());
  }
  
  return args;
}

function resolveArgValue(arg: string, providedArgs: Record<string, unknown>, env: Environment): unknown {
  // Check if arg is directly in providedArgs
  if (providedArgs[arg] !== undefined) {
    return providedArgs[arg];
  }
  
  // Check for root path like "$.params.time.row_times"
  if (arg.startsWith('$.')) {
    // Try to get from env's $ key
    const rootSpec = env.get('$');
    if (rootSpec && typeof rootSpec === 'object') {
      const path = arg.substring(2); // Remove "$."
      const parts = path.split('.');
      let result: unknown = rootSpec;
      for (const part of parts) {
        if (result && typeof result === 'object') {
          result = (result as Record<string, unknown>)[part];
        } else {
          return undefined;
        }
      }
      return result;
    }
    return arg;
  }
  
  // Check for field access like "Ladder.factors"
  if (arg.includes('.')) {
    const parts = arg.split('.');
    const baseName = parts[0];
    
    // Look for base in provided args
    if (providedArgs[baseName] !== undefined) {
      let result = providedArgs[baseName];
      for (let i = 1; i < parts.length; i++) {
        if (result && typeof result === 'object') {
          result = (result as Record<string, unknown>)[parts[i]];
        } else {
          return undefined;
        }
      }
      return result;
    }
    
    // Look for base in environment
    if (env.has(baseName)) {
      let result = env.get(baseName);
      for (let i = 1; i < parts.length; i++) {
        if (result && typeof result === 'object') {
          result = (result as Record<string, unknown>)[parts[i]];
        } else {
          return undefined;
        }
      }
      return result;
    }
  }
  
  // Look in environment directly
  if (env.has(arg)) {
    return env.get(arg);
  }
  
  // Check if it's a number literal
  if (/^-?\d+(\.\d+)?$/.test(arg)) {
    return parseFloat(arg);
  }
  
  // Check if it's a string literal
  if ((arg.startsWith("'") && arg.endsWith("'")) || (arg.startsWith('"') && arg.endsWith('"'))) {
    return arg.slice(1, -1);
  }
  
  return arg;
}

function evaluateParsed(
  parsed: ParsedExpr,
  providedArgs: Record<string, unknown>,
  env: Environment
): unknown {
  const { fn, args: exprArgs } = parsed;
  
  // Resolve expression arguments to actual values
  const resolvedExprArgs = exprArgs.map(arg => {
    // Check if it's a nested expression
    const nestedParsed = parseExpression(arg);
    if (nestedParsed) {
      return evaluateParsed(nestedParsed, providedArgs, env);
    }
    
    return resolveArgValue(arg, providedArgs, env);
  });
  
  // Execute the function
  switch (fn) {
    case 'index':
      return doIndex(resolvedExprArgs);
    case 'len':
      return doLen(resolvedExprArgs);
    case 'add':
      return doAdd(resolvedExprArgs);
    case 'mul':
      return doMul(resolvedExprArgs);
    case 'format':
      return doFormat(resolvedExprArgs);
    case 'concat':
      return doConcat(resolvedExprArgs);
    case 'range':
      return doRange(resolvedExprArgs);
    case 'map':
      return doMap(resolvedExprArgs);
    case 'reduce':
      return doReduce(resolvedExprArgs);
    case 'math.prime_factors':
      return mathStdlib.primeFactors(resolvedExprArgs[0] as number);
    case 'math.quotient_chain':
      return mathStdlib.quotientChain(
        resolvedExprArgs[0] as number,
        resolvedExprArgs[1] as number[]
      );
    case 'math.count_powers':
      return mathStdlib.countPowers(resolvedExprArgs[0] as number[]);
    case 'tex.prime_factor_expr':
      return texStdlib.primeFactorExpr(
        resolvedExprArgs[0] as number,
        resolvedExprArgs[1] as Power[]
      );
    case 'tex.rhs_of_equation':
      return texStdlib.rhsOfEquation(resolvedExprArgs[0] as string);
    case 'tex.root_rewrite':
      return texStdlib.rootRewrite(
        resolvedExprArgs[0] as number,
        resolvedExprArgs[1] as string
      );
    case 'tex.split_root':
      return texStdlib.splitRoot(
        resolvedExprArgs[0] as number,
        resolvedExprArgs[1] as Power[]
      );
    case 'tex.extract_squares':
      return texStdlib.extractSquares(
        resolvedExprArgs[0] as number,
        resolvedExprArgs[1] as Power[]
      );
    default:
      throw new Error(`Unknown function: ${fn}`);
  }
}

function doIndex(args: unknown[]): unknown {
  const arr = args[0];
  const idx = args[1] as number;
  
  if (Array.isArray(arr)) {
    return arr[idx];
  }
  return undefined;
}

function doLen(args: unknown[]): number {
  const arr = args[0];
  if (Array.isArray(arr)) {
    return arr.length;
  }
  return 0;
}

function doAdd(args: unknown[]): number {
  return (Number(args[0]) || 0) + (Number(args[1]) || 0);
}

function doMul(args: unknown[]): number {
  return (Number(args[0]) || 0) * (Number(args[1]) || 0);
}

function doFormat(args: unknown[]): string {
  const template = String(args[0]);
  const values = args.slice(1);
  
  let result = template;
  let valueIndex = 0;
  
  result = result.replace(/%[sd]/g, () => {
    const val = values[valueIndex++];
    return String(val);
  });
  
  return result;
}

function doConcat(args: unknown[]): string {
  return args.map(String).join('');
}

function doRange(args: unknown[]): number[] {
  const start = Number(args[0]) || 0;
  const end = Number(args[1]) || 0;
  const result: number[] = [];
  
  for (let i = start; i < end; i++) {
    result.push(i);
  }
  
  return result;
}

function doMap(args: unknown[]): unknown[] {
  const arr = args[0] as unknown[];
  if (Array.isArray(arr)) {
    return arr;
  }
  return [];
}

function doReduce(args: unknown[]): unknown {
  return args[2]; // Return initial value as fallback
}

/**
 * Check if a value is an expression object
 */
export function isExpression(value: unknown): value is { expr: string; args: Record<string, unknown> } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'expr' in value &&
    'args' in value
  );
}
