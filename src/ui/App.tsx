import React, { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CodePanel } from './CodePanel';
import { ChatPanel } from './ChatPanel';
import { AnimPanelWithControls } from './AnimPanelWithControls';
import { TimelineDebugPanel } from './TimelineDebugPanel';
import { YAMLScriptPanel } from './YAMLScriptPanel';
import { RuntimePanel, type RuntimeStep } from './RuntimePanel';
import { loadYAML } from '../core/yamlLoader';
import { validateSchema } from '../core/schemaValidator';
import { executeWithTrace } from '../core/runtimeTracer';
import type { TimelineEvent, YAMLSpec, Params } from '../core/types';
import { type ProvenanceMap, type CreatorMap, type AnimatorMap, makeStatementKey } from '../core/provenanceTracker';
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

export const App: React.FC = () => {
  const [fullYamlContent, setFullYamlContent] = useState(exampleYaml);
  const [loContent, setLoContent] = useState('# LO Content\n\nThis panel shows the Learning Objective or high-level description of the animation.');
  const [descContent, setDescContent] = useState('# Description\n\nThis panel shows the natural language description that can be converted to DSL.');
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [runtimeSteps, setRuntimeSteps] = useState<RuntimeStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedStatement, setSelectedStatement] = useState<{ fnName: string; stmtIndex: number } | null>(null);
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [parsedSpec, setParsedSpec] = useState<YAMLSpec | null>(null);
  
  // Provenance tracking
  const [provenance, setProvenance] = useState<ProvenanceMap>(new Map());
  const [creatorMap, setCreatorMap] = useState<CreatorMap>(new Map());
  const [animatorMap, setAnimatorMap] = useState<AnimatorMap>(new Map());
  
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
  
  // Handle statement click in YAMLTree panel
  const handleStatementClick = (fnName: string, stmtIndex: number) => {
    const key = makeStatementKey(fnName, stmtIndex);
    
    // Check if this statement creates or animates elements
    const createdElements = creatorMap.get(key) || [];
    const animatedElements = animatorMap.get(key) || [];
    const allElements = [...new Set([...createdElements, ...animatedElements])];
    
    if (allElements.length > 0) {
      // Toggle selection
      if (selectedStatement?.fnName === fnName && selectedStatement?.stmtIndex === stmtIndex) {
        setSelectedStatement(null);
        setSelectedElementId(null);
      } else {
        setSelectedStatement({ fnName, stmtIndex });
        // Select the first element for primary highlight
        setSelectedElementId(allElements[0]);
      }
    }
  };
  
  // Handle element click in Anim panel - find the creator statement
  const handleElementClick = (elementId: string) => {
    const prov = provenance.get(elementId);
    if (prov) {
      // Toggle selection
      if (selectedElementId === elementId) {
        setSelectedElementId(null);
        setSelectedStatement(null);
      } else {
        setSelectedElementId(elementId);
        setSelectedStatement({
          fnName: prov.creatorFn,
          stmtIndex: prov.creatorStmtIndex,
        });
      }
    } else {
      setSelectedElementId(elementId === selectedElementId ? null : elementId);
    }
  };
  
  // Handle element hover - show animator relationships
  const handleElementHover = (elementId: string | null) => {
    setHoveredElementId(elementId);
  };
  
  // Compute which elements should be highlighted (primary + secondary)
  const highlightedElements = useMemo(() => {
    const primary: string[] = [];
    const secondary: string[] = [];
    
    if (selectedStatement) {
      const key = makeStatementKey(selectedStatement.fnName, selectedStatement.stmtIndex);
      const created = creatorMap.get(key) || [];
      const animated = animatorMap.get(key) || [];
      primary.push(...created);
      secondary.push(...animated.filter(id => !created.includes(id)));
    } else if (selectedElementId) {
      primary.push(selectedElementId);
      // Add animated elements as secondary
      const prov = provenance.get(selectedElementId);
      if (prov) {
        for (const animator of prov.animators) {
          const animKey = makeStatementKey(animator.fn, animator.stmtIndex);
          const animated = animatorMap.get(animKey) || [];
          secondary.push(...animated.filter(id => id !== selectedElementId));
        }
      }
    }
    
    return { primary, secondary };
  }, [selectedStatement, selectedElementId, creatorMap, animatorMap, provenance]);
  
  // Compute which statements should be highlighted
  const highlightedStatements = useMemo(() => {
    const primary: { fnName: string; stmtIndex: number }[] = [];
    const secondary: { fnName: string; stmtIndex: number }[] = [];
    
    if (selectedElementId) {
      const prov = provenance.get(selectedElementId);
      if (prov) {
        // Creator is primary
        primary.push({ fnName: prov.creatorFn, stmtIndex: prov.creatorStmtIndex });
        // Animators are secondary
        for (const animator of prov.animators) {
          secondary.push({ fnName: animator.fn, stmtIndex: animator.stmtIndex });
        }
      }
    } else if (selectedStatement) {
      primary.push(selectedStatement);
    }
    
    // Add hovered element's relationships as tertiary hints
    if (hoveredElementId && hoveredElementId !== selectedElementId) {
      const prov = provenance.get(hoveredElementId);
      if (prov) {
        secondary.push({ fnName: prov.creatorFn, stmtIndex: prov.creatorStmtIndex });
      }
    }
    
    return { primary, secondary };
  }, [selectedElementId, selectedStatement, hoveredElementId, provenance]);
  
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
      setProvenance(result.provenance);
      setCreatorMap(result.creatorMap);
      setAnimatorMap(result.animatorMap);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setParsedSpec(null);
      setRuntimeSteps([]);
    }
  }, [fullYamlContent]);
  
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
            <TabsContent value="lo-desc" className="h-full m-0">
              <div className="grid grid-cols-3 gap-2 h-full">
                <CodePanel
                  title="LO"
                  content={loContent}
                  onChange={setLoContent}
                  language="text"
                />
                <CodePanel
                  title="Desc"
                  content={descContent}
                  onChange={setDescContent}
                  language="text"
                />
                <ChatPanel title="Chat" />
              </div>
            </TabsContent>
            
            <TabsContent value="desc-dsl" className="h-full m-0">
              <div className="grid grid-cols-3 gap-2 h-full">
                <CodePanel
                  title="Desc"
                  content={descContent}
                  onChange={setDescContent}
                  language="text"
                />
                <YAMLScriptPanel
                  spec={parsedSpec}
                  content={paramsContent}
                  onChange={handleParamsChange}
                  onParamsChange={handleParamsObjectChange}
                  onFunctionArgsChange={handleFunctionArgsChange}
                />
                <ChatPanel title="Chat" />
              </div>
            </TabsContent>
            
            <TabsContent value="dsl-anim" className="h-full m-0">
              <div className="grid grid-cols-3 gap-2 h-full">
                <YAMLScriptPanel
                  spec={parsedSpec}
                  content={paramsContent}
                  onChange={handleParamsChange}
                  onParamsChange={handleParamsObjectChange}
                  onFunctionArgsChange={handleFunctionArgsChange}
                  onStatementClick={handleStatementClick}
                  primaryStatements={highlightedStatements.primary}
                  secondaryStatements={highlightedStatements.secondary}
                />
                
                <AnimPanelWithControls 
                  events={events} 
                  selectedElementId={selectedElementId}
                  primaryElements={highlightedElements.primary}
                  secondaryElements={highlightedElements.secondary}
                  onElementClick={handleElementClick}
                  onElementHover={handleElementHover}
                />
                <div className="flex flex-col gap-2 h-full">
                  <div className="flex-1 min-h-0">
                    <ChatPanel title="Chat" />
                  </div>
                  <div className="h-1/3 min-h-0">
                    <TimelineDebugPanel events={events} />
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="dsl-runtime" className="h-full m-0">
              <div className="grid grid-cols-3 gap-2 h-full">
                <YAMLScriptPanel
                  spec={parsedSpec}
                  content={paramsContent}
                  onChange={handleParamsChange}
                  onParamsChange={handleParamsObjectChange}
                  onFunctionArgsChange={handleFunctionArgsChange}
                />
                
                {/* Runtime Trace Panel */}
                <RuntimePanel steps={runtimeSteps} />
                
                {/* Anim Panel */}
                <AnimPanelWithControls 
                  events={events} 
                  selectedElementId={selectedElementId}
                  onElementClick={handleElementClick}
                />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default App;
