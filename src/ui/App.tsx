import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CodePanel } from './CodePanel';
import { ChatPanel } from './ChatPanel';
import { AnimPanelWithControls } from './AnimPanelWithControls';
import { TimelineDebugPanel } from './TimelineDebugPanel';
import { loadYAML } from '../core/yamlLoader';
import { validateSchema } from '../core/schemaValidator';
import { execute } from '../core/dslExecutor';
import type { TimelineEvent } from '../core/types';
import exampleYaml from '../fixtures/example.yaml?raw';

export const App: React.FC = () => {
  const [yamlContent, setYamlContent] = useState(exampleYaml);
  const [loContent, setLoContent] = useState('# LO Content\n\nThis panel shows the Learning Objective or high-level description of the animation.');
  const [descContent, setDescContent] = useState('# Description\n\nThis panel shows the natural language description that can be converted to DSL.');
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Parse and execute YAML whenever it changes
  useEffect(() => {
    try {
      console.log('Parsing YAML...');
      const spec = loadYAML(yamlContent);
      const validation = validateSchema(spec);
      
      if (!validation.valid) {
        console.error('Validation errors:', validation.errors);
        setError(validation.errors.join('\n'));
        return;
      }
      
      console.log('Executing DSL...');
      const result = execute(spec);
      console.log('Generated events:', result.timeline.length, result.timeline);
      setEvents(result.timeline);
      setError(null);
    } catch (e) {
      console.error('Execution error:', e);
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
  }, [yamlContent]);
  
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
            </TabsList>
          </div>
          
          <div className="flex-1 min-h-0 p-2">
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
                <CodePanel
                  title="YAMLScript"
                  content={yamlContent}
                  onChange={setYamlContent}
                  language="yaml"
                />
                <ChatPanel title="Chat" />
              </div>
            </TabsContent>
            
            <TabsContent value="dsl-anim" className="h-full m-0">
              <div className="grid grid-cols-3 gap-2 h-full">
                <CodePanel
                  title="YAMLScript"
                  content={yamlContent}
                  onChange={setYamlContent}
                  language="yaml"
                />
                <AnimPanelWithControls events={events} />
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
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default App;
