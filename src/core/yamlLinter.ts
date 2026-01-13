import yaml from 'js-yaml';

export interface LintError {
  line: number; // 0-indexed
  column?: number;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Lints YAML content and returns an array of errors with line information.
 */
export function lintYAML(content: string): LintError[] {
  const errors: LintError[] = [];
  const lines = content.split('\n');

  // First, check for common syntax issues line by line
  lines.forEach((line, idx) => {
    // Check for missing space after colon before opening brace
    // Pattern: key:{ or key:[ without space
    const missingSpaceMatch = line.match(/([a-zA-Z0-9_-]+):(\{|\[)(?!\s)/);
    if (missingSpaceMatch) {
      const colonIndex = line.indexOf(missingSpaceMatch[0]);
      errors.push({
        line: idx,
        column: colonIndex + missingSpaceMatch[1].length + 1,
        message: `Missing space after colon before '${missingSpaceMatch[2]}'. Use ': ${missingSpaceMatch[2]}' instead of ':${missingSpaceMatch[2]}'`,
        severity: 'error',
      });
    }

    // Check for tabs (YAML uses spaces)
    if (line.includes('\t')) {
      errors.push({
        line: idx,
        column: line.indexOf('\t'),
        message: 'Tab character found. YAML requires spaces for indentation.',
        severity: 'error',
      });
    }

    // Check for trailing colons with no value and no next-line content
    const trailingColonMatch = line.match(/^(\s*)([a-zA-Z0-9_-]+):\s*$/);
    if (trailingColonMatch && idx === lines.length - 1) {
      // Only warn if it's the last line (potential incomplete entry)
      errors.push({
        line: idx,
        message: 'Key with no value at end of file.',
        severity: 'warning',
      });
    }

    // Check for inconsistent indentation (odd number of spaces when using 2-space indent)
    const leadingSpaces = line.match(/^(\s*)/)?.[1]?.length || 0;
    if (leadingSpaces > 0 && line.trim().length > 0) {
      // Detect if file uses 2-space indentation
      const firstIndentedLine = lines.find(l => {
        const spaces = l.match(/^(\s*)/)?.[1]?.length || 0;
        return spaces > 0 && l.trim().length > 0;
      });
      const baseIndent = firstIndentedLine?.match(/^(\s*)/)?.[1]?.length || 2;
      
      if (baseIndent === 2 && leadingSpaces % 2 !== 0) {
        errors.push({
          line: idx,
          column: 0,
          message: `Inconsistent indentation: ${leadingSpaces} spaces (expected multiple of 2).`,
          severity: 'warning',
        });
      }
    }

    // Check for duplicate colons in same key-value (e.g., key:: value)
    if (line.match(/[a-zA-Z0-9_-]+::\s/)) {
      errors.push({
        line: idx,
        message: 'Double colon found. Use single colon for key-value pairs.',
        severity: 'error',
      });
    }

    // Check for unquoted special characters that might cause issues
    const unquotedSpecial = line.match(/:\s+([*&!%@`])/);
    if (unquotedSpecial && !line.includes('#')) {
      errors.push({
        line: idx,
        column: line.indexOf(unquotedSpecial[1]),
        message: `Special character '${unquotedSpecial[1]}' should be quoted.`,
        severity: 'warning',
      });
    }
  });

  // Then try to parse with js-yaml to catch structural errors
  try {
    yaml.load(content);
  } catch (e) {
    if (e instanceof yaml.YAMLException) {
      // Extract line info from the yaml exception
      const mark = e.mark;
      if (mark) {
        // Check if we already have an error for this line
        const existingError = errors.find(err => err.line === mark.line);
        if (!existingError) {
          errors.push({
            line: mark.line,
            column: mark.column,
            message: e.reason || e.message,
            severity: 'error',
          });
        }
      } else {
        // Try to extract line number from message
        const lineMatch = e.message.match(/at line (\d+)/i);
        if (lineMatch) {
          const lineNum = parseInt(lineMatch[1], 10) - 1;
          const existingError = errors.find(err => err.line === lineNum);
          if (!existingError) {
            errors.push({
              line: lineNum,
              message: e.message,
              severity: 'error',
            });
          }
        } else {
          // Generic error without line info
          errors.push({
            line: 0,
            message: e.message,
            severity: 'error',
          });
        }
      }
    }
  }

  // Sort errors by line number
  errors.sort((a, b) => a.line - b.line);

  return errors;
}

/**
 * Format a lint error for display
 */
export function formatLintError(error: LintError): string {
  const location = error.column !== undefined 
    ? `Line ${error.line + 1}, Col ${error.column + 1}` 
    : `Line ${error.line + 1}`;
  return `${location}: ${error.message}`;
}
