import type { Power } from '../core/types';

/**
 * Returns list of prime factors sorted ascending (with multiplicity)
 * e.g., 720 -> [2, 2, 2, 2, 3, 3, 5]
 */
export function primeFactors(n: number): number[] {
  if (n < 2) return [];
  
  const factors: number[] = [];
  let num = n;
  
  // Factor out 2s
  while (num % 2 === 0) {
    factors.push(2);
    num = num / 2;
  }
  
  // Factor out odd numbers starting from 3
  for (let i = 3; i * i <= num; i += 2) {
    while (num % i === 0) {
      factors.push(i);
      num = num / i;
    }
  }
  
  // If remaining number is prime > 2
  if (num > 2) {
    factors.push(num);
  }
  
  return factors;
}

/**
 * Given N and factors, returns [N, N/f1, N/(f1*f2), ...]
 * e.g., 720, [2,2,2,2,3,3,5] -> [720, 360, 180, 90, 45, 15, 5, 1]
 */
export function quotientChain(n: number, factors: number[]): number[] {
  const chain: number[] = [n];
  let current = n;
  
  for (const factor of factors) {
    current = current / factor;
    chain.push(current);
  }
  
  return chain;
}

/**
 * Given factors array, returns list of {p, k} sorted by p
 * e.g., [2,2,2,2,3,3,5] -> [{p:2, k:4}, {p:3, k:2}, {p:5, k:1}]
 */
export function countPowers(factors: number[]): Power[] {
  const counts = new Map<number, number>();
  
  for (const f of factors) {
    counts.set(f, (counts.get(f) || 0) + 1);
  }
  
  const powers: Power[] = [];
  for (const [p, k] of counts.entries()) {
    powers.push({ p, k });
  }
  
  // Sort by prime value
  powers.sort((a, b) => a.p - b.p);
  
  return powers;
}
