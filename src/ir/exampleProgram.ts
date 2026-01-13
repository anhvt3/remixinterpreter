/**
 * Example IR Program - Pythagorean Theorem Animation
 */

import type { IRProgram } from './types';
import { hexToColor } from './types';
import { COLORS } from './theme';

export const exampleProgram: IRProgram = {
  version: '1.0',
  scene: {
    width: 600,
    height: 500,
    fps: 60,
    duration: 8,
    background: hexToColor('#0a0a0a'),
  },
  nodes: [
    // Title text
    {
      id: 'title',
      type: 'text',
      content: 'Pythagorean Theorem',
      zIndex: 10,
      visible: true,
      transform: { x: 300, y: 40, scaleX: 1, scaleY: 1, rotation: 0, originX: 0, originY: 0 },
      style: {
        opacity: 0,
        fill: { enabled: true, color: hexToColor('#ff6b35') },
        stroke: { enabled: false, color: hexToColor('#fff'), width: 0, lineCap: 'round', lineJoin: 'round' },
        glow: { enabled: true, color: hexToColor('#ff6b35', 0.4), blurPx: 10, spreadPx: 0, intensity: 0.8 },
        text: { fontFamily: 'Georgia, serif', fontSize: 36, fontWeight: 'bold', fontStyle: 'normal', textAlign: 'center', textBaseline: 'middle' },
      },
    },
    // Main triangle (olive fill, yellow stroke)
    {
      id: 'triangle',
      type: 'polygon',
      points: [{ x: 150, y: 380 }, { x: 450, y: 380 }, { x: 150, y: 180 }],
      zIndex: 1,
      visible: true,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, originX: 0, originY: 0 },
      style: {
        opacity: 0,
        fill: { enabled: true, color: { ...COLORS.fillOlive, a: 0.4 } },
        stroke: { enabled: true, color: COLORS.strokeYellow, width: 3, lineCap: 'round', lineJoin: 'round' },
        glow: { enabled: true, color: { ...COLORS.glowYellow, a: 0.5 }, blurPx: 12, spreadPx: 2, intensity: 1 },
      },
    },
    // a² label
    {
      id: 'labelA',
      type: 'text',
      content: 'a',
      zIndex: 10,
      visible: true,
      transform: { x: 130, y: 280, scaleX: 1, scaleY: 1, rotation: 0, originX: 0, originY: 0 },
      style: {
        opacity: 0,
        fill: { enabled: true, color: hexToColor('#ffffff') },
        stroke: { enabled: false, color: hexToColor('#fff'), width: 0, lineCap: 'round', lineJoin: 'round' },
        glow: { enabled: false, color: hexToColor('#fff', 0.3), blurPx: 6, spreadPx: 0, intensity: 0.5 },
        text: { fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 'normal', fontStyle: 'italic', textAlign: 'center', textBaseline: 'middle' },
      },
    },
    // b label
    {
      id: 'labelB',
      type: 'text',
      content: 'b',
      zIndex: 10,
      visible: true,
      transform: { x: 300, y: 400, scaleX: 1, scaleY: 1, rotation: 0, originX: 0, originY: 0 },
      style: {
        opacity: 0,
        fill: { enabled: true, color: hexToColor('#ffffff') },
        stroke: { enabled: false, color: hexToColor('#fff'), width: 0, lineCap: 'round', lineJoin: 'round' },
        glow: { enabled: false, color: hexToColor('#fff', 0.3), blurPx: 6, spreadPx: 0, intensity: 0.5 },
        text: { fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 'normal', fontStyle: 'italic', textAlign: 'center', textBaseline: 'middle' },
      },
    },
    // c label (hypotenuse)
    {
      id: 'labelC',
      type: 'text',
      content: 'c',
      zIndex: 10,
      visible: true,
      transform: { x: 320, y: 260, scaleX: 1, scaleY: 1, rotation: 0, originX: 0, originY: 0 },
      style: {
        opacity: 0,
        fill: { enabled: true, color: hexToColor('#e6c54a') },
        stroke: { enabled: false, color: hexToColor('#fff'), width: 0, lineCap: 'round', lineJoin: 'round' },
        glow: { enabled: true, color: hexToColor('#ffd700', 0.4), blurPx: 8, spreadPx: 0, intensity: 0.8 },
        text: { fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 'normal', fontStyle: 'italic', textAlign: 'center', textBaseline: 'middle' },
      },
    },
    // Formula
    {
      id: 'formula',
      type: 'text',
      content: 'a² + b² = c²',
      zIndex: 10,
      visible: true,
      transform: { x: 300, y: 90, scaleX: 1, scaleY: 1, rotation: 0, originX: 0, originY: 0 },
      style: {
        opacity: 0,
        fill: { enabled: true, color: hexToColor('#e6c54a') },
        stroke: { enabled: false, color: hexToColor('#fff'), width: 0, lineCap: 'round', lineJoin: 'round' },
        glow: { enabled: true, color: hexToColor('#ffd700', 0.3), blurPx: 8, spreadPx: 0, intensity: 0.6 },
        text: { fontFamily: 'Georgia, serif', fontSize: 32, fontWeight: 'normal', fontStyle: 'italic', textAlign: 'center', textBaseline: 'middle' },
      },
    },
  ],
  animations: [
    // Fade in title
    { id: 'a1', nodeId: 'title', propertyPath: 'style.opacity', t0: 0.2, t1: 0.8, easing: 'easeOutCubic', fromValue: 0, toValue: 1 },
    // Fade in triangle
    { id: 'a2', nodeId: 'triangle', propertyPath: 'style.opacity', t0: 1.0, t1: 1.6, easing: 'easeOutCubic', fromValue: 0, toValue: 1 },
    // Staggered label reveals
    { id: 'a3', nodeId: 'labelA', propertyPath: 'style.opacity', t0: 2.0, t1: 2.5, easing: 'easeOutCubic', fromValue: 0, toValue: 1 },
    { id: 'a4', nodeId: 'labelB', propertyPath: 'style.opacity', t0: 2.5, t1: 3.0, easing: 'easeOutCubic', fromValue: 0, toValue: 1 },
    { id: 'a5', nodeId: 'labelC', propertyPath: 'style.opacity', t0: 3.0, t1: 3.5, easing: 'easeOutCubic', fromValue: 0, toValue: 1 },
    // Fade in formula
    { id: 'a6', nodeId: 'formula', propertyPath: 'style.opacity', t0: 4.0, t1: 4.8, easing: 'easeOutCubic', fromValue: 0, toValue: 1 },
    // Glow emphasis on formula
    { id: 'a7', nodeId: 'formula', propertyPath: 'style.glow.intensity', t0: 5.0, t1: 5.5, easing: 'easeInOutCubic', fromValue: 0.6, toValue: 1.5 },
    { id: 'a8', nodeId: 'formula', propertyPath: 'style.glow.intensity', t0: 5.5, t1: 6.0, easing: 'easeInOutCubic', fromValue: 1.5, toValue: 0.6 },
    // Dim others while formula glows
    { id: 'a9', nodeId: 'triangle', propertyPath: 'style.opacity', t0: 5.0, t1: 5.3, easing: 'easeInOutCubic', fromValue: 1, toValue: 0.4 },
    { id: 'a10', nodeId: 'triangle', propertyPath: 'style.opacity', t0: 5.7, t1: 6.0, easing: 'easeInOutCubic', fromValue: 0.4, toValue: 1 },
  ],
};
