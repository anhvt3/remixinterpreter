import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CodePanel } from './CodePanel';
import { ChatPanel } from './ChatPanel';
import { AnimPanelWithControls } from './AnimPanelWithControls';
import { YAMLScriptPanel, DEFAULT_DSL_PANEL_STATE, type DSLPanelState } from './YAMLScriptPanel';
import { RuntimePanel, type RuntimeStep } from './RuntimePanel';
import { loadYAML } from '../core/yamlLoader';
import { validateSchema } from '../core/schemaValidator';
import { executeWithTrace, type CallChainEntry } from '../core/runtimeTracer';
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
  zoomLevel?: number;
}
const LOPanel: React.FC<LOPanelProps> = ({ content, onChange, zoomLevel = 100 }) => (
  <CodePanel
    title="LO"
    content={content}
    onChange={onChange}
    language="text"
    zoomLevel={zoomLevel}
  />
);

// Desc Panel - Description content editor
interface DescPanelProps {
  content: string;
  onChange: (value: string) => void;
  zoomLevel?: number;
}
const DescPanel: React.FC<DescPanelProps> = ({ content, onChange, zoomLevel = 100 }) => (
  <CodePanel
    title="Desc"
    content={content}
    onChange={onChange}
    language="text"
    zoomLevel={zoomLevel}
  />
);

