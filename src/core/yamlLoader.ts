import yaml from 'js-yaml';
import type { YAMLSpec } from './types';

/**
 * Preprocesses YAML content to fix common syntax errors before parsing.
 * This makes the parser more robust and forgiving of minor mistakes.
 */
export function preprocessYAML(yamlString: string): string {
  const lines = yamlString.split('\n');
  
  const fixedLines = lines.map((line, idx) => {
    let fixed = line;
    
    // Fix 1: Missing space after colon before { or [
    // e.g., "key:{" -> "key: {"
    // e.g., "key:[" -> "key: ["
    fixed = fixed.replace(/([a-zA-Z0-9_-]+):(\{|\[)/g, '$1: $2');
    
    // Fix 2: Missing space after colon before quoted strings
    // e.g., 'key:"value"' -> 'key: "value"'
    fixed = fixed.replace(/([a-zA-Z0-9_-]+):(["'])/g, '$1: $2');
    
    // Fix 3: Missing space after colon before numbers
    // e.g., "x:5" -> "x: 5"
    fixed = fixed.replace(/([a-zA-Z0-9_-]+):(-?\d)/g, '$1: $2');
    
    // Fix 4: Missing space after colon before $ references
    // e.g., "value:$var" -> "value: $var"
    fixed = fixed.replace(/([a-zA-Z0-9_-]+):(\$)/g, '$1: $2');
    
    // Fix 5: Missing space after colon before identifiers (but not URLs)
    // e.g., "anchor:Center" -> "anchor: Center"
    // Skip if it looks like a URL (contains ://)
    if (!fixed.includes('://')) {
      fixed = fixed.replace(/([a-zA-Z0-9_-]+):([a-zA-Z])/g, '$1: $2');
    }
    
    // Fix 6: Convert tabs to spaces (2 spaces per tab)
    fixed = fixed.replace(/\t/g, '  ');
    
    // Fix 7: Remove trailing whitespace (can cause issues in some cases)
    fixed = fixed.replace(/\s+$/, '');
    
    return fixed;
  });
  
  return fixedLines.join('\n');
}

export function loadYAML(yamlString: string): YAMLSpec {
  try {
    // First try to parse as-is
    const parsed = yaml.load(yamlString) as YAMLSpec;
    return parsed;
  } catch (originalError) {
    // If parsing fails, try with preprocessing
    try {
      const preprocessed = preprocessYAML(yamlString);
      const parsed = yaml.load(preprocessed) as YAMLSpec;
      // Log that we auto-fixed the YAML (helpful for debugging)
      console.log('[yamlLoader] Auto-fixed YAML syntax issues');
      return parsed;
    } catch {
      // If still fails, throw the original error for better debugging
      throw new Error(`Failed to parse YAML: ${originalError instanceof Error ? originalError.message : 'Unknown error'}`);
    }
  }
}
