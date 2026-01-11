import React from 'react';
import type { TimelineEvent } from '../core/types';
import { computeScene, renderMath, boardToPixel } from './scene';

interface AnimRendererProps {
  events: TimelineEvent[];
  currentTime: number;
  width: number;
  height: number;
  selectedElementId?: string | null;
  primaryElements?: string[];
  secondaryElements?: string[];
  onElementClick?: (elementId: string) => void;
  onElementHover?: (elementId: string | null) => void;
}

export const AnimRenderer: React.FC<AnimRendererProps> = ({
  events,
  currentTime,
  width,
  height,
  selectedElementId,
  primaryElements = [],
  secondaryElements = [],
  onElementClick,
  onElementHover,
}) => {
  // Compute scene at current time
  const scene = computeScene(events, currentTime);
  
  // Default viewbox if not set
  const viewbox = scene.boardConfig?.viewbox || [-6, 10, 6, -10];
  const bgColor = scene.boardConfig?.theme?.bg || '#000000';
  
  const elements = Array.from(scene.elements.values());
  
  return (
    <div
      className="relative overflow-hidden"
      style={{
        width,
        height,
        backgroundColor: bgColor,
      }}
    >
      {/* Debug overlay */}
      <div className="absolute top-1 left-1 text-[10px] text-white/50 font-mono z-50">
        {elements.length} el @ t={currentTime.toFixed(1)}s
        {selectedElementId && <span className="ml-2 text-primary">• {selectedElementId}</span>}
      </div>
      
      {elements.map((element) => {
        if (!element.visible) return null;
        
        // Ensure at has valid coordinates
        const atX = typeof element.at?.x === 'number' ? element.at.x : 0;
        const atY = typeof element.at?.y === 'number' ? element.at.y : 0;
        
        const { px, py } = boardToPixel(atX, atY, viewbox, width, height);
        
        // Calculate transform based on anchor
        const anchor = element.at?.anchor || 'Center';
        let transform = 'translate(-50%, -50%)';
        if (anchor === 'Left') transform = 'translate(0, -50%)';
        if (anchor === 'Right') transform = 'translate(-100%, -50%)';
        
        const fontSize = (element.style?.scale || 1) * 24;
        const fontWeight = element.style?.weight || 'normal';
        const color = element.style?.color || '#FFFFFF';
        
        const isSelected = selectedElementId === element.id;
        const isPrimary = primaryElements.includes(element.id);
        const isSecondary = secondaryElements.includes(element.id);
        
        // Determine highlight style
        let ringClass = 'hover:ring-1 hover:ring-white/30 rounded';
        let highlightColor = color;
        
        if (isSelected || isPrimary) {
          ringClass = 'ring-2 ring-primary ring-offset-2 ring-offset-black rounded';
          highlightColor = 'hsl(195, 85%, 50%)'; // Primary cyan
        } else if (isSecondary) {
          ringClass = 'ring-1 ring-amber-400/60 ring-offset-1 ring-offset-black rounded';
          highlightColor = 'hsl(38, 90%, 60%)'; // Secondary amber
        }
        
        return (
          <div
            key={element.id}
            onClick={() => onElementClick?.(element.id)}
            onMouseEnter={() => onElementHover?.(element.id)}
            onMouseLeave={() => onElementHover?.(null)}
            className={`
              absolute cursor-pointer transition-all duration-150
              ${ringClass}
            `}
            style={{
              left: px,
              top: py,
              transform,
              opacity: element.opacity,
              color: (isSelected || isPrimary || isSecondary) ? highlightColor : color,
              fontSize,
              fontWeight,
              whiteSpace: 'nowrap',
              padding: '2px 4px',
            }}
          >
            {element.mode === 'math' ? (
              <div
                dangerouslySetInnerHTML={{
                  __html: renderMath(element.content),
                }}
              />
            ) : (
              <span>{element.content}</span>
            )}
            
            {/* CrossFade overlay for transitions */}
            {element.previousContent && element.transitionProgress !== undefined && (
              <div
                className="absolute inset-0"
                style={{
                  opacity: 1 - element.transitionProgress,
                }}
              >
                {element.mode === 'math' ? (
                  <div
                    dangerouslySetInnerHTML={{
                      __html: renderMath(element.previousContent),
                    }}
                  />
                ) : (
                  <span>{element.previousContent}</span>
                )}
              </div>
            )}
            
            {/* Badge for primary/secondary indicators */}
            {(isPrimary || isSecondary) && !isSelected && (
              <div 
                className={`absolute -top-2 -right-2 w-3 h-3 rounded-full text-[8px] flex items-center justify-center font-bold ${
                  isPrimary ? 'bg-primary text-primary-foreground' : 'bg-amber-400 text-amber-900'
                }`}
              >
                {isPrimary ? 'C' : 'A'}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
