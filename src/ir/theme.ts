/**
 * Theme Configuration
 * 
 * Calibrated from reference screenshots:
 * - Background: Near-black charcoal (#0a0a0a)
 * - Strokes: Bright, thin-medium (2-3px), yellow/orange palette
 * - Fills: Semi-transparent (0.3-0.5 alpha), olive/brown palette
 * - Glow: Soft outer glow, color-matched to stroke
 * - Text: Serif/italic for math, clean rendering
 */

import type { Color, StrokeStyle, FillStyle, GlowStyle, TextStyle, NodeStyle } from './types';
import { hexToColor, createDefaultNodeStyle } from './types';

// ============================================================================
// COLOR PALETTE (extracted from screenshots)
// ============================================================================

export const COLORS = {
  // Background
  background: hexToColor('#0a0a0a'),
  backgroundAlt: hexToColor('#111111'),
  
  // Primary strokes (bright, high contrast)
  strokeYellow: hexToColor('#e6c54a'),      // Golden yellow
  strokeOrange: hexToColor('#d35400'),      // Bright orange
  strokeRed: hexToColor('#c0392b'),         // Deep red
  strokeWhite: hexToColor('#f5f5f5'),       // Off-white
  strokeCyan: hexToColor('#4fc3f7'),        // Light cyan
  
  // Fills (semi-transparent)
  fillOlive: hexToColor('#8b9a4b'),         // Olive/yellow-green
  fillBrown: hexToColor('#6d4c41'),         // Dark brown
  fillRed: hexToColor('#8b4513'),           // Brown-red
  fillBlue: hexToColor('#2e4a62'),          // Dark blue
  
  // Text
  textPrimary: hexToColor('#ff6b35'),       // Orange text (titles)
  textSecondary: hexToColor('#e6c54a'),     // Yellow text (formulas)
  textMath: hexToColor('#ffffff'),          // White math text
  
  // Glows
  glowYellow: hexToColor('#ffd700', 0.6),   // Yellow glow
  glowOrange: hexToColor('#ff8c00', 0.5),   // Orange glow
  glowWhite: hexToColor('#ffffff', 0.4),    // White glow
} as const;

// ============================================================================
// DEFAULT STYLES
// ============================================================================

/**
 * Default stroke style
 * TUNING: Adjust width and color to match your screenshots
 */
export const defaultStroke: StrokeStyle = {
  enabled: true,
  color: COLORS.strokeYellow,
  width: 2.5,            // Thin-medium stroke
  lineCap: 'round',
  lineJoin: 'round',
};

/**
 * Default fill style
 * TUNING: Adjust alpha for transparency level
 */
export const defaultFill: FillStyle = {
  enabled: true,
  color: { ...COLORS.fillOlive, a: 0.35 },  // Semi-transparent olive
};

/**
 * Default glow style
 * TUNING: 
 * - blurPx: Higher = softer glow (10-20 typical)
 * - intensity: Multiplier for glow opacity
 */
export const defaultGlow: GlowStyle = {
  enabled: true,
  color: { ...COLORS.glowYellow, a: 0.6 },
  blurPx: 15,            // Soft blur
  spreadPx: 2,           // Small spread
  intensity: 1.2,        // Slightly boosted
};

/**
 * Default text style
 * TUNING: Font family and weight for math notation
 */
export const defaultText: TextStyle = {
  fontFamily: 'Georgia, "Times New Roman", "STIX Two Math", serif',
  fontSize: 32,
  fontWeight: 'normal',
  fontStyle: 'italic',   // Math variables are italic
  textAlign: 'center',
  textBaseline: 'middle',
};

// ============================================================================
// THEME OBJECT
// ============================================================================

export interface Theme {
  background: Color;
  defaultStroke: StrokeStyle;
  defaultFill: FillStyle;
  defaultGlow: GlowStyle;
  defaultText: TextStyle;
  
  // Opacity presets for focus/dim effects
  focusOpacity: number;
  dimOpacity: number;
  
  // Animation presets
  defaultFadeDuration: number;
  defaultEasing: 'linear' | 'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic';
}

