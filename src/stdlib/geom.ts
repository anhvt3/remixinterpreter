/**
 * Geometry helper functions for the expression engine
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * Returns the 4 corners of a square given center and size
 * Returns: [{x, y}, {x, y}, {x, y}, {x, y}] - TL, TR, BR, BL
 */
export function squareCorners(
  cx: number,
  cy: number,
  size: number
): Point[] {
  const half = size / 2;
  return [
    { x: cx - half, y: cy + half },  // Top-left
    { x: cx + half, y: cy + half },  // Top-right
    { x: cx + half, y: cy - half },  // Bottom-right
    { x: cx - half, y: cy - half },  // Bottom-left
  ];
}

/**
 * Returns the 4 corners of a rectangle given center, width, and height
 */
export function rectCorners(
  cx: number,
  cy: number,
  width: number,
  height: number
): Point[] {
  const hw = width / 2;
  const hh = height / 2;
  return [
    { x: cx - hw, y: cy + hh },  // Top-left
    { x: cx + hw, y: cy + hh },  // Top-right
    { x: cx + hw, y: cy - hh },  // Bottom-right
    { x: cx - hw, y: cy - hh },  // Bottom-left
  ];
}

/**
 * Returns points along a circle
 */
export function circlePoints(
  cx: number,
  cy: number,
  radius: number,
  numPoints: number,
  startAngle: number = 0
): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < numPoints; i++) {
    const angle = startAngle + (2 * Math.PI * i) / numPoints;
    points.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  }
  return points;
}

/**
 * Returns points along a line from start to end
 */
export function linePoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  numPoints: number
): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < numPoints; i++) {
    const t = numPoints > 1 ? i / (numPoints - 1) : 0;
    points.push({
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1),
    });
  }
  return points;
}

/**
 * Interpolate between two points
 */
export function lerp(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  t: number
): Point {
  return {
    x: x1 + t * (x2 - x1),
    y: y1 + t * (y2 - y1),
  };
}

/**
 * Distance between two points
 */
export function distance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

/**
 * Midpoint between two points
 */
export function midpoint(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): Point {
  return {
    x: (x1 + x2) / 2,
    y: (y1 + y2) / 2,
  };
}

/**
 * Rotate a point around a center
 */
export function rotatePoint(
  px: number,
  py: number,
  cx: number,
  cy: number,
  angleRad: number
): Point {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = px - cx;
  const dy = py - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

/**
 * Triangle rearrangement positions - left side
 * Used for animating triangles in mathematical visualizations
 */
export function trianglesRearrangementLeft(
  baseX: number,
  baseY: number,
  size: number,
  count: number
): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < count; i++) {
    points.push({
      x: baseX - size * (i + 1),
      y: baseY,
    });
  }
  return points;
}

/**
 * Triangle rearrangement positions - right side
 */
export function trianglesRearrangementRight(
  baseX: number,
  baseY: number,
  size: number,
  count: number
): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < count; i++) {
    points.push({
      x: baseX + size * (i + 1),
      y: baseY,
    });
  }
  return points;
}

/**
 * Triangle vertices given center and size
 * Returns 3 points for an equilateral triangle
 */
export function triangleVertices(
  cx: number,
  cy: number,
  size: number,
  rotation: number = 0
): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < 3; i++) {
    const angle = rotation + (2 * Math.PI * i) / 3 - Math.PI / 2;
    points.push({
      x: cx + size * Math.cos(angle),
      y: cy + size * Math.sin(angle),
    });
  }
  return points;
}

/**
 * Polygon vertices given center, radius, and number of sides
 */
export function polygonVertices(
  cx: number,
  cy: number,
  radius: number,
  sides: number,
  rotation: number = 0
): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = rotation + (2 * Math.PI * i) / sides - Math.PI / 2;
    points.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  }
  return points;
}

/**
 * Arc points along a circular arc
 */
export function arcPoints(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  numPoints: number
): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < numPoints; i++) {
    const t = numPoints > 1 ? i / (numPoints - 1) : 0;
    const angle = startAngle + t * (endAngle - startAngle);
    points.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  }
  return points;
}

/**
 * Generate block positions on the right side
 */
export function blocksRight(
  baseX: number,
  baseY: number,
  blockWidth: number,
  blockHeight: number,
  count: number,
  spacing: number = 0
): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < count; i++) {
    points.push({
      x: baseX + i * (blockWidth + spacing),
      y: baseY,
    });
  }
  return points;
}

/**
 * Generate block positions on the left side
 */
export function blocksLeft(
  baseX: number,
  baseY: number,
  blockWidth: number,
  blockHeight: number,
  count: number,
  spacing: number = 0
): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < count; i++) {
    points.push({
      x: baseX - i * (blockWidth + spacing),
      y: baseY,
    });
  }
  return points;
}

/**
 * Generate block positions going up
 */
export function blocksUp(
  baseX: number,
  baseY: number,
  blockWidth: number,
  blockHeight: number,
  count: number,
  spacing: number = 0
): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < count; i++) {
    points.push({
      x: baseX,
      y: baseY + i * (blockHeight + spacing),
    });
  }
  return points;
}

/**
 * Generate block positions going down
 */
export function blocksDown(
  baseX: number,
  baseY: number,
  blockWidth: number,
  blockHeight: number,
  count: number,
  spacing: number = 0
): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < count; i++) {
    points.push({
      x: baseX,
      y: baseY - i * (blockHeight + spacing),
    });
  }
  return points;
}

/**
 * Generate stacked block positions (like a tower)
 */
export function blocksStack(
  baseX: number,
  baseY: number,
  blockWidth: number,
  blockHeight: number,
  count: number
): Point[] {
  return blocksUp(baseX, baseY, blockWidth, blockHeight, count);
}

/**
 * Generate block positions in a row
 */
export function blocksRow(
  startX: number,
  y: number,
  blockWidth: number,
  count: number,
  spacing: number = 0
): Point[] {
  return blocksRight(startX, y, blockWidth, 0, count, spacing);
}

/**
 * Generate block positions in a column
 */
export function blocksColumn(
  x: number,
  startY: number,
  blockHeight: number,
  count: number,
  spacing: number = 0
): Point[] {
  return blocksUp(x, startY, 0, blockHeight, count, spacing);
}

/**
 * Generate grid points
 */
export function gridPoints(
  x: number,
  y: number,
  cols: number,
  rows: number,
  cellWidth: number,
  cellHeight: number
): Point[] {
  const points: Point[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      points.push({
        x: x + col * cellWidth,
        y: y + row * cellHeight,
      });
    }
  }
  return points;
}

/**
 * Bezier curve points
 */
export function bezierPoints(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  numPoints: number
): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < numPoints; i++) {
    const t = numPoints > 1 ? i / (numPoints - 1) : 0;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;
    
    points.push({
      x: mt3 * x0 + 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t3 * x3,
      y: mt3 * y0 + 3 * mt2 * t * y1 + 3 * mt * t2 * y2 + t3 * y3,
    });
  }
  return points;
}
