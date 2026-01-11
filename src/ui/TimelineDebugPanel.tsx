import React from 'react';
import type { TimelineEvent } from '../core/types';
import { snapshotTimeline } from '../core/timeline';

interface TimelineDebugPanelProps {
  events: TimelineEvent[];
}

export const TimelineDebugPanel: React.FC<TimelineDebugPanelProps> = ({ events }) => {
  const snapshot = snapshotTimeline(events);
  
  return (
    <div className="flex flex-col h-full panel">
      <div className="panel-header flex items-center justify-between">
        <span>Timeline Events</span>
        <span className="text-xs text-syntax-number">{events.length} events</span>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        <pre className="p-4 text-xs font-mono text-muted-foreground whitespace-pre-wrap">
          {snapshot}
        </pre>
      </div>
    </div>
  );
};
