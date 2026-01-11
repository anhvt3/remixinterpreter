import type { YAMLSpec } from './types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateSchema(spec: YAMLSpec): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check schema version
  if (spec.schema_version !== 2) {
    errors.push(`Unsupported schema_version: ${spec.schema_version}. Expected 2.`);
  }

  // Check dialect
  if (spec.dialect !== 'AnimYAML-DSL') {
    errors.push(`Unsupported dialect: ${spec.dialect}. Expected "AnimYAML-DSL".`);
  }

  // Check determinism rules exist
  if (!spec.determinism?.rules || spec.determinism.rules.length === 0) {
    warnings.push('No determinism rules specified.');
  }

  // Check required sections exist
  if (!spec.params) {
    errors.push('Missing required section: params');
  }

  if (!spec.defs) {
    errors.push('Missing required section: defs');
  }

  if (!spec.program?.entry?.call) {
    errors.push('Missing required section: program.entry.call');
  }

  // Validate entry function exists
  if (spec.program?.entry?.call?.fn && spec.defs) {
    const entryFn = spec.program.entry.call.fn;
    if (!spec.defs[entryFn]) {
      errors.push(`Entry function "${entryFn}" not found in defs.`);
    }
  }

  // Validate all function references exist
  if (spec.defs) {
    for (const [fnName, fnDef] of Object.entries(spec.defs)) {
      for (const stmt of fnDef.body) {
        if ('call' in stmt) {
          const calledFn = stmt.call.fn;
          // Skip IR functions
          if (!calledFn.startsWith('board.') && !calledFn.startsWith('text.')) {
            if (!spec.defs[calledFn]) {
              errors.push(`Function "${fnName}" calls undefined function "${calledFn}".`);
            }
          }
        }
      }
    }
  }

  // Validate time values are explicit numbers
  if (spec.params?.time) {
    const timeKeys = Object.keys(spec.params.time);
    for (const key of timeKeys) {
      const timeVal = (spec.params.time as Record<string, unknown>)[key];
      if (timeVal && typeof timeVal === 'object' && 't0' in timeVal) {
        const t = timeVal as { t0: unknown; t1: unknown };
        if (typeof t.t0 !== 'number' || typeof t.t1 !== 'number') {
          if (!Array.isArray(timeVal)) {
            errors.push(`Time values for "${key}" must be explicit numbers.`);
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
