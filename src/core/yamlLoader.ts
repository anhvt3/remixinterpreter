import yaml from 'js-yaml';
import type { YAMLSpec } from './types';

export function loadYAML(yamlString: string): YAMLSpec {
  try {
    const parsed = yaml.load(yamlString) as YAMLSpec;
    return parsed;
  } catch (error) {
    throw new Error(`Failed to parse YAML: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