// Anim Panel - Animation preview with controls
interface AnimPanelProps {
  events: TimelineEvent[];
  selectedElementId?: string | null;
  highlightedElementIds?: string[];
  onElementClick?: (elementId: string) => void;
  zoomLevel?: number;
}
const AnimPanel: React.FC<AnimPanelProps> = ({ zoomLevel, highlightedElementIds, ...props }) => (
  <AnimPanelWithControls {...props} highlightedElementIds={highlightedElementIds} zoomLevel={zoomLevel} />
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
  const [elementCallChains, setElementCallChains] = useState<Map<string, CallChainEntry[]>>(new Map());
  const [stepCallChains, setStepCallChains] = useState<Map<string, CallChainEntry[]>>(new Map());
  const [stepCreatedElements, setStepCreatedElements] = useState<Map<string, string[]>>(new Map());
  const [selectedRuntimeStepId, setSelectedRuntimeStepId] = useState<string | null>(null);
  const [selectedStatement, setSelectedStatement] = useState<{ fnName: string; stmtIndex: number } | null>(null);
  const [selectedFunctionDefinition, setSelectedFunctionDefinition] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(100);

  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev + 10, 150));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev - 10, 50));
  }, []);
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
      setElementCallChains(result.elementCallChains);
      setStepCallChains(result.stepCallChains);
      setStepCreatedElements(result.stepCreatedElements);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setParsedSpec(null);
      setRuntimeSteps([]);
      setElementCallChains(new Map());
      setStepCallChains(new Map());
      setStepCreatedElements(new Map());
    }
  }, [fullYamlContent]);

  // Get call chain for the selected element (when clicking Anim panel)
  const selectedElementCallChain = useMemo(() => {
    if (!selectedElementId) return null;
    return elementCallChains.get(selectedElementId) || null;
  }, [selectedElementId, elementCallChains]);

  // Get call chain for the selected runtime step (when clicking Runtime panel)
  const selectedStepCallChain = useMemo(() => {
    if (!selectedRuntimeStepId) return null;
    return stepCallChains.get(selectedRuntimeStepId) || null;
  }, [selectedRuntimeStepId, stepCallChains]);

  // Get element IDs created by selected runtime step (for Anim panel highlighting)
  // Recursively collect elements from the step and all its children
  const highlightedElementIds = useMemo(() => {
    if (!selectedRuntimeStepId) return [];
    
    // Find the step by ID recursively
    const findStep = (steps: RuntimeStep[], id: string): RuntimeStep | null => {
      for (const step of steps) {
        if (step.id === id) return step;
        if (step.children) {
          const found = findStep(step.children, id);
          if (found) return found;
        }
      }
      return null;
    };
    
    // Collect all element IDs from a step and its descendants
    const collectElements = (step: RuntimeStep): string[] => {
      const ids: string[] = [...(step.createdElementIds || [])];
      if (step.children) {
        for (const child of step.children) {
          ids.push(...collectElements(child));
        }
      }
      return ids;
    };
    
    const selectedStep = findStep(runtimeSteps, selectedRuntimeStepId);
    if (!selectedStep) return [];
    
    return collectElements(selectedStep);
  }, [selectedRuntimeStepId, runtimeSteps]);

  // Find runtime step IDs matching the selected statement
  const highlightedStepIdsFromStatement = useMemo(() => {
    if (!selectedStatement) return [];
    
    const matchingStepIds: string[] = [];
    
    // Debug: log what we're looking for
    console.log('Looking for statement:', selectedStatement);
    console.log('stepCallChains size:', stepCallChains.size);
    
    // Check each step's call chain to see if it was created by the selected statement
    stepCallChains.forEach((callChain, stepId) => {
      // callChain is ordered innermost first - check if any entry matches
      const matches = callChain.some(
        entry => entry.fnName === selectedStatement.fnName && entry.stmtIndex === selectedStatement.stmtIndex
      );
      if (matches) {
        matchingStepIds.push(stepId);
        console.log('Match found:', stepId, 'chain:', callChain);
      }
    });
    
    console.log('Total matches:', matchingStepIds.length);
    return matchingStepIds;
  }, [selectedStatement, stepCallChains]);

  // Collect element IDs from highlighted steps AND their children recursively
  // This ensures all elements created by a statement and its called statements are highlighted
  const highlightedElementIdsFromStatement = useMemo(() => {
    if (!selectedStatement || highlightedStepIdsFromStatement.length === 0) return [];
    
    // Find step by ID recursively
    const findStep = (steps: RuntimeStep[], id: string): RuntimeStep | null => {
      for (const step of steps) {
        if (step.id === id) return step;
        if (step.children) {
          const found = findStep(step.children, id);
          if (found) return found;
        }
      }
      return null;
    };
    
    // Collect all element IDs from a step and its descendants
    const collectElements = (step: RuntimeStep): string[] => {
      const ids: string[] = [...(step.createdElementIds || [])];
      if (step.children) {
        for (const child of step.children) {
          ids.push(...collectElements(child));
        }
      }
      return ids;
    };
    
    const elementIds: string[] = [];
    for (const stepId of highlightedStepIdsFromStatement) {
      // Get elements directly from stepCreatedElements map
      const directElements = stepCreatedElements.get(stepId);
      if (directElements) {
        elementIds.push(...directElements);
      }
      
      // Also recursively collect from children
      const step = findStep(runtimeSteps, stepId);
      if (step) {
        elementIds.push(...collectElements(step));
      }
    }
    return [...new Set(elementIds)];
  }, [selectedStatement, highlightedStepIdsFromStatement, stepCreatedElements, runtimeSteps]);

  // Find runtime step IDs matching all calls to the selected function definition
  const highlightedStepIdsFromFunctionDef = useMemo(() => {
    if (!selectedFunctionDefinition) return [];
    
    const matchingStepIds: string[] = [];
    
    // Check each step's call chain to see if it involves a call to the selected function
    stepCallChains.forEach((callChain, stepId) => {
      // Check if any entry in the call chain is a call to the selected function
      const matches = callChain.some(entry => entry.fnName === selectedFunctionDefinition);
      if (matches) {
        matchingStepIds.push(stepId);
      }
    });
    
    return matchingStepIds;
  }, [selectedFunctionDefinition, stepCallChains]);

  // Collect element IDs from highlighted steps for function definition click (recursive)
  const highlightedElementIdsFromFunctionDef = useMemo(() => {
    if (!selectedFunctionDefinition || highlightedStepIdsFromFunctionDef.length === 0) return [];
    
    // Find step by ID recursively
    const findStep = (steps: RuntimeStep[], id: string): RuntimeStep | null => {
      for (const step of steps) {
        if (step.id === id) return step;
        if (step.children) {
          const found = findStep(step.children, id);
          if (found) return found;
        }
      }
      return null;
    };
    
    // Collect all element IDs from a step and its descendants
    const collectElements = (step: RuntimeStep): string[] => {
      const ids: string[] = [...(step.createdElementIds || [])];
      if (step.children) {
        for (const child of step.children) {
          ids.push(...collectElements(child));
        }
      }
      return ids;
    };
    
    const elementIds: string[] = [];
    for (const stepId of highlightedStepIdsFromFunctionDef) {
      const directElements = stepCreatedElements.get(stepId);
      if (directElements) {
        elementIds.push(...directElements);
      }
      
      const step = findStep(runtimeSteps, stepId);
      if (step) {
        elementIds.push(...collectElements(step));
      }
    }
    return [...new Set(elementIds)];
  }, [selectedFunctionDefinition, highlightedStepIdsFromFunctionDef, stepCreatedElements, runtimeSteps]);

  // Combined highlighted elements: from runtime step click, statement click, OR function definition click
  const combinedHighlightedElementIds = selectedRuntimeStepId 
    ? highlightedElementIds 
    : selectedStatement 
    ? highlightedElementIdsFromStatement 
    : highlightedElementIdsFromFunctionDef;
  
  // Combined highlighted step IDs for RuntimePanel
  const combinedHighlightedStepIds = selectedFunctionDefinition 
    ? highlightedStepIdsFromFunctionDef 
    : highlightedStepIdsFromStatement;
  
  const activeCallChain = selectedStepCallChain || selectedElementCallChain;

  // Compute loop range from selected runtime step's elements
  const loopRange = useMemo(() => {
    if (!selectedRuntimeStepId || combinedHighlightedElementIds.length === 0) return null;
    
    let minT0 = Infinity;
    let maxT1 = -Infinity;
    
    // Find time range from all events related to highlighted elements
    for (const event of events) {
      const args = event.args as { id?: string; t0?: number; t1?: number };
      if (args.id && combinedHighlightedElementIds.includes(args.id)) {
        if (typeof args.t0 === 'number' && args.t0 < minT0) minT0 = args.t0;
        if (typeof args.t1 === 'number' && args.t1 > maxT1) maxT1 = args.t1;
      }
    }
    
    if (minT0 === Infinity || maxT1 === -Infinity) return null;
    
    // Add a small buffer after for visibility
    return { start: Math.max(0, minT0 - 0.2), end: maxT1 + 0.5 };
  }, [selectedRuntimeStepId, combinedHighlightedElementIds, events]);

  // Compute static elements: all elements created BEFORE the loopRange starts
  // These are shown at their final state while the selected step loops
  const staticElementIds = useMemo(() => {
    if (!selectedRuntimeStepId || !loopRange) return [];
    
    const staticIds: string[] = [];
    const loopStart = loopRange.start + 0.2; // Account for the buffer we added
    
    // Find all elements whose animations complete before the loop starts
    for (const event of events) {
      if (event.type === 'text.create' || event.type === 'text.update') {
        const args = event.args as { id?: string; t1?: number };
        if (args.id && typeof args.t1 === 'number') {
          // If this element completes before the loop and is NOT part of the highlighted set
          if (args.t1 <= loopStart && !combinedHighlightedElementIds.includes(args.id)) {
            staticIds.push(args.id);
          }
        }
      }
    }
    
    return [...new Set(staticIds)];
  }, [selectedRuntimeStepId, loopRange, events, combinedHighlightedElementIds]);

  // Handle runtime step click
  const handleRuntimeStepClick = useCallback((step: RuntimeStep) => {
    if (selectedRuntimeStepId === step.id) {
      // Deselect if clicking same step
      setSelectedRuntimeStepId(null);
      setSelectedElementId(null);
    } else {
      setSelectedRuntimeStepId(step.id);
      // Clear other selections when selecting a runtime step
      setSelectedElementId(null);
      setSelectedStatement(null);
      setSelectedFunctionDefinition(null);
    }
  }, [selectedRuntimeStepId]);

  // Handle element click in Anim panel (modified to clear runtime step selection)
  const handleElementClickWithClear = useCallback((elementId: string) => {
    setSelectedRuntimeStepId(null);
    setSelectedStatement(null);
    setSelectedFunctionDefinition(null);
    setSelectedElementId(elementId === selectedElementId ? null : elementId);
  }, [selectedElementId]);

  // Handle statement click in TreeView
  const handleStatementClick = useCallback((fnName: string, stmtIndex: number) => {
    console.log('handleStatementClick called:', fnName, stmtIndex);
    if (selectedStatement?.fnName === fnName && selectedStatement?.stmtIndex === stmtIndex) {
      setSelectedStatement(null);
    } else {
      setSelectedStatement({ fnName, stmtIndex });
      setSelectedRuntimeStepId(null);
      setSelectedElementId(null);
      setSelectedFunctionDefinition(null);
    }
  }, [selectedStatement]);

  // Handle function definition click in TreeView
  const handleFunctionDefinitionClick = useCallback((fnName: string) => {
    if (selectedFunctionDefinition === fnName) {
      setSelectedFunctionDefinition(null);
    } else {
      setSelectedFunctionDefinition(fnName);
      setSelectedRuntimeStepId(null);
      setSelectedElementId(null);
      setSelectedStatement(null);
    }
  }, [selectedFunctionDefinition]);

  const dslPanelProps = {
    spec: parsedSpec,
    content: paramsContent,
    onChange: handleParamsChange,
    onParamsChange: handleParamsObjectChange,
    onFunctionArgsChange: handleFunctionArgsChange,
    panelState: dslPanelState,
    onPanelStateChange: setDslPanelState,
    highlightedElementId: selectedElementId,
    elementCallChain: activeCallChain,
    zoomLevel,
    onStatementClick: handleStatementClick,
    selectedStatement,
    onFunctionDefinitionClick: handleFunctionDefinitionClick,
    selectedFunctionDefinition,
  };

  // Common Anim panel props
  const animPanelProps = {
    events,
    selectedElementId,
    highlightedElementIds: combinedHighlightedElementIds,
    staticElementIds,
    onElementClick: handleElementClickWithClear,
    zoomLevel,
    loopRange,
  };
  
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="h-12 px-4 flex items-center justify-between border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-foreground">AnimYAML Studio</h1>
          <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary glow-primary">v2.0</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>schema_version: 2</span>
            <span className="text-border">•</span>
            <span>dialect: AnimYAML-DSL</span>
          </div>
          <div className="flex items-center gap-1 border-l border-border pl-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover-glow"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 50}
              title="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground w-10 text-center">{zoomLevel}%</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover-glow"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 150}
              title="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
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
                  <LOPanel content={loContent} onChange={setLoContent} zoomLevel={zoomLevel} />
                </div>
                <div className="h-full min-h-0 overflow-hidden">
                  <DescPanel content={descContent} onChange={setDescContent} zoomLevel={zoomLevel} />
                </div>
                <div className="h-full min-h-0 overflow-hidden">
                  <ChatPanel title="Chat" zoomLevel={zoomLevel} />
                </div>
              </div>
            </TabsContent>
            
            {/* Desc-DSL Tab: Desc | DSL | Chat */}
            <TabsContent value="desc-dsl" className="h-full m-0">
              <div className="grid grid-cols-3 gap-2 h-full">
                <div className="h-full min-h-0 overflow-hidden">
                  <DescPanel content={descContent} onChange={setDescContent} zoomLevel={zoomLevel} />
                </div>
                <div className="h-full min-h-0 overflow-hidden">
                  <YAMLScriptPanel {...dslPanelProps} />
                </div>
                <div className="h-full min-h-0 overflow-hidden">
                  <ChatPanel title="Chat" zoomLevel={zoomLevel} />
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
                  <ChatPanel title="Chat" zoomLevel={zoomLevel} />
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
                  <RuntimePanel 
                    steps={runtimeSteps} 
                    elementCallChain={selectedElementCallChain} 
                    zoomLevel={zoomLevel}
                    onStepClick={handleRuntimeStepClick}
                    selectedStepId={selectedRuntimeStepId}
                    highlightedStepIds={combinedHighlightedStepIds}
                    stepCallChains={stepCallChains}
                  />
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
