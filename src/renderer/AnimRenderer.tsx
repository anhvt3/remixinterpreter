import React, { useRef, useEffect } from 'react';
import type { TimelineEvent, LayoutPosition, StyleDef } from '../core/types';
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
  const canvasRef = useRef<HTMLDivElement>(null);
  
  // Compute scene at current time
  const scene = computeScene(events, currentTime);
  
  // Default viewbox if not set
  const viewbox = scene.boardConfig?.viewbox || [-6, 10, 6, -10];
  const bgColor = scene.boardConfig?.theme?.bg || '#000000';
  
  return (
    <div
      ref={canvasRef}
      className="relative overflow-hidden"
      style={{
        width,
        height,
        backgroundColor: bgColor,
      }}
    >
      {Array.from(scene.elements.values()).map((element) => {
        if (!element.visible) return null;
        
        const { px, py } = boardToPixel(
          element.at.x,
          element.at.y,
          viewbox,
          width,
          height
        );
        
        // Calculate transform based on anchor
        const anchor = element.at.anchor || 'Center';
        let transform = 'translate(-50%, -50%)';
        if (anchor === 'Left') transform = 'translate(0, -50%)';
        if (anchor === 'Right') transform = 'translate(-100%, -50%)';
        
        const fontSize = (element.style?.scale || 1) * 24;
        const fontWeight = element.style?.weight || 'normal';
        const color = element.style?.color || '#FFFFFF';
        
        return (
          <div
            key={element.id}
            className="absolute transition-opacity duration-100"
            style={{
              left: px,
              top: py,
              transform,
              opacity: element.opacity,
              color,
              fontSize,
              fontWeight,
              whiteSpace: 'nowrap',
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
