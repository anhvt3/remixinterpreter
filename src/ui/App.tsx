import React, { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CodePanel } from './CodePanel';
import { ChatPanel } from './ChatPanel';
import { AnimPanelWithControls } from './AnimPanelWithControls';
import { YAMLScriptPanel, DEFAULT_DSL_PANEL_STATE, type DSLPanelState } from './YAMLScriptPanel';
import { RuntimePanel, type RuntimeStep } from './RuntimePanel';
import { loadYAML } from '../core/yamlLoader';
import { validateSchema } from '../core/schemaValidator';
import { executeWithTrace } from '../core/runtimeTracer';
import type { TimelineEvent, YAMLSpec, Params } from '../core/types';
import exampleYaml from '../fixtures/example.yaml?raw';
import yaml from 'js-yaml';

// Extract only the params section from the full YAML
function extractParams(fullYaml: string): string {
  try {
    const spec = yaml.load(fullYaml) as YAMLSpec;
    return yaml.dump({ params: spec.params }, { indent: 2, lineWidth: -1 });
  } catch {
    return '# Error parsing YAML';
  }
}

// Merge edited params back into the full spec
function mergeParams(fullYaml: string, paramsYaml: string): string {
  try {
    const fullSpec = yaml.load(fullYaml) as YAMLSpec;
    const paramsObj = yaml.load(paramsYaml) as { params: YAMLSpec['params'] };
    fullSpec.params = paramsObj.params;
    return yaml.dump(fullSpec, { indent: 2, lineWidth: -1 });
  } catch {
    return fullYaml; // Return original if merge fails
  }
}

// ============================================================
// REUSABLE PANEL COMPONENTS
// These are the core panels used across all tabs
// ============================================================

// LO Panel - Learning Objective content editor
interface LOPanelProps {
  content: string;
  onChange: (value: string) => void;
}
const LOPanel: React.FC<LOPanelProps> = ({ content, onChange }) => (
  <CodePanel
    title="LO"
    content={content}
    onChange={onChange}
    language="text"
  />
);

// Desc Panel - Description content editor
interface DescPanelProps {
  content: string;
  onChange: (value: string) => void;
}
const DescPanel: React.FC<DescPanelProps> = ({ content, onChange }) => (
  <CodePanel
    title="Desc"
    content={content}
    onChange={onChange}
    language="text"
  />
);

// Anim Panel - Animation preview with controls
interface AnimPanelProps {
  events: TimelineEvent[];
  selectedElementId?: string | null;
  onElementClick?: (elementId: string) => void;
}
const AnimPanel: React.FC<AnimPanelProps> = (props) => (
  <AnimPanelWithControls {...props} />
);

// Chat Panel - Chat interface (re-exported for clarity)
// Already exported from ChatPanel.tsx

// ============================================================
// MAIN APP COMPONENT
// ============================================================

