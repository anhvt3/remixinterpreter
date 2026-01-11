// Core types for the AnimYAML-DSL interpreter

export interface YAMLSpec {
  schema_version: number;
  dialect: string;
  determinism: {
    rules: string[];
    pinned: {
      renderer_version: string;
      font_pack: string;
    };
  };
  params: Params;
  expr: {
    allowed: string[];
    stdlib: Record<string, string>;
  };
  ir_api: Record<string, object>;
  defs: Record<string, FunctionDef>;
  program: {
    entry: {
      call: {
        fn: string;
        args: Record<string, unknown>;
      };
    };
  };
}

export interface Params {
  number: number;
  text: {
    title: string;
    prompt_latex: string;
  };
  style: {
    board: {
      viewbox: number[];
      theme: { bg: string };
    };
    title: StyleDef;
    text: StyleDef;
    final: StyleDef;
  };
  layout: {
    title_at: LayoutPosition;
    prompt_at: LayoutPosition;
    ladder: {
      x_left: number;
      x_right: number;
      y0: number;
      dy: number;
      left_anchor: string;
      right_anchor: string;
    };
    line_at: LayoutPosition;
  };
  time: {
    title: TimeDef;
    prompt: TimeDef;
    ladder_first_left: TimeDef;
    row_times: TimeDef[];
    factline: TimeDef;
    to_root1: TimeDef & { transition: string };
    to_root2: TimeDef & { transition: string };
    to_final: TimeDef & { transition: string };
  };
}

export interface StyleDef {
  color: string;
  scale: number;
  weight?: string;
}

export interface LayoutPosition {
  anchor: string;
  x: number;
  y: number;
}

export interface TimeDef {
  t0: number;
  t1: number;
  ease: string;
}

export interface FunctionDef {
  params: string[];
  returns: string[];
  body: Statement[];
}

export type Statement =
  | { call: CallStatement }
  | { let: LetStatement }
  | { foreach: ForeachStatement }
  | { return: unknown }
  | { ir: IRStatement };

export interface CallStatement {
  fn: string;
  args: Record<string, unknown>;
  out?: string;
}

export interface LetStatement {
  [varName: string]: unknown;
}

export interface ForeachStatement {
  var: string;
  range: { expr: string; args: Record<string, unknown> };
  do: Statement[];
}

export interface IRStatement {
  fn: string;
  args: Record<string, unknown>;
}

// Timeline events emitted by the interpreter
export interface TimelineEvent {
  id: string;
  type: 'board.init' | 'text.create' | 'text.update';
  args: Record<string, unknown>;
  timestamp: number; // Order in which event was emitted
}

export interface TextCreateEvent extends TimelineEvent {
  type: 'text.create';
  args: {
    id: string;
    text: string;
    mode: 'text' | 'math';
    at: LayoutPosition;
    style: StyleDef;
    t0: number;
    t1: number;
    ease: string;
  };
}

export interface TextUpdateEvent extends TimelineEvent {
  type: 'text.update';
  args: {
    id: string;
    toText: string;
    mode: 'text' | 'math';
    at: LayoutPosition;
    style: StyleDef;
    t0: number;
    t1: number;
    ease: string;
    transition: string;
  };
}

export interface BoardInitEvent extends TimelineEvent {
  type: 'board.init';
  args: {
    viewbox: number[];
    theme: { bg: string };
  };
}

// Expression types
export interface Expression {
  expr: string;
  args: Record<string, unknown>;
}

// Environment for variable resolution
export type Environment = Map<string, unknown>;

// Power representation for prime factorization
export interface Power {
  p: number;
  k: number;
}

// Ladder structure
export interface Ladder {
  left_values: number[];
  factors: number[];
}
