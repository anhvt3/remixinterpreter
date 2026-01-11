// Provenance Tracker - Maps rendered elements to their originating DSL statements

export interface ElementProvenance {
  elementId: string;
  // Creator info
  creatorFn: string;           // Function that created this element
  creatorStmtIndex: number;    // Statement index within that function
  creatorType: 'call' | 'ir';  // Was it a call or direct ir
  // Animator info (ir statements that modify this element)
  animators: AnimatorRef[];
}

export interface AnimatorRef {
  fn: string;
  stmtIndex: number;
  irType: string;  // e.g., 'text.update'
}

export interface StatementRef {
  fnName: string;
  stmtIndex: number;
  stmtType: 'call' | 'ir' | 'let' | 'foreach';
}

// Maps element IDs to their provenance
export type ProvenanceMap = Map<string, ElementProvenance>;

// Maps statement refs to element IDs they create
export type CreatorMap = Map<string, string[]>; // key: "fnName:stmtIndex"

// Maps statement refs to element IDs they animate
export type AnimatorMap = Map<string, string[]>; // key: "fnName:stmtIndex"

export function makeStatementKey(fnName: string, stmtIndex: number): string {
  return `${fnName}:${stmtIndex}`;
}

export function parseStatementKey(key: string): { fnName: string; stmtIndex: number } | null {
  const parts = key.split(':');
  if (parts.length !== 2) return null;
  return { fnName: parts[0], stmtIndex: parseInt(parts[1], 10) };
}