export const App: React.FC = () => {
  const [fullYamlContent, setFullYamlContent] = useState(exampleYaml);
  const [loContent, setLoContent] = useState('# LO Content\n\nThis panel shows the Learning Objective or high-level description of the animation.');
  const [descContent, setDescContent] = useState('# Description\n\nThis panel shows the natural language description that can be converted to DSL.');
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [runtimeSteps, setRuntimeSteps] = useState<RuntimeStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [parsedSpec, setParsedSpec] = useState<YAMLSpec | null>(null);
  
  // Persistent DSL panel state (survives tab switches)
  const [dslPanelState, setDslPanelState] = useState<DSLPanelState>(DEFAULT_DSL_PANEL_STATE);
  
  // Extract editable params from full YAML
  const paramsContent = useMemo(() => extractParams(fullYamlContent), [fullYamlContent]);
  
  // Build mapping from YAML sections to element IDs
  const yamlToElementMap = useMemo(() => {
    const map: Record<string, string> = {};
    const lines = paramsContent.split('\n');
    
    // Map layout sections to element IDs
    let currentSection = '';
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (trimmed === 'title_at:') currentSection = 'title';
      else if (trimmed === 'prompt_at:') currentSection = 'prompt';
      else if (trimmed === 'ladder:') currentSection = 'ladder';
      else if (trimmed === 'line_at:') currentSection = 'factline';
      
      if (currentSection) {
        map[idx.toString()] = currentSection;
      }
    });
    
    // Also map style sections
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('title:') && line.includes('color')) map[idx.toString()] = 'title';
      if (trimmed.startsWith('text:') && line.includes('color')) map[idx.toString()] = 'text';
      if (trimmed.startsWith('final:') && line.includes('color')) map[idx.toString()] = 'factline';
    });
    
    return map;
  }, [paramsContent]);
  
  // Build reverse map: element ID to line numbers
  const elementToLinesMap = useMemo(() => {
    const map: Record<string, number[]> = {};
    Object.entries(yamlToElementMap).forEach(([lineNum, elementId]) => {
      if (!map[elementId]) map[elementId] = [];
      map[elementId].push(parseInt(lineNum));
    });
    return map;
  }, [yamlToElementMap]);
  
  // Handle params changes by merging back into full YAML (from code editor)
  const handleParamsChange = (newParams: string) => {
    const merged = mergeParams(fullYamlContent, newParams);
    setFullYamlContent(merged);
  };
  
  // Handle params object changes (from tree view editor)
  const handleParamsObjectChange = (newParams: Params) => {
    try {
      const fullSpec = yaml.load(fullYamlContent) as YAMLSpec;
      fullSpec.params = newParams;
      setFullYamlContent(yaml.dump(fullSpec, { indent: 2, lineWidth: -1 }));
    } catch (e) {
      console.error('Failed to update params:', e);
    }
  };
  
  // Handle function args changes (from tree view editor)
  const handleFunctionArgsChange = (fnName: string, stmtIndex: number, newArgs: Record<string, unknown>) => {
    try {
      const fullSpec = yaml.load(fullYamlContent) as YAMLSpec;
      if (fullSpec.defs && fullSpec.defs[fnName]) {
        const stmt = fullSpec.defs[fnName].body[stmtIndex];
        if (stmt) {
          if ('call' in stmt) {
            stmt.call.args = newArgs;
          } else if ('let' in stmt) {
            // newArgs is actually the new let statement
            (stmt as { let: Record<string, unknown> }).let = newArgs;
          } else if ('ir' in stmt) {
            stmt.ir.args = newArgs;
          }
          setFullYamlContent(yaml.dump(fullSpec, { indent: 2, lineWidth: -1 }));
        }
      }
    } catch (e) {
      console.error('Failed to update function args:', e);
    }
  };
  
  // Handle line click in YAML panel
  const handleLineClick = (lineIndex: number) => {
    const elementId = yamlToElementMap[lineIndex.toString()];
    if (elementId) {
      setSelectedElementId(elementId === selectedElementId ? null : elementId);
    }
  };
  
  // Handle element click in Anim panel
  const handleElementClick = (elementId: string) => {
    setSelectedElementId(elementId === selectedElementId ? null : elementId);
  };
  
  // Parse and execute YAML whenever it changes
  useEffect(() => {
    try {
      const spec = loadYAML(fullYamlContent);
      setParsedSpec(spec);
      const validation = validateSchema(spec);
      
      if (!validation.valid) {
        setError(validation.errors.join('\n'));
        return;
      }
      
      const result = executeWithTrace(spec);
      setEvents(result.timeline);
      setRuntimeSteps(result.steps);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setParsedSpec(null);
      setRuntimeSteps([]);
    }
  }, [fullYamlContent]);

  // Common DSL panel props with persistent state
  const dslPanelProps = {
    spec: parsedSpec,
    content: paramsContent,
    onChange: handleParamsChange,
    onParamsChange: handleParamsObjectChange,
    onFunctionArgsChange: handleFunctionArgsChange,
    panelState: dslPanelState,
    onPanelStateChange: setDslPanelState,
    highlightedElementId: selectedElementId,
  };

  // Common Anim panel props
  const animPanelProps = {
    events,
    selectedElementId,
    onElementClick: handleElementClick,
  };
  
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="h-12 px-4 flex items-center justify-between border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-foreground">AnimYAML Studio</h1>
          <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary">v2.0</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>schema_version: 2</span>
          <span className="text-border">•</span>
          <span>dialect: AnimYAML-DSL</span>
        </div>
      </header>
      
      {/* Error Banner */}
      {error && (
        <div className="px-4 py-2 bg-destructive/20 border-b border-destructive/30 text-destructive text-sm shrink-0">
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {/* Main Content */}
      <div className="flex-1 min-h-0">
        <Tabs defaultValue="dsl-anim" className="h-full flex flex-col">
          <div className="px-4 py-2 border-b border-border shrink-0">
            <TabsList className="bg-muted">
              <TabsTrigger value="lo-desc" className="text-xs">LO-Desc</TabsTrigger>
              <TabsTrigger value="desc-dsl" className="text-xs">Desc-DSL</TabsTrigger>
              <TabsTrigger value="dsl-anim" className="text-xs">DSL-Anim</TabsTrigger>
              <TabsTrigger value="dsl-runtime" className="text-xs">DSL-Runtime</TabsTrigger>
            </TabsList>
          </div>
          
          <div className="flex-1 min-h-0 p-2 overflow-hidden">
            {/* LO-Desc Tab: LO | Desc | Chat */}
            <TabsContent value="lo-desc" className="h-full m-0">
              <div className="grid grid-cols-3 gap-2 h-full">
                <div className="h-full min-h-0 overflow-hidden">
                  <LOPanel content={loContent} onChange={setLoContent} />
                </div>
                <div className="h-full min-h-0 overflow-hidden">
                  <DescPanel content={descContent} onChange={setDescContent} />
                </div>
                <div className="h-full min-h-0 overflow-hidden">
                  <ChatPanel title="Chat" />
                </div>
              </div>
            </TabsContent>
            
            {/* Desc-DSL Tab: Desc | DSL | Chat */}
            <TabsContent value="desc-dsl" className="h-full m-0">
              <div className="grid grid-cols-3 gap-2 h-full">
                <div className="h-full min-h-0 overflow-hidden">
                  <DescPanel content={descContent} onChange={setDescContent} />
                </div>
                <div className="h-full min-h-0 overflow-hidden">
                  <YAMLScriptPanel {...dslPanelProps} />
                </div>
                <div className="h-full min-h-0 overflow-hidden">
                  <ChatPanel title="Chat" />
                </div>
              </div>
            </TabsContent>
            
            {/* DSL-Anim Tab: DSL | Anim | Chat */}
            <TabsContent value="dsl-anim" className="h-full m-0">
              <div className="grid grid-cols-3 gap-2 h-full">
                <div className="h-full min-h-0 overflow-hidden">
                  <YAMLScriptPanel
                    {...dslPanelProps}
                    onLineClick={handleLineClick}
                    highlightedLines={selectedElementId ? elementToLinesMap[selectedElementId] || [] : []}
                  />
                </div>
                <div className="h-full min-h-0 overflow-hidden">
                  <AnimPanel {...animPanelProps} />
                </div>
                <div className="h-full min-h-0 overflow-hidden">
                  <ChatPanel title="Chat" />
                </div>
              </div>
            </TabsContent>
            
            {/* DSL-Runtime Tab: DSL | Runtime | Anim */}
            <TabsContent value="dsl-runtime" className="h-full m-0">
              <div className="grid grid-cols-3 gap-2 h-full">
                <div className="h-full min-h-0 overflow-hidden">
                  <YAMLScriptPanel {...dslPanelProps} />
                </div>
                <div className="h-full min-h-0 overflow-hidden">
                  <RuntimePanel steps={runtimeSteps} />
                </div>
                <div className="h-full min-h-0 overflow-hidden">
                  <AnimPanel {...animPanelProps} />
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default App;
