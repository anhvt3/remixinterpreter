import React from 'react';
import type { TimelineEvent } from '../core/types';
import { computeScene, renderMath, boardToPixel } from './scene';

interface AnimRendererProps {
  events: TimelineEvent[];
  currentTime: number;
  width: number;
  height: number;
}

export const AnimRenderer: React.FC<AnimRendererProps> = ({
  events,
  currentTime,
  width,
  height,
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
        
        // Calculate transform based on anchor
        const anchor = element.at?.anchor || 'Center';
        let transform = 'translate(-50%, -50%)';
        if (anchor === 'Left') transform = 'translate(0, -50%)';
        if (anchor === 'Right') transform = 'translate(-100%, -50%)';
        
        const fontSize = (element.style?.scale || 1) * 24;
        const fontWeight = element.style?.weight || 'normal';
        const color = element.style?.color || '#FFFFFF';
        
        return (
          <div
            key={element.id}
            className="absolute"
            style={{
              left: px,
              top: py,
              transform,
              opacity: element.opacity,
              color,
              fontSize,
              fontWeight,
              whiteSpace: 'nowrap',
              border: '1px solid rgba(255,0,0,0.5)', // DEBUG: red border
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
          </div>
        );
      })}
    </div>
  );
};
