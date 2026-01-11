import type { YAMLSpec, Environment } from './types';

/**
 * Resolves variable references in values.
 * - "$.path.to.value" resolves from YAML root
 * - "$VarName" resolves from local environment
 * - Nested fields: "$Var.field" resolves Var then accesses field
 */
export function resolve(
  value: unknown,
  env: Environment,
  spec: YAMLSpec
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return resolveString(value, env, spec);
  }

  if (Array.isArray(value)) {
    return value.map((v) => resolve(v, env, spec));
  }

  if (typeof value === 'object') {
    // Check if it's an expression object
    if ('expr' in value && 'args' in value) {
      return value; // Return expression objects as-is for the expression engine
    }

    // Recursively resolve object properties
    const resolved: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      resolved[key] = resolve(val, env, spec);
    }
    return resolved;
  }

  return value;
}

function resolveString(
  value: string,
  env: Environment,
  spec: YAMLSpec
): unknown {
  // Check if it's a root path reference
  if (value.startsWith('$.')) {
    try {
      return resolvePath(value.substring(2), spec);
    } catch {
      return value; // Return original if path fails
    }
  }

  // Check if it's a variable reference
  if (value.startsWith('$')) {
    const parts = value.substring(1).split('.');
    const varName = parts[0];
    
    if (!env.has(varName)) {
      console.warn(`Variable not found in env: ${varName}. Available: ${Array.from(env.keys()).join(', ')}`);
      return value; // Return original if variable not found
    }
    
    let result = env.get(varName);
    console.log(`Resolving ${value}: found ${varName} =`, result);
    
    // Resolve nested fields
    for (let i = 1; i < parts.length; i++) {
      if (result === null || result === undefined) {
        console.warn(`Cannot resolve ${value}: intermediate is null at ${parts.slice(0, i+1).join('.')}`);
        return value; // Return original if can't resolve
      }
      if (typeof result !== 'object') {
        console.warn(`Cannot resolve ${value}: intermediate is not object at ${parts.slice(0, i+1).join('.')}`);
        return value;
      }
      result = (result as Record<string, unknown>)[parts[i]];
      console.log(`  .${parts[i]} =`, result);
    }
    
    return result;
  }

  return value;
}

function resolvePath(path: string, root: unknown): unknown {
  const parts = path.split('.');
  let current = root;

  for (const part of parts) {
    if (current === null || current === undefined) {
      throw new Error(`Cannot resolve path "${path}": intermediate value is null/undefined`);
    }
    if (typeof current !== 'object') {
      throw new Error(`Cannot resolve path "${path}": intermediate value is not an object`);
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Deep resolve all values in an object
 */
export function deepResolve(
  value: unknown,
  env: Environment,
  spec: YAMLSpec
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return resolveString(value, env, spec);
  }

  if (Array.isArray(value)) {
    return value.map((v) => deepResolve(v, env, spec));
  }

  if (typeof value === 'object') {
    const resolved: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      resolved[key] = deepResolve(val, env, spec);
    }
    return resolved;
  }

  return value;
}
