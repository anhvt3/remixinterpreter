import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  content: string;
  zoomLevel?: number;
}

const ConfigSubtab: React.FC<ConfigSubtabProps> = ({
  versions,
  selectedVersionId,
  onVersionSelect,
  content,
  zoomLevel = 100,
}) => {
  const scale = zoomLevel / 100;

  return (
    <div className="grid grid-cols-3 gap-2 h-full">
      {/* Versions Panel - Left 1/3 */}
      <div className="h-full min-h-0 overflow-hidden border border-border rounded-lg bg-card">
        <div className="h-8 px-3 flex items-center border-b border-border bg-muted/50">
          <span className="text-xs font-medium text-muted-foreground">Versions</span>
        </div>
        <ScrollArea className="h-[calc(100%-2rem)]">
          <div className="p-2 space-y-1" style={{ fontSize: `${scale}rem` }}>
            {versions.map((version) => (
              <button
                key={version.id}
                onClick={() => onVersionSelect(version.id)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md text-xs transition-colors",
                  selectedVersionId === version.id
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="font-medium">{version.name}</div>
                <div className="text-[0.65rem] opacity-70 mt-0.5">{version.timestamp}</div>
                {version.isActive && (
                  <span className="inline-block mt-1 px-1.5 py-0.5 text-[0.6rem] bg-accent/20 text-accent rounded">
                    Active
                  </span>
                )}
              </button>
            ))}
            {versions.length === 0 && (
              <div className="text-xs text-muted-foreground p-3 text-center">
                No versions available
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Content Panel - Right 2/3 */}
      <div className="col-span-2 h-full min-h-0 overflow-hidden border border-border rounded-lg bg-card">
        <div className="h-8 px-3 flex items-center border-b border-border bg-muted/50">
          <span className="text-xs font-medium text-muted-foreground">Content</span>
        </div>
        <ScrollArea className="h-[calc(100%-2rem)]">
          <pre
            className="p-4 text-xs text-foreground whitespace-pre-wrap font-mono"
            style={{ fontSize: `${0.75 * scale}rem`, lineHeight: 1.6 }}
          >
            {content || 'No content selected'}
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

const sampleContent: Record<string, string> = {
  'VA1120-EXTRACT-DESC': `# VA1120 - Extract Description Configuration

## Purpose
Extracts natural language descriptions from learning objectives.

## Parameters
- input_format: text/markdown
- output_format: structured_json
- max_tokens: 2048
- temperature: 0.3

## Pipeline Steps
1. Parse input LO content
2. Identify key concepts and relationships
3. Generate structured description
4. Validate output schema`,

  'VA1210-GENERATE-DSL': `# VA1210 - Generate DSL Configuration

## Purpose
Converts descriptions to AnimYAML DSL format.

## Parameters
- dsl_version: 2.0
- strict_mode: true
- include_comments: true

## Transformation Rules
1. Map concepts to visual elements
2. Define animation sequences
3. Set timing parameters
4. Generate function definitions`,

  'VA2210-GENERATE-SHORT-DESC': `# VA2210 - Generate Short Description

## Purpose
Creates concise summaries from full descriptions.

## Parameters
- max_length: 280
- preserve_keywords: true
- style: technical

## Output Format
Single paragraph, action-oriented language`,

  'VA2220-EDIT-SHORT-DESC': `# VA2220 - Edit Short Description

## Purpose
Refine and edit generated short descriptions.

## Editing Guidelines
- Maintain technical accuracy
- Improve readability
- Ensure consistency with source material

## Validation
- Character limit check
- Keyword preservation verification`,

  'VA2310-GENERATE-DSL': `# VA2310 - Generate DSL (Advanced)

## Purpose
Advanced DSL generation with extended features.

## Parameters
- dsl_version: 2.0
- enable_macros: true
- optimization_level: 2

## Features
- Template expansion
- Macro definitions
- Conditional compilation`,

  'VA2320-EDIT-DSL': `# VA2320 - Edit DSL

## Purpose
Manual editing and refinement of generated DSL.

## Editor Features
- Syntax highlighting
- Real-time validation
- Auto-completion

## Validation Rules
- Schema compliance
- Reference resolution
- Type checking`,
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
              content={sampleContent[tab.id] || ''}
              zoomLevel={zoomLevel}
            />
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
};

export default ConfigPanel;
