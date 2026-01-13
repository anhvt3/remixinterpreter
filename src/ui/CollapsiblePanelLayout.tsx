import React, { useState, useCallback, ReactNode, useEffect } from 'react';

export type PanelId = 'source' | 'desc' | 'dsl' | 'runtime' | 'anim' | 'chat';

// Canonical order of panels
const PANEL_ORDER: PanelId[] = ['source', 'desc', 'dsl', 'runtime', 'anim', 'chat'];

interface PanelConfig {
  id: PanelId;
  label: string;
  render: () => ReactNode;
}

// Breakpoints for responsive panel count
const TABLET_BREAKPOINT = 1440;
const MOBILE_BREAKPOINT = 700;

// Hook to get responsive panel count
export function useResponsivePanelCount() {
  const [panelCount, setPanelCount] = useState<number>(() => {
    if (typeof window === 'undefined') return 3;
    if (window.innerWidth < MOBILE_BREAKPOINT) return 1;
    if (window.innerWidth < TABLET_BREAKPOINT) return 2;
    return 3;
  });

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < MOBILE_BREAKPOINT) {
        setPanelCount(1);
      } else if (window.innerWidth < TABLET_BREAKPOINT) {
        setPanelCount(2);
      } else {
        setPanelCount(3);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial check
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return panelCount;
}

// Hook to manage panel expansion state
export function usePanelExpansion(initialExpanded: PanelId[] = ['dsl', 'runtime', 'anim']) {
  const [expandedOrder, setExpandedOrder] = useState<PanelId[]>(initialExpanded);
  const panelCount = useResponsivePanelCount();

  const visiblePanelIds = expandedOrder.slice(0, panelCount);
  const sortedVisiblePanelIds = [...visiblePanelIds].sort(
    (a, b) => PANEL_ORDER.indexOf(a) - PANEL_ORDER.indexOf(b)
  );

  const handlePanelClick = useCallback((panelId: PanelId) => {
    setExpandedOrder(prev => {
      const isCurrentlyVisible = prev.slice(0, panelCount).includes(panelId);
      
      if (isCurrentlyVisible) {
        const filtered = prev.filter(id => id !== panelId);
        return [...filtered, panelId];
      } else {
        const filtered = prev.filter(id => id !== panelId);
        return [panelId, ...filtered];
      }
    });
  }, [panelCount]);

  const isPanelVisible = (panelId: PanelId) => visiblePanelIds.includes(panelId);

  return {
    visiblePanelIds,
    sortedVisiblePanelIds,
    handlePanelClick,
    isPanelVisible,
    panelCount,
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
              px-2 py-1 rounded text-xs font-medium transition-all
              ${isVisible
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }
            `}
            title={isVisible ? 'Click to close' : 'Click to expand'}
          >
            {panel.label}
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
  panelCount?: number;
}

export const PanelContentArea: React.FC<PanelContentAreaProps> = ({
  panels,
  sortedVisiblePanelIds,
  panelCount = 3,
}) => {
  // Dynamic grid columns based on panel count
  const gridColsClass = panelCount === 1 
    ? 'grid-cols-1' 
    : panelCount === 2 
      ? 'grid-cols-2' 
      : 'grid-cols-3';

  return (
    <div className={`absolute inset-0 grid ${gridColsClass} gap-2 p-2`}>
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
  const { sortedVisiblePanelIds, handlePanelClick, isPanelVisible, panelCount } = usePanelExpansion(initialExpanded);

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
      <PanelContentArea panels={panels} sortedVisiblePanelIds={sortedVisiblePanelIds} panelCount={panelCount} />
    </div>
  );
};
