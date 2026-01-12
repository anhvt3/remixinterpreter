import React from 'react';
import type { TimelineEvent } from '../core/types';
import { computeScene, renderMath, boardToPixel } from './scene';

interface AnimRendererProps {
  events: TimelineEvent[];
  currentTime: number;
  width: number;
  height: number;
  selectedElementId?: string | null;
  onElementClick?: (elementId: string) => void;
}

export const AnimRenderer: React.FC<AnimRendererProps> = ({
  events,
  currentTime,
  width,
  height,
  selectedElementId,
  onElementClick,
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
      </div>
      
      {elements.map((element) => {
        if (!element.visible) return null;
        
        // Ensure at has valid coordinates
        const atX = typeof element.at?.x === 'number' ? element.at.x : 0;
        const atY = typeof element.at?.y === 'number' ? element.at.y : 0;
        
        const { px, py } = boardToPixel(atX, atY, viewbox, width, height);
        
        // Debug log for prompt element
        if (element.id === 'prompt') {
          console.log('Prompt element:', { atX, atY, px, py, width, height, viewbox, content: element.content });
        }
        
        // Calculate transform based on anchor
        const anchor = element.at?.anchor || 'Center';
        let transform = 'translate(-50%, -50%)';
        if (anchor === 'Left') transform = 'translate(0, -50%)';
        if (anchor === 'Right') transform = 'translate(-100%, -50%)';
        
        const fontSize = (element.style?.scale || 1) * 24;
        const fontWeight = element.style?.weight || 'normal';
        const color = element.style?.color || '#FFFFFF';
        
        const isSelected = selectedElementId === element.id;
        
        return (
          <div
            key={element.id}
            onClick={() => onElementClick?.(element.id)}
            className={`
              absolute cursor-pointer transition-all duration-150
              ${isSelected 
                ? 'ring-2 ring-primary ring-offset-2 ring-offset-black rounded' 
                : 'hover:ring-1 hover:ring-white/30 rounded'
              }
            `}
            style={{
              left: px,
              top: py,
              transform,
              opacity: element.opacity,
              color: isSelected ? 'hsl(195, 85%, 50%)' : color,
              fontSize,
              fontWeight,
              whiteSpace: 'nowrap',
              padding: '2px 4px',
            }}
          >
            {element.mode === 'math' ? (
              <div
                className="katex-container"
                style={{ color: 'inherit' }}
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
          </div>
        );
      })}
    </div>
  );
};
