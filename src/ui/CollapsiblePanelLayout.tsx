import React, { useState, useCallback, ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type PanelId = 'lo' | 'desc' | 'dsl' | 'runtime' | 'anim' | 'chat';

interface PanelConfig {
  id: PanelId;
  label: string;
  render: () => ReactNode;
}

interface CollapsiblePanelLayoutProps {
  panels: PanelConfig[];
  initialExpanded?: PanelId[];
}

export const CollapsiblePanelLayout: React.FC<CollapsiblePanelLayoutProps> = ({
  panels,
  initialExpanded = ['dsl', 'runtime', 'anim'],
}) => {
  // Track the order of expanded panels (most recently expanded first)
  const [expandedOrder, setExpandedOrder] = useState<PanelId[]>(initialExpanded);

  // The 3 visible panels are the first 3 in expandedOrder
  const visiblePanels = expandedOrder.slice(0, 3);

  const handlePanelClick = useCallback((panelId: PanelId) => {
    setExpandedOrder(prev => {
      // If already in the list, move it to the front
      const filtered = prev.filter(id => id !== panelId);
      return [panelId, ...filtered];
    });
  }, []);

  const isPanelVisible = (panelId: PanelId) => visiblePanels.includes(panelId);

  return (
    <div className="h-full flex flex-col">
      {/* Panel selector bar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-card/50 shrink-0">
        {panels.map((panel) => {
          const isVisible = isPanelVisible(panel.id);
          
          return (
            <button
              key={panel.id}
              onClick={() => handlePanelClick(panel.id)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all
                ${isVisible
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                }
              `}
              title={isVisible ? 'Expanded' : 'Click to expand'}
            >
              {isVisible ? (
                <ChevronLeft className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              <span>{panel.label}</span>
            </button>
          );
        })}
      </div>

      {/* Panel content area - 3 columns */}
      <div className="flex-1 min-h-0 grid grid-cols-3 gap-2 p-2">
        {visiblePanels.map((panelId) => {
          const panel = panels.find(p => p.id === panelId);
          if (!panel) return null;
          
          return (
            <div key={panelId} className="h-full min-h-0 overflow-hidden">
              {panel.render()}
            </div>
          );
        })}
      </div>
    </div>
  );
};
