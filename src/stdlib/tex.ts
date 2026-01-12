import type { Power } from '../core/types';

/**
 * Given N and powers, returns "N = p^k × ..." (k=1 omits exponent)
 * e.g., 720, [{p:2,k:4}, {p:3,k:2}, {p:5,k:1}] -> "720 = 2^4 × 3^2 × 5"
 */
export function primeFactorExpr(n: number, powers: Power[]): string {
  const parts = powers.map(({ p, k }) => {
    if (k === 1) return String(p);
    return `${p}^${k}`;
  });
  
  return `${n} = ${parts.join(' \\times ')}`;
}

/**
 * Given PF string like "720 = 2^4 × 3^2 × 5", returns the rhs after first '='
 * Returns "2^4 × 3^2 × 5"
 */
export function rhsOfEquation(pf: string): string {
  const eqIndex = pf.indexOf('=');
  if (eqIndex === -1) return pf;
  return pf.substring(eqIndex + 1).trim();
}

/**
 * Given N and rhs, returns "\\sqrt{N} = \\sqrt{rhs}"
 */
export function rootRewrite(n: number, rhs: string): string {
  return `\\sqrt{${n}} = \\sqrt{${rhs}}`;
}

/**
 * Given N and powers, returns "\\sqrt{N} = \\sqrt{p1^k1} × \\sqrt{p2^k2} × ..."
 */
export function splitRoot(n: number, powers: Power[]): string {
  const parts = powers.map(({ p, k }) => {
    if (k === 1) return `\\sqrt{${p}}`;
    return `\\sqrt{${p}^${k}}`;
  });
  
  return `\\sqrt{${n}} = ${parts.join(' \\times ')}`;
}

/**
 * Extract perfect squares and simplify
 * e.g., 720 with powers [{p:2,k:4}, {p:3,k:2}, {p:5,k:1}]
 * -> "\\sqrt{720} = 12\\sqrt{5}"
 * 
 * Logic: For each power, extract floor(k/2) copies outside the root
 * Outside: 2^2 * 3^1 = 12
 * Inside: 5
 */
export function extractSquares(n: number, powers: Power[]): string {
  let outsideProduct = 1;
  const insidePowers: Power[] = [];
  
  for (const { p, k } of powers) {
    const outsideExp = Math.floor(k / 2);
    const insideExp = k % 2;
    
    if (outsideExp > 0) {
      outsideProduct *= Math.pow(p, outsideExp);
    }
    
    if (insideExp > 0) {
      insidePowers.push({ p, k: insideExp });
    }
  }
  
  // Calculate inside product
  let insideProduct = 1;
  for (const { p, k } of insidePowers) {
    insideProduct *= Math.pow(p, k);
  }
  
  // Build result string
  if (outsideProduct === 1 && insideProduct === 1) {
    return `\\sqrt{${n}} = 1`;
  }
  
  if (insideProduct === 1) {
    return `\\sqrt{${n}} = ${outsideProduct}`;
  }
  
  if (outsideProduct === 1) {
    return `\\sqrt{${n}} = \\sqrt{${insideProduct}}`;
  }
  
  return `\\sqrt{${n}} = ${outsideProduct}\\sqrt{${insideProduct}}`;
}

/**
 * Final simplified root form (same as extractSquares but named for the DSL)
 */
export function finalRootSimplified(n: number, powers: Power[]): string {
  return extractSquares(n, powers);
}
