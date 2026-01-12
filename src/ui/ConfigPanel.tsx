import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Save, Trash2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfigVersion {
  id: string;
  name: string;
  timestamp: string;
  isActive?: boolean;
}

interface ConfigSubtabProps {
  versions: ConfigVersion[];
  selectedVersionId: string | null;
  onVersionSelect: (id: string) => void;
  onVersionDelete?: (id: string) => void;
  onVersionCreate?: () => void;
  onSystemPromptSave?: () => void;
  systemPrompt: string;
  fullPrompt: string;
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
  fullPrompt,
  zoomLevel = 100,
}) => {
  const scale = zoomLevel / 100;

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
      <div className="col-span-2 h-full min-h-0 overflow-hidden border border-border rounded-lg bg-card">
        <div className="h-8 px-3 flex items-center justify-between border-b border-border bg-muted/50">
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
        <ScrollArea className="h-[calc(100%-2rem)]">
          <pre
            className="p-4 text-xs text-foreground whitespace-pre-wrap font-mono"
            style={{ fontSize: `${0.75 * scale}rem`, lineHeight: 1.6 }}
          >
            {systemPrompt || 'No system prompt configured'}
          </pre>
        </ScrollArea>
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

// Sample data for each subtab
const createSampleVersions = (prefix: string): ConfigVersion[] => [
  { id: `${prefix}-v3`, name: `${prefix} v3.0`, timestamp: '2024-01-12 14:30', isActive: true },
  { id: `${prefix}-v2`, name: `${prefix} v2.1`, timestamp: '2024-01-10 09:15' },
  { id: `${prefix}-v1`, name: `${prefix} v1.0`, timestamp: '2024-01-08 16:45' },
];

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
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ zoomLevel = 100 }) => {
  const [selectedVersions, setSelectedVersions] = useState<Record<string, string | null>>({
    'VA1120-EXTRACT-DESC': 'VA1120-EXTRACT-DESC-v3',
    'VA1210-GENERATE-DSL': 'VA1210-GENERATE-DSL-v3',
    'VA2210-GENERATE-SHORT-DESC': 'VA2210-GENERATE-SHORT-DESC-v3',
    'VA2220-EDIT-SHORT-DESC': 'VA2220-EDIT-SHORT-DESC-v3',
    'VA2310-GENERATE-DSL': 'VA2310-GENERATE-DSL-v3',
    'VA2320-EDIT-DSL': 'VA2320-EDIT-DSL-v3',
  });

  const handleVersionSelect = (tab: string, versionId: string) => {
    setSelectedVersions(prev => ({ ...prev, [tab]: versionId }));
  };

  const subtabs = [
    { id: 'VA1120-EXTRACT-DESC', label: 'VA1120-EXTRACT-DESC' },
    { id: 'VA1210-GENERATE-DSL', label: 'VA1210-GENERATE-DSL' },
    { id: 'VA2210-GENERATE-SHORT-DESC', label: 'VA2210-GENERATE-SHORT DESC' },
    { id: 'VA2220-EDIT-SHORT-DESC', label: 'VA2220-EDIT-SHORT DESC' },
    { id: 'VA2310-GENERATE-DSL', label: 'VA2310-GENERATE-DSL' },
    { id: 'VA2320-EDIT-DSL', label: 'VA2320-EDIT-DSL' },
  ];

  return (
    <Tabs defaultValue="VA1120-EXTRACT-DESC" className="h-full flex flex-col">
      <div className="shrink-0 border-b border-border/50 px-2 pt-1">
        <TabsList className="bg-transparent h-auto flex-wrap gap-1 p-0">
          {subtabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="text-[0.65rem] px-2 py-1 h-6 data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <div className="flex-1 min-h-0 p-2 overflow-hidden">
        {subtabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="h-full m-0">
            <ConfigSubtab
              versions={createSampleVersions(tab.id)}
              selectedVersionId={selectedVersions[tab.id]}
              onVersionSelect={(id) => handleVersionSelect(tab.id, id)}
              systemPrompt={sampleSystemPrompts[tab.id] || ''}
              fullPrompt={sampleFullPrompts[tab.id] || ''}
              zoomLevel={zoomLevel}
            />
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
};

export default ConfigPanel;
