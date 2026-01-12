import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Save, Trash2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConfigData, type ConfigVersion } from '@/hooks/useConfigData';

// Placeholder patterns with fuzzy matching support
const PLACEHOLDER_PATTERNS = [
  { key: 'ImportantNotes', regex: /\{[Ii]mportant[Nn]otes?\}/g },
  { key: 'IRF', regex: /\{[Ii][Rr][Ff][-_]?[Ii]ntermediate[Rr]epresentation[Ff]unctions?\}/g },
  { key: 'EDSL', regex: /\{[Ee][Dd][Ss][Ll][-_]?[Ee]xample[Dd]omain[Ss]pecific[Ll]anguage\}/g },
  { key: 'LO', regex: /\{[Ll][Oo][-_]?[Ll]earning[Oo]bjective\}/g },
  { key: 'SHD', regex: /\{[Ss][Hh][Dd][-_]?[Ss]hort[Dd]escription\}/g },
  { key: 'DSL', regex: /\{[Dd][Ss][Ll][-_]?[Dd]omain[Ss]pecific[Ll]anguage\}/g },
  { key: 'RTT', regex: /\{[Rr][Tt][Tt][-_]?[Rr]untime[Tt]race\}/g },
];

// Helper to replace placeholders with fuzzy matching
const replacePlaceholders = (
  template: string,
  replacements: Record<string, string>
): string => {
  let result = template;
  
  for (const pattern of PLACEHOLDER_PATTERNS) {
    const replacement = replacements[pattern.key];
    if (replacement !== undefined) {
      result = result.replace(pattern.regex, replacement);
    }
  }
  
  return result;
};

interface ConfigSubtabProps {
  versions: ConfigVersion[];
  selectedVersionId: string | null;
  onVersionSelect: (id: string) => void;
  onVersionDelete?: (id: string) => void;
  onVersionCreate?: () => void;
  onSystemPromptSave?: () => void;
  systemPrompt: string;
  onSystemPromptChange?: (value: string) => void;
  importantNotes: string;
  onImportantNotesChange?: (value: string) => void;
  // Content from other panels for placeholder replacement
  irfContent?: string;
  edslContent?: string;
  loContent?: string;
  descContent?: string;
  dslContent?: string;
  runtimeContent?: string;
  zoomLevel?: number;
}

