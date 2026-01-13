import React, { useState, useCallback, ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type PanelId = 'source' | 'desc' | 'dsl' | 'runtime' | 'anim' | 'chat';

// Canonical order of panels
const PANEL_ORDER: PanelId[] = ['source', 'desc', 'dsl', 'runtime', 'anim', 'chat'];

interface PanelConfig {
  id: PanelId;
  label: string;
  render: () => ReactNode;
}

// Hook to manage panel expansion state
export function usePanelExpansion(initialExpanded: PanelId[] = ['dsl', 'runtime', 'anim']) {
  const [expandedOrder, setExpandedOrder] = useState<PanelId[]>(initialExpanded);

  const visiblePanelIds = expandedOrder.slice(0, 3);
  const sortedVisiblePanelIds = [...visiblePanelIds].sort(
    (a, b) => PANEL_ORDER.indexOf(a) - PANEL_ORDER.indexOf(b)
  );

  const handlePanelClick = useCallback((panelId: PanelId) => {
    setExpandedOrder(prev => {
      const isCurrentlyVisible = prev.slice(0, 3).includes(panelId);
      
      if (isCurrentlyVisible) {
        const filtered = prev.filter(id => id !== panelId);
        return [...filtered, panelId];
      } else {
        const filtered = prev.filter(id => id !== panelId);
        return [panelId, ...filtered];
      }
    });
  }, []);

  const isPanelVisible = (panelId: PanelId) => visiblePanelIds.includes(panelId);

  return {
    visiblePanelIds,
    sortedVisiblePanelIds,
    handlePanelClick,
    isPanelVisible,
  };
}

// Panel selector buttons component (for use in header)
interface PanelSelectorProps {
  panels: { id: PanelId; label: string }[];
  isPanelVisible: (id: PanelId) => boolean;
  onPanelClick: (id: PanelId) => void;
}

export const PanelSelector: React.FC<PanelSelectorProps> = ({
  panels,
  isPanelVisible,
  onPanelClick,
}) => {
  return (
    <div className="flex items-center gap-1 ml-auto">
      {panels.map((panel) => {
        const isVisible = isPanelVisible(panel.id);
        
        return (
          <button
            key={panel.id}
            onClick={() => onPanelClick(panel.id)}
            className={`
              flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all
              ${isVisible
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }
            `}
            title={isVisible ? 'Click to close' : 'Click to expand'}
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
  );
};

// Panel content area component
interface PanelContentAreaProps {
  panels: PanelConfig[];
  sortedVisiblePanelIds: PanelId[];
}

export const PanelContentArea: React.FC<PanelContentAreaProps> = ({
  panels,
  sortedVisiblePanelIds,
}) => {
  return (
    <div className="absolute inset-0 grid grid-cols-3 gap-2 p-2">
      {sortedVisiblePanelIds.map((panelId) => {
        const panel = panels.find(p => p.id === panelId);
        if (!panel) return null;
        
        return (
          <div key={panelId} className="relative min-w-0 overflow-hidden">
            <div className="absolute inset-0">
              {panel.render()}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Legacy combined component (for backwards compatibility)
interface CollapsiblePanelLayoutProps {
  panels: PanelConfig[];
  initialExpanded?: PanelId[];
}

export const CollapsiblePanelLayout: React.FC<CollapsiblePanelLayoutProps> = ({
  panels,
  initialExpanded = ['dsl', 'runtime', 'anim'],
}) => {
  const { sortedVisiblePanelIds, handlePanelClick, isPanelVisible } = usePanelExpansion(initialExpanded);

  return (
    <div className="h-full flex flex-col">
      {/* Panel selector bar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-card/50 shrink-0">
        <PanelSelector
          panels={panels}
          isPanelVisible={isPanelVisible}
          onPanelClick={handlePanelClick}
        />
      </div>

      {/* Panel content area */}
      <PanelContentArea panels={panels} sortedVisiblePanelIds={sortedVisiblePanelIds} />
    </div>
  );
};