/**
 * Main theme configuration
 * All values are calibrated from the reference screenshots
 */
export const theme: Theme = {
  background: COLORS.background,
  defaultStroke: { ...defaultStroke },
  defaultFill: { ...defaultFill },
  defaultGlow: { ...defaultGlow },
  defaultText: { ...defaultText },
  
  // Focus/dim for attention effects
  focusOpacity: 1.0,
  dimOpacity: 0.4,
  
  // Animation defaults
  defaultFadeDuration: 0.5,
  defaultEasing: 'easeInOutCubic',
};

// ============================================================================
// STYLE PRESETS
// ============================================================================

/**
 * Create a complete node style from theme defaults
 */
export function createThemedStyle(overrides?: Partial<NodeStyle>): NodeStyle {
  const base = createDefaultNodeStyle();
  base.stroke = { ...theme.defaultStroke };
  base.fill = { ...theme.defaultFill };
  base.glow = { ...theme.defaultGlow };
  base.text = { ...theme.defaultText };
  
  if (overrides) {
    if (overrides.opacity !== undefined) base.opacity = overrides.opacity;
    if (overrides.fill) base.fill = { ...base.fill, ...overrides.fill };
    if (overrides.stroke) base.stroke = { ...base.stroke, ...overrides.stroke };
    if (overrides.glow) base.glow = { ...base.glow, ...overrides.glow };
    if (overrides.text) base.text = { ...base.text, ...overrides.text };
  }
  
  return base;
}

/**
 * Preset: Shape with yellow stroke and olive fill (like b² square)
 */
export function yellowOliveStyle(): NodeStyle {
  return createThemedStyle({
    stroke: { ...defaultStroke, color: COLORS.strokeYellow },
    fill: { ...defaultFill, color: { ...COLORS.fillOlive, a: 0.4 } },
    glow: { ...defaultGlow, color: { ...COLORS.glowYellow, a: 0.5 } },
  });
}

/**
 * Preset: Shape with orange stroke and red-brown fill (like diagonal)
 */
export function orangeRedStyle(): NodeStyle {
  return createThemedStyle({
    stroke: { ...defaultStroke, color: COLORS.strokeOrange },
    fill: { ...defaultFill, color: { ...COLORS.fillRed, a: 0.5 } },
    glow: { ...defaultGlow, color: { ...COLORS.glowOrange, a: 0.5 } },
  });
}

/**
 * Preset: Title text (large, orange)
 */
export function titleTextStyle(): NodeStyle {
  return createThemedStyle({
    fill: { enabled: true, color: COLORS.textPrimary },
    stroke: { enabled: false, color: COLORS.strokeWhite, width: 0, lineCap: 'round', lineJoin: 'round' },
    glow: { enabled: false, color: COLORS.glowOrange, blurPx: 8, spreadPx: 0, intensity: 0.8 },
    text: { ...defaultText, fontSize: 48, fontWeight: 'bold', fontStyle: 'normal' },
  });
}

/**
 * Preset: Math formula text (white/yellow, italic)
 */
export function mathTextStyle(): NodeStyle {
  return createThemedStyle({
    fill: { enabled: true, color: COLORS.textSecondary },
    stroke: { enabled: false, color: COLORS.strokeWhite, width: 0, lineCap: 'round', lineJoin: 'round' },
    glow: { enabled: true, color: { ...COLORS.glowYellow, a: 0.3 }, blurPx: 6, spreadPx: 0, intensity: 0.5 },
    text: { ...defaultText, fontSize: 36, fontStyle: 'italic' },
  });
}

/**
 * Preset: Label text (small, white, on shapes)
 */
export function labelTextStyle(): NodeStyle {
  return createThemedStyle({
    fill: { enabled: true, color: COLORS.textMath },
    stroke: { enabled: false, color: COLORS.strokeWhite, width: 0, lineCap: 'round', lineJoin: 'round' },
    glow: { enabled: false, color: COLORS.glowWhite, blurPx: 4, spreadPx: 0, intensity: 0.5 },
    text: { ...defaultText, fontSize: 28, fontStyle: 'italic' },
  });
}