const ConfigSubtab: React.FC<ConfigSubtabProps> = ({
  versions,
  selectedVersionId,
  onVersionSelect,
  onVersionDelete,
  onVersionCreate,
  onSystemPromptSave,
  systemPrompt,
  onSystemPromptChange,
  importantNotes,
  onImportantNotesChange,
  irfContent = '',
  edslContent = '',
  loContent = '',
  descContent = '',
  dslContent = '',
  runtimeContent = '',
  zoomLevel = 100,
}) => {
  const scale = zoomLevel / 100;

  // Generate Full Prompt by replacing placeholders
  const fullPrompt = useMemo(() => {
    const replacements: Record<string, string> = {
      ImportantNotes: importantNotes,
      IRF: irfContent,
      EDSL: edslContent,
      LO: loContent,
      SHD: descContent,
      DSL: dslContent,
      RTT: runtimeContent,
    };
    return replacePlaceholders(systemPrompt, replacements);
  }, [systemPrompt, importantNotes, irfContent, edslContent, loContent, descContent, dslContent, runtimeContent]);

  return (
    <div className="grid grid-cols-5 gap-2 h-full">
      {/* Versions Panel - 1/5 */}
      <div className="h-full min-h-0 overflow-hidden border border-border rounded-lg bg-card">
        <div className="h-8 px-3 flex items-center justify-between border-b border-border bg-muted/50">
          <span className="text-xs font-medium text-muted-foreground">Versions</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 hover:bg-primary/20 hover:text-primary"
            onClick={onVersionCreate}
            title="Create new version"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <ScrollArea className="h-[calc(100%-2rem)]">
          <div className="p-2 space-y-1" style={{ fontSize: `${scale}rem` }}>
            {versions.map((version) => (
              <div
                key={version.id}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md text-xs transition-colors flex items-start justify-between gap-1 group",
                  selectedVersionId === version.id
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <button
                  onClick={() => onVersionSelect(version.id)}
                  className="flex-1 text-left"
                >
                  <div className="font-medium">{version.name}</div>
                  <div className="text-[0.65rem] opacity-70 mt-0.5">{version.timestamp}</div>
                  {version.isActive && (
                    <span className="inline-block mt-1 px-1.5 py-0.5 text-[0.6rem] bg-accent/20 text-accent rounded">
                      Active
                    </span>
                  )}
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 opacity-0 group-hover:opacity-100 hover:bg-destructive/20 hover:text-destructive shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onVersionDelete?.(version.id);
                  }}
                  title="Delete version"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {versions.length === 0 && (
              <div className="text-xs text-muted-foreground p-3 text-center">
                No versions available
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* System Prompt Panel - 2/5 */}
      <div className="col-span-2 h-full min-h-0 overflow-hidden flex flex-col gap-2">
        {/* System Prompt - Top 2/3 */}
        <div className="flex-[2] min-h-0 overflow-hidden border border-border rounded-lg bg-card flex flex-col">
          <div className="h-8 px-3 flex items-center justify-between border-b border-border bg-muted/50 shrink-0">
            <span className="text-xs font-medium text-muted-foreground">System Prompt</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 hover:bg-primary/20 hover:text-primary"
              onClick={onSystemPromptSave}
              title="Save system prompt"
            >
              <Save className="h-3.5 w-3.5" />
            </Button>
          </div>
          <textarea
            className="flex-1 w-full p-4 text-xs text-foreground bg-transparent font-mono resize-none focus:outline-none focus:ring-1 focus:ring-primary/30"
            style={{ fontSize: `${0.75 * scale}rem`, lineHeight: 1.6 }}
            value={systemPrompt}
            onChange={(e) => onSystemPromptChange?.(e.target.value)}
            placeholder="No system prompt configured"
          />
        </div>

        {/* #ImportantNotes - Bottom 1/3 */}
        <div className="flex-1 min-h-0 overflow-hidden border border-border rounded-lg bg-card flex flex-col">
          <div className="h-8 px-3 flex items-center border-b border-border bg-muted/50 shrink-0">
            <span className="text-xs font-medium text-muted-foreground">#ImportantNotes</span>
          </div>
          <textarea
            className="flex-1 w-full p-3 text-xs text-foreground bg-transparent font-mono resize-none focus:outline-none focus:ring-1 focus:ring-primary/30"
            style={{ fontSize: `${0.75 * scale}rem`, lineHeight: 1.5 }}
            value={importantNotes}
            onChange={(e) => onImportantNotesChange?.(e.target.value)}
            placeholder="No important notes"
          />
        </div>
      </div>

      {/* Full Prompt Panel - 2/5 */}
      <div className="col-span-2 h-full min-h-0 overflow-hidden border border-border rounded-lg bg-card">
        <div className="h-8 px-3 flex items-center border-b border-border bg-muted/50">
          <span className="text-xs font-medium text-muted-foreground">Full Prompt</span>
        </div>
        <ScrollArea className="h-[calc(100%-2rem)]">
          <pre
            className="p-4 text-xs text-foreground whitespace-pre-wrap font-mono"
            style={{ fontSize: `${0.75 * scale}rem`, lineHeight: 1.6 }}
          >
            {fullPrompt || 'No full prompt available'}
          </pre>
        </ScrollArea>
      </div>
    </div>
  );
};

// Simple Subtab Component for IRF and EDSL (1/3 versions, 2/3 content)
interface SimpleSubtabProps {
  versions: ConfigVersion[];
  selectedVersionId: string | null;
  onVersionSelect: (id: string) => void;
  onVersionDelete?: (id: string) => void;
  onVersionCreate?: () => void;
  onContentSave?: () => void;
  versionsTitle: string;
  contentTitle: string;
  content: string;
  zoomLevel?: number;
}

const SimpleSubtab: React.FC<SimpleSubtabProps> = ({
  versions,
  selectedVersionId,
  onVersionSelect,
  onVersionDelete,
  onVersionCreate,
  onContentSave,
  versionsTitle,
  contentTitle,
  content,
  zoomLevel = 100,
}) => {
  const scale = zoomLevel / 100;

  return (
    <div className="grid grid-cols-3 gap-2 h-full">
      {/* Versions Panel - 1/3 */}
      <div className="h-full min-h-0 overflow-hidden border border-border rounded-lg bg-card">
        <div className="h-8 px-3 flex items-center justify-between border-b border-border bg-muted/50">
          <span className="text-xs font-medium text-muted-foreground">{versionsTitle}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 hover:bg-primary/20 hover:text-primary"
            onClick={onVersionCreate}
            title="Create new version"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <ScrollArea className="h-[calc(100%-2rem)]">
          <div className="p-2 space-y-1" style={{ fontSize: `${scale}rem` }}>
            {versions.map((version) => (
              <div
                key={version.id}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md text-xs transition-colors flex items-start justify-between gap-1 group",
                  selectedVersionId === version.id
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <button
                  onClick={() => onVersionSelect(version.id)}
                  className="flex-1 text-left"
                >
                  <div className="font-medium">{version.name}</div>
                  <div className="text-[0.65rem] opacity-70 mt-0.5">{version.timestamp}</div>
                  {version.isActive && (
                    <span className="inline-block mt-1 px-1.5 py-0.5 text-[0.6rem] bg-accent/20 text-accent rounded">
                      Active
                    </span>
                  )}
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 opacity-0 group-hover:opacity-100 hover:bg-destructive/20 hover:text-destructive shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onVersionDelete?.(version.id);
                  }}
                  title="Delete version"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {versions.length === 0 && (
              <div className="text-xs text-muted-foreground p-3 text-center">
                No versions available
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Content Panel - 2/3 */}
      <div className="col-span-2 h-full min-h-0 overflow-hidden border border-border rounded-lg bg-card">
        <div className="h-8 px-3 flex items-center justify-between border-b border-border bg-muted/50">
          <span className="text-xs font-medium text-muted-foreground">{contentTitle}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 hover:bg-primary/20 hover:text-primary"
            onClick={onContentSave}
            title="Save content"
          >
            <Save className="h-3.5 w-3.5" />
          </Button>
        </div>
        <ScrollArea className="h-[calc(100%-2rem)]">
          <pre
            className="p-4 text-xs text-foreground whitespace-pre-wrap font-mono"
            style={{ fontSize: `${0.75 * scale}rem`, lineHeight: 1.6 }}
          >
            {content || 'No content available'}
          </pre>
        </ScrollArea>
      </div>
    </div>
  );
};

// Sample data for IR Functions subtab
const sampleIRFunctionsList = `# IR Functions Reference

## text.create
Creates a text element on the canvas.
Parameters:
- id: string (required)
- content: string (required)
- x, y: number (position)
- color: string (hex or named)
- fontSize: number

## text.update
Updates an existing text element.
Parameters:
- id: string (required)
- content: string (optional)
- x, y: number (optional)
- opacity: number (0-1)

## text.morph
Morphs text content with animation.
Parameters:
- id: string (required)
- to: string (target content)
- t0, t1: number (timing)
- easing: string

## shape.create
Creates a geometric shape.
Parameters:
- id: string (required)
- type: "rect" | "circle" | "line"
- x, y, width, height: number

## shape.transform
Transforms a shape with animation.
Parameters:
- id: string (required)
- scale, rotate: number
- t0, t1: number`;

const sampleExampleDSLContent = `# Example DSL - Factor Tree Animation

schema_version: 2

params:
  title: "Prime Factorization"
  number: 24
  colors:
    primary: "#4F46E5"
    secondary: "#10B981"
    accent: "#F59E0B"

defs:
  main:
    body:
      - call: { fn: show_title, args: { text: "$title" } }
      - call: { fn: show_number, args: { n: "$number" } }
      - call: { fn: factor_step, args: { n: 24, f1: 4, f2: 6 } }
      - call: { fn: factor_step, args: { n: 4, f1: 2, f2: 2 } }
      - call: { fn: factor_step, args: { n: 6, f1: 2, f2: 3 } }
      - call: { fn: highlight_primes }

  show_title:
    args: [text]
    body:
      - ir: { fn: text.create, args: { id: title, content: "$text" } }

  show_number:
    args: [n]
    body:
      - ir: { fn: text.create, args: { id: root, content: "$n" } }`;

// Sample data for each subtab
const createSampleVersions = (prefix: string, displayPrefix: string): ConfigVersion[] => [
  { id: `${prefix}-v3`, name: `${displayPrefix} v3`, timestamp: '2024-01-12 14:30', isActive: true },
  { id: `${prefix}-v2`, name: `${displayPrefix} v2`, timestamp: '2024-01-10 09:15' },
  { id: `${prefix}-v1`, name: `${displayPrefix} v1`, timestamp: '2024-01-08 16:45' },
  { id: `${prefix}-v1`, name: `${displayPrefix} v1.0`, timestamp: '2024-01-08 16:45' },
];

const sampleImportantNotes: Record<string, string> = {
  'VA1120-EXTRACT-DESC': `• Always preserve mathematical notation exactly as written
• Include implicit assumptions in the output
• Flag ambiguous terms for human review`,

  'VA1210-GENERATE-DSL': `• Use schema_version: 2 for all outputs
• Validate timing constraints (t0 < t1)
• Prefer reusable functions over inline definitions`,

  'VA2210-GENERATE-SHORT-DESC': `• Maximum 280 characters
• Must include primary action verb
• Avoid jargon unless necessary`,

  'VA2220-EDIT-SHORT-DESC': `• Preserve original meaning
• Check character count after edits
• Maintain consistent tense`,

  'VA2310-GENERATE-DSL': `• Test macros with edge cases
• Document all macro parameters
• Use meaningful naming conventions`,

  'VA2320-EDIT-DSL': `• Run validation before saving
• Check for orphaned references
• Verify animation timing flow`,
};

const sampleSystemPrompts: Record<string, string> = {
  'VA1120-EXTRACT-DESC': `You are an expert at extracting structured descriptions from learning objectives.

## Task
Parse the provided learning objective and extract:
1. Core concept being taught
2. Key relationships and dependencies
3. Expected learning outcomes
4. Prerequisite knowledge

## Output Format
Return a structured JSON with the extracted information.

## Guidelines
- Be precise and technical
- Preserve mathematical notation
- Identify implicit assumptions`,

  'VA1210-GENERATE-DSL': `You are an AnimYAML DSL generator.

## Task
Convert the provided description into valid AnimYAML DSL code.

## DSL Requirements
- Use schema_version: 2
- Define reusable functions in defs section
- Use proper timing with t0/t1 parameters
- Include easing functions for smooth animations

## Output
Valid YAML that can be parsed by the AnimYAML interpreter.`,

  'VA2210-GENERATE-SHORT-DESC': `You are a technical writer specializing in concise descriptions.

## Task
Create a short description (max 280 characters) that captures the essence of the animation.

## Guidelines
- Use action-oriented language
- Highlight the key visual transformation
- Maintain technical accuracy`,

  'VA2220-EDIT-SHORT-DESC': `You are an editor refining short descriptions.

## Task
Review and improve the provided short description.

## Focus Areas
- Clarity and readability
- Technical precision
- Engagement factor`,

  'VA2310-GENERATE-DSL': `You are an advanced AnimYAML DSL generator with macro support.

## Task
Generate optimized DSL with advanced features.

## Features to Use
- Macro definitions for repetitive patterns
- Conditional compilation directives
- Optimization hints`,

  'VA2320-EDIT-DSL': `You are a DSL code reviewer and editor.

## Task
Review and improve the provided AnimYAML DSL code.

## Focus Areas
- Code efficiency
- Readability
- Animation smoothness
- Timing optimization`,
};

const sampleFullPrompts: Record<string, string> = {
  'VA1120-EXTRACT-DESC': `[SYSTEM]
You are an expert at extracting structured descriptions from learning objectives.
...

[USER]
Please analyze the following learning objective and extract a structured description:

Learning Objective: "Students will understand how prime factorization works by visualizing the factor tree decomposition of composite numbers."

[CONTEXT]
- Target audience: Middle school students
- Animation style: Step-by-step visual breakdown
- Duration: 30-60 seconds`,

  'VA1210-GENERATE-DSL': `[SYSTEM]
You are an AnimYAML DSL generator.
...

[USER]
Generate AnimYAML DSL for the following description:

Description: "Show a number being broken down into its prime factors using a tree structure. Each level of the tree reveals one factorization step."

[CONTEXT]
- Canvas size: 800x600
- Color scheme: Dark theme with accent colors
- Animation duration: 45 seconds`,

  'VA2210-GENERATE-SHORT-DESC': `[SYSTEM]
You are a technical writer specializing in concise descriptions.
...

[USER]
Create a short description for this animation:

Full Description: "This animation demonstrates prime factorization through an interactive factor tree visualization..."`,

  'VA2220-EDIT-SHORT-DESC': `[SYSTEM]
You are an editor refining short descriptions.
...

[USER]
Please improve this short description:

Current: "Factor tree animation showing prime factorization"

[FEEDBACK]
- Make it more engaging
- Add action words`,

  'VA2310-GENERATE-DSL': `[SYSTEM]
You are an advanced AnimYAML DSL generator with macro support.
...

[USER]
Generate optimized DSL with macros for:

Description: "Create a reusable animation pattern for displaying mathematical expressions with step-by-step highlighting."`,

  'VA2320-EDIT-DSL': `[SYSTEM]
You are a DSL code reviewer and editor.
...

[USER]
Please review and optimize this DSL code:

\`\`\`yaml
schema_version: 2
params:
  title: "Example"
defs:
  main:
    body:
      - call: { fn: show_title }
\`\`\``,
};

interface ConfigPanelProps {
  zoomLevel?: number;
  activeSubtab?: string;
  onSubtabChange?: (subtab: string) => void;
}

// Export subtabs list for use in App.tsx header
export const CONFIG_SUBTABS = [
  { id: 'IRF-IR-FUNCTIONS', label: 'IRF' },
  { id: 'EDSL-EXAMPLE-DSL', label: 'EDSL' },
  { id: 'VA1120-EXTRACT-DESC', label: 'VA1120' },
  { id: 'VA1210-GENERATE-DSL', label: 'VA1210' },
  { id: 'VA2210-GENERATE-SHORT-DESC', label: 'VA2210' },
  { id: 'VA2220-EDIT-SHORT-DESC', label: 'VA2220' },
  { id: 'VA2310-GENERATE-DSL', label: 'VA2310' },
  { id: 'VA2320-EDIT-DSL', label: 'VA2320' },
];

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ 
  zoomLevel = 100,
  activeSubtab = 'IRF-IR-FUNCTIONS',
  onSubtabChange,
}) => {
  const {
    configs,
    loading,
    getVersionsForType,
    getConfigById,
    saveConfig,
    createNewVersion,
    deleteConfig,
  } = useConfigData();

  const [selectedVersions, setSelectedVersions] = useState<Record<string, string | null>>({});
  const [editableContent, setEditableContent] = useState<Record<string, string>>({});
  const [editableNotes, setEditableNotes] = useState<Record<string, string>>({});

  const subtabs = [
    { id: 'IRF-IR-FUNCTIONS', label: 'IRF-IR Functions', isSpecial: 'irf', prefix: 'IRF' },
    { id: 'EDSL-EXAMPLE-DSL', label: 'EDSL-ExampleDSL', isSpecial: 'edsl', prefix: 'EDSL' },
    { id: 'VA1120-EXTRACT-DESC', label: 'VA1120-EXTRACT-DESC', isSpecial: false, prefix: 'VA1120-EXTRACT-DESC' },
    { id: 'VA1210-GENERATE-DSL', label: 'VA1210-GENERATE-DSL', isSpecial: false, prefix: 'VA1210-GENERATE-DSL' },
    { id: 'VA2210-GENERATE-SHORT-DESC', label: 'VA2210-GENERATE-SHORT DESC', isSpecial: false, prefix: 'VA2210-GENERATE-SHORT DESC' },
    { id: 'VA2220-EDIT-SHORT-DESC', label: 'VA2220-EDIT-SHORT DESC', isSpecial: false, prefix: 'VA2220-EDIT-SHORT DESC' },
    { id: 'VA2310-GENERATE-DSL', label: 'VA2310-GENERATE-DSL', isSpecial: false, prefix: 'VA2310-GENERATE-DSL' },
    { id: 'VA2320-EDIT-DSL', label: 'VA2320-EDIT-DSL', isSpecial: false, prefix: 'VA2320-EDIT-DSL' },
  ];

  // Get prefix for a type
  const getPrefix = (type: string): string => {
    const tab = subtabs.find(t => t.id === type);
    return tab?.prefix || type;
  };

  // Get versions from DB only (sample data is now in DB)
  const getVersions = (type: string): ConfigVersion[] => {
    return getVersionsForType(type);
  };

  // Get content for selected version
  const getContent = (type: string, selectedId: string | null, fallback: string): string => {
    if (editableContent[type] !== undefined) return editableContent[type];
    if (selectedId) {
      const config = getConfigById(selectedId);
      if (config) return config.content || '';
    }
    return fallback;
  };

  // Get notes for selected version
  const getNotes = (type: string, selectedId: string | null, fallback: string): string => {
    if (editableNotes[type] !== undefined) return editableNotes[type];
    if (selectedId) {
      const config = getConfigById(selectedId);
      if (config) return config.important_notes || '';
    }
    return fallback;
  };

  const handleVersionSelect = (type: string, versionId: string) => {
    setSelectedVersions(prev => ({ ...prev, [type]: versionId }));
    // Clear editable state to load from DB
    setEditableContent(prev => {
      const next = { ...prev };
      delete next[type];
      return next;
    });
    setEditableNotes(prev => {
      const next = { ...prev };
      delete next[type];
      return next;
    });
  };

  const handleSave = async (type: string) => {
    const selectedId = selectedVersions[type];
    const config = selectedId ? getConfigById(selectedId) : null;
    const content = getContent(type, selectedId, '');
    const notes = getNotes(type, selectedId, '');
    const prefix = getPrefix(type);
    
    if (config) {
      await saveConfig(type, config.version_name, content, notes, config.id);
    } else {
      // Create first version if none exists
      await createNewVersion(type, content, notes, prefix);
    }
  };

  const handleCreate = async (type: string) => {
    const selectedId = selectedVersions[type];
    const content = getContent(type, selectedId, '');
    const notes = getNotes(type, selectedId, '');
    const prefix = getPrefix(type);
    await createNewVersion(type, content, notes, prefix);
  };

  const handleDelete = async (id: string) => {
    await deleteConfig(id);
  };

  return (
    <Tabs value={activeSubtab} onValueChange={onSubtabChange} className="h-full flex flex-col">
      <div className="flex-1 min-h-0 p-2 overflow-hidden">
        {/* IRF-IR Functions Tab */}
        <TabsContent value="IRF-IR-FUNCTIONS" className="h-full m-0">
          <SimpleSubtab
            versions={getVersions('IRF-IR-FUNCTIONS')}
            selectedVersionId={selectedVersions['IRF-IR-FUNCTIONS'] || null}
            onVersionSelect={(id) => handleVersionSelect('IRF-IR-FUNCTIONS', id)}
            onVersionDelete={handleDelete}
            onVersionCreate={() => handleCreate('IRF-IR-FUNCTIONS')}
            onContentSave={() => handleSave('IRF-IR-FUNCTIONS')}
            versionsTitle="IRF Versions"
            contentTitle="#IRF-IntermediateRepresentationFunctions"
            content={getContent('IRF-IR-FUNCTIONS', selectedVersions['IRF-IR-FUNCTIONS'] || null, '')}
            zoomLevel={zoomLevel}
          />
        </TabsContent>

        {/* EDSL-ExampleDSL Tab */}
        <TabsContent value="EDSL-EXAMPLE-DSL" className="h-full m-0">
          <SimpleSubtab
            versions={getVersions('EDSL-EXAMPLE-DSL')}
            selectedVersionId={selectedVersions['EDSL-EXAMPLE-DSL'] || null}
            onVersionSelect={(id) => handleVersionSelect('EDSL-EXAMPLE-DSL', id)}
            onVersionDelete={handleDelete}
            onVersionCreate={() => handleCreate('EDSL-EXAMPLE-DSL')}
            onContentSave={() => handleSave('EDSL-EXAMPLE-DSL')}
            versionsTitle="EDSL Versions"
            contentTitle="#EDSL-ExampleDomainSpecificLanguage"
            content={getContent('EDSL-EXAMPLE-DSL', selectedVersions['EDSL-EXAMPLE-DSL'] || null, '')}
            zoomLevel={zoomLevel}
          />
        </TabsContent>

        {/* Regular Config Subtabs */}
        {subtabs.filter(tab => !tab.isSpecial).map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="h-full m-0">
            <ConfigSubtab
              versions={getVersions(tab.id)}
              selectedVersionId={selectedVersions[tab.id] || null}
              onVersionSelect={(id) => handleVersionSelect(tab.id, id)}
              onVersionDelete={handleDelete}
              onVersionCreate={() => handleCreate(tab.id)}
              onSystemPromptSave={() => handleSave(tab.id)}
              systemPrompt={getContent(tab.id, selectedVersions[tab.id] || null, '')}
              onSystemPromptChange={(value) => setEditableContent(prev => ({ ...prev, [tab.id]: value }))}
              importantNotes={getNotes(tab.id, selectedVersions[tab.id] || null, '')}
              onImportantNotesChange={(value) => setEditableNotes(prev => ({ ...prev, [tab.id]: value }))}
              irfContent={getContent('IRF-IR-FUNCTIONS', selectedVersions['IRF-IR-FUNCTIONS'] || null, '')}
              edslContent={getContent('EDSL-EXAMPLE-DSL', selectedVersions['EDSL-EXAMPLE-DSL'] || null, '')}
              zoomLevel={zoomLevel}
            />
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
};

export default ConfigPanel;
