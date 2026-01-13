import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { ChevronRight, ChevronDown, ChevronUp, Code, Play, Layers, Wand2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { YAMLSpec, FunctionDef, Statement, Params } from '@/core/types';
import type { CallChainEntry } from '@/core/runtimeTracer';

// Giải thích ngữ nghĩa cho các hàm - bao gồm mô tả và ví dụ cụ thể
interface Explanation {
  description: string;
  example: string;
}

const functionExplanations: Record<string, Explanation> = {
  // Entry
  SimplifyRoot: {
    description: "Điểm vào chính điều phối toàn bộ hoạt ảnh đơn giản hóa căn bậc hai.",
    example: "SimplifyRoot(720) → phân tích 720, biến đổi thành √(2⁴×3²×5), rút gọn thành 12√5"
  },
  
  // Init
  InitScene: {
    description: "Khởi tạo canvas hoạt ảnh với kích thước viewbox và màu nền theme.",
    example: "InitScene({viewbox: [-10, 8, 10, -8], theme: 'dark'}) → canvas 20×16 nền tối"
  },
  Present_Intro: {
    description: "Hiển thị tiêu đề mở đầu và câu hỏi toán học với hiệu ứng fade-in.",
    example: "Present_Intro('Đơn Giản Hóa Căn', '√720 = ?') → tiêu đề xuất hiện t=0, câu hỏi t=0.5s"
  },
  
  // Scenes
  Scene_Factorization: {
    description: "Tính phân tích thừa số nguyên tố và hiển thị thang chia từng bước.",
    example: "Scene_Factorization(720) → 720÷2=360, 360÷2=180, ... tạo thang 7 hàng"
  },
  Scene_MorphToEquation: {
    description: "Biến đổi phân tích thừa số thành ký hiệu căn với hiệu ứng chuyển đổi.",
    example: "720 = 2⁴×3²×5 → √720 = √(2⁴×3²×5) với cross-fade 0.8s"
  },
  Scene_SimplifyEquation: {
    description: "Đơn giản hóa biểu thức căn bằng cách trích xuất bình phương hoàn hảo.",
    example: "√(2⁴×3²×5) → 2²×3×√5 → 12√5 với animation rút gọn"
  },
  
  // Subscenes
  Subscene_Divisions: {
    description: "Tính chuỗi phép chia lặp lại để xây dựng thang phân tích.",
    example: "720 → [{q:360, f:2}, {q:180, f:2}, {q:90, f:2}, {q:45, f:2}, {q:15, f:3}, {q:5, f:3}, {q:1, f:5}]"
  },
  Subscene_CountPowers: {
    description: "Đếm số lần xuất hiện của mỗi thừa số nguyên tố.",
    example: "[2,2,2,2,3,3,5] → {2: 4, 3: 2, 5: 1} → '2⁴ × 3² × 5'"
  },
  Subscene_FormatPrimeFactorExpr: {
    description: "Định dạng phân tích thừa số thành chuỗi LaTeX.",
    example: "{2:4, 3:2, 5:1} → '720 = 2^{4} \\times 3^{2} \\times 5'"
  },
  Subscene_RootRewrite: {
    description: "Viết lại phương trình với căn bậc hai áp dụng.",
    example: "'720 = 2⁴×3²×5' → '√720 = √(2⁴×3²×5)'"
  },
  Subscene_SplitRoots: {
    description: "Tách căn thành các hạng tử riêng biệt cho mỗi lũy thừa.",
    example: "√(2⁴×3²×5) → √2⁴ × √3² × √5"
  },
  Subscene_SimplifyFinalLatex: {
    description: "Tạo dạng đơn giản cuối cùng trích xuất lũy thừa chẵn.",
    example: "√2⁴ × √3² × √5 → 2² × 3 × √5 = 12√5"
  },
  
  // Presentation functions
  Present_Scene_Factorization: {
    description: "Tạo hoạt ảnh cảnh phân tích với thời gian cho từng hàng.",
    example: "7 hàng, span [2s, 8s] → mỗi hàng xuất hiện cách nhau 0.86s"
  },
  Present_Subscene_Divisions: {
    description: "Render từng hàng thang với thời gian so le.",
    example: "Hàng 0: t=2.0s (720|2), Hàng 1: t=2.86s (360|2), ..."
  },
  Present_Micro_LadderRow: {
    description: "Hiển thị một hàng thang: thừa số phải, thương trái.",
    example: "LadderRow(i=0, q=360, f=2) → '360' tại x=-2, '2' tại x=2, y=6"
  },
  Present_Subscene_PrimeFactorExpr: {
    description: "Hiển thị phương trình phân tích hoàn chỉnh ở dưới.",
    example: "'720 = 2⁴ × 3² × 5' tại y=-6, fade-in t=7.5s"
  },
  Present_Scene_MorphToEquation: {
    description: "Tạo hoạt ảnh cross-fade giữa các biểu diễn phương trình.",
    example: "Eq1 → Eq2: fade-out 0.4s, fade-in 0.4s, tổng 0.8s"
  },
  Present_Scene_SimplifyEquation: {
    description: "Tạo hoạt ảnh đơn giản hóa cuối cùng đến đáp án.",
    example: "'√(2⁴×3²×5)' cross-fade thành '12√5' trong 1.2s"
  },
  
  // Primitives
  IR_BoardInit: {
    description: "Lệnh IR cấp thấp khởi tạo bảng render.",
    example: "IR_BoardInit({viewbox: [-10,8,10,-8], theme: 'dark'}) → SVG 800×640px"
  },
  ShowTextTimed: {
    description: "Primitive tạo phần tử văn bản với vị trí và thời gian.",
    example: "ShowTextTimed({text: '720', pos: [0,6], t: 2.0, duration: 0.3})"
  },
  ShowMathTimed: {
    description: "Primitive tạo phần tử toán LaTeX với vị trí và thời gian.",
    example: "ShowMathTimed({latex: '\\\\sqrt{720}', pos: [0,0], t: 1.0, scale: 1.5})"
  },
  CrossFadeMathTimed: {
    description: "Primitive chuyển đổi mượt mà giữa hai biểu thức toán.",
    example: "CrossFadeMathTimed({from: 'A=B', to: '√A=√B', t: 8.0, duration: 0.8})"
  },
};

// Giải thích ngữ nghĩa cho các tham số - bao gồm cả nested params
const paramExplanations: Record<string, Explanation> = {
  number: {
    description: "Số đầu vào cần đơn giản hóa căn bậc hai.",
    example: `number: 720
→ √720 = 12√5

number: 48
→ √48 = 4√3`
  },
  limits: {
    description: "Ràng buộc an toàn ngăn hoạt ảnh quá dài.",
    example: `limits:
  max_factors: 10
  desired_rows_for_scale: 6`
  },
  max_factors: {
    description: "Số lượng thừa số nguyên tố tối đa cho phép.",
    example: `max_factors: 10
→ 720 có 7 thừa số (OK)
→ 2^15 có 15 thừa số (bị cắt)`
  },
  desired_rows_for_scale: {
    description: "Số hàng mục tiêu để tự động scale cỡ chữ.",
    example: `desired_rows_for_scale: 6
→ 7 hàng: scale = 6/7 ≈ 0.86
→ 5 hàng: scale = 6/5 = 1.2`
  },
  text: {
    description: "Chuỗi nội dung: tiêu đề và mẫu câu hỏi.",
    example: `text:
  title: "Đơn Giản Hóa Căn"
  prompt_template: "√\${N} = ?"`
  },
  title: {
    description: "Tiêu đề hiển thị ở đầu hoạt ảnh.",
    example: `title: "Đơn Giản Hóa Căn"
→ Hiển thị text lớn tại y=7`
  },
  prompt_template: {
    description: "Mẫu LaTeX cho câu hỏi, ${N} được thay thế.",
    example: `prompt_template: "√\${N} = ?"
với N=720 → "√720 = ?"
với N=48 → "√48 = ?"`
  },
  style: {
    description: "Style trực quan: màu sắc, tỷ lệ, độ đậm font.",
    example: `style:
  title_color: "#FFD700"
  scale: 1.2
  weight: "bold"`
  },
  title_color: {
    description: "Màu của tiêu đề (hex hoặc tên màu).",
    example: `title_color: "#FFD700"  → vàng gold
title_color: "#FF6B6B"  → đỏ coral`
  },
  text_color: {
    description: "Màu chữ mặc định cho các phần tử văn bản.",
    example: `text_color: "#FFFFFF"  → trắng
text_color: "#E0E0E0"  → xám nhạt`
  },
  final_color: {
    description: "Màu của kết quả cuối cùng (highlight).",
    example: `final_color: "#4ADE80"  → xanh lá
→ Làm nổi bật "12√5" khi hoàn thành`
  },
  board: {
    description: "Cài đặt canvas: viewbox và theme màu nền.",
    example: `board:
  viewbox: [-10, 8, 10, -8]
  theme: "dark"`
  },
  viewbox: {
    description: "Giới hạn tọa độ [xMin, yMax, xMax, yMin].",
    example: `viewbox: [-10, 8, 10, -8]
→ x: -10 đến 10 (rộng 20)
→ y: -8 đến 8 (cao 16)`
  },
  theme: {
    description: "Theme màu nền và phong cách.",
    example: `theme: "dark"   → nền đen #000000
theme: "light"  → nền trắng #FFFFFF`
  },
  layout: {
    description: "Định vị các phần tử: tiêu đề, câu hỏi, thang, phương trình.",
    example: `layout:
  title_at: {pos: [0, 7], anchor: "middle"}
  ladder: {x_left: -2, x_right: 2, y0: 5}`
  },
  title_at: {
    description: "Vị trí văn bản tiêu đề với điểm neo.",
    example: `title_at:
  pos: [0, 7]      → tọa độ (0, 7)
  anchor: "middle" → căn giữa`
  },
  prompt_at: {
    description: "Vị trí câu hỏi √N = ? bên dưới tiêu đề.",
    example: `prompt_at:
  pos: [0, 5.5]
  anchor: "middle"`
  },
  pos: {
    description: "Tọa độ [x, y] của phần tử.",
    example: `pos: [0, 7]    → giữa, trên
pos: [-5, 0]   → bên trái, giữa
pos: [3, -4]   → phải dưới`
  },
  anchor: {
    description: "Điểm neo văn bản: left, middle, right.",
    example: `anchor: "middle" → căn giữa
anchor: "left"   → căn trái
anchor: "right"  → căn phải`
  },
  ladder: {
    description: "Định vị thang chia: tọa độ x cột, y bắt đầu, khoảng cách.",
    example: `ladder:
  x_left: -2   → cột thương ở x=-2
  x_right: 2   → cột thừa số ở x=2
  y0: 4        → hàng đầu ở y=4
  dy: -1.2     → mỗi hàng cách 1.2`
  },
  x_left: {
    description: "Tọa độ x của cột bên trái (thương số).",
    example: `x_left: -2 → thương ở x=-2
x_left: -3 → dịch trái thêm`
  },
  x_right: {
    description: "Tọa độ x của cột bên phải (thừa số).",
    example: `x_right: 2 → thừa số ở x=2
x_right: 3 → dịch phải thêm`
  },
  y0: {
    description: "Tọa độ y của hàng đầu tiên.",
    example: `y0: 4 → hàng đầu ở y=4
y0: 6 → bắt đầu cao hơn`
  },
  dy: {
    description: "Khoảng cách y giữa các hàng (thường âm để đi xuống).",
    example: `dy: -1.2 → mỗi hàng cách 1.2 đơn vị
dy: -1.5 → giãn rộng hơn`
  },
  line_at: {
    description: "Vị trí dòng phương trình phân tích thừa số.",
    example: `line_at:
  pos: [0, -5]
  anchor: "middle"`
  },
  time: {
    description: "Cấu hình thời gian xuất hiện và chuyển đổi.",
    example: `time:
  intro: 0
  scene_spans:
    factorization: [2, 8]
    morphing: [9, 12]`
  },
  intro: {
    description: "Thời điểm bắt đầu phần giới thiệu (giây).",
    example: `intro: 0     → bắt đầu ngay
intro: 0.5   → delay 0.5 giây`
  },
  scene_spans: {
    description: "Khoảng thời gian tuyệt đối cho mỗi cảnh chính.",
    example: `scene_spans:
  factorization: [2, 8]   → 2s-8s
  morphing: [9, 12]       → 9s-12s
  simplify: [13, 16]      → 13s-16s`
  },
  factorization: {
    description: "Thời gian cho cảnh phân tích thừa số.",
    example: `factorization: [2, 8]
→ Bắt đầu: 2s, Kết thúc: 8s
→ 6 giây cho 7 hàng thang`
  },
  morphing: {
    description: "Thời gian cho biến đổi phương trình.",
    example: `morphing: [9, 12]
→ Cross-fade từ "720 = ..." 
→ thành "√720 = √(...)"`
  },
  simplify: {
    description: "Thời gian cho đơn giản hóa cuối cùng.",
    example: `simplify: [13, 16]
→ Biến đổi "√(2⁴×3²×5)"
→ thành "12√5"`
  },
  fade_duration: {
    description: "Thời gian chuyển đổi fade (giây).",
    example: `fade_duration: 0.8
→ Fade out: 0.4s
→ Fade in: 0.4s`
  },
  row_delay: {
    description: "Độ trễ giữa các hàng trong thang (giây).",
    example: `row_delay: 0.8
→ Hàng 0: t=2.0s
→ Hàng 1: t=2.8s
→ Hàng 2: t=3.6s`
  },
};

// Tokenize and highlight code examples
const highlightCode = (code: string): React.ReactNode[] => {
  const lines = code.split('\n');
  return lines.map((line, lineIdx) => {
    const tokens: React.ReactNode[] = [];
    let remaining = line;
    let key = 0;
    
    while (remaining.length > 0) {
      // Match keywords
      const keywordMatch = remaining.match(/^(call|let|foreach|ir|return|params|fn|args|expr|range|var|do)(?=\s|:|$)/);
      if (keywordMatch) {
        tokens.push(<span key={key++} className="text-purple-400">{keywordMatch[0]}</span>);
        remaining = remaining.slice(keywordMatch[0].length);
        continue;
      }
      
      // Match property keys (before colon)
      const propMatch = remaining.match(/^([a-zA-Z_][a-zA-Z0-9_]*)(?=\s*:)/);
      if (propMatch) {
        tokens.push(<span key={key++} className="text-orange-400">{propMatch[0]}</span>);
        remaining = remaining.slice(propMatch[0].length);
        continue;
      }
      
      // Match strings (double or single quoted)
      const stringMatch = remaining.match(/^("[^"]*"|'[^']*')/);
      if (stringMatch) {
        tokens.push(<span key={key++} className="text-green-400">{stringMatch[0]}</span>);
        remaining = remaining.slice(stringMatch[0].length);
        continue;
      }
      
      // Match numbers
      const numMatch = remaining.match(/^-?[\d.]+/);
      if (numMatch) {
        tokens.push(<span key={key++} className="text-cyan-400">{numMatch[0]}</span>);
        remaining = remaining.slice(numMatch[0].length);
        continue;
      }
      
      // Match variables ($name)
      const varMatch = remaining.match(/^\$[a-zA-Z_][a-zA-Z0-9_]*/);
      if (varMatch) {
        tokens.push(<span key={key++} className="text-cyan-300 italic">{varMatch[0]}</span>);
        remaining = remaining.slice(varMatch[0].length);
        continue;
      }
      
      // Match function names (like Scene_Factorization, core.format)
      const fnMatch = remaining.match(/^[A-Z][a-zA-Z0-9_]*|^[a-z]+\.[a-z]+/);
      if (fnMatch) {
        tokens.push(<span key={key++} className="text-primary">{fnMatch[0]}</span>);
        remaining = remaining.slice(fnMatch[0].length);
        continue;
      }
      
      // Match arrows and special operators
      const arrowMatch = remaining.match(/^(→|=|:|\[|\]|\{|\}|,)/);
      if (arrowMatch) {
        tokens.push(<span key={key++} className="text-muted-foreground">{arrowMatch[0]}</span>);
        remaining = remaining.slice(arrowMatch[0].length);
        continue;
      }
      
      // Match comments (after →)
      const commentMatch = remaining.match(/^(#.*)$/);
      if (commentMatch) {
        tokens.push(<span key={key++} className="text-muted-foreground italic">{commentMatch[0]}</span>);
        remaining = '';
        continue;
      }
      
      // Default: take one character
      tokens.push(<span key={key++}>{remaining[0]}</span>);
      remaining = remaining.slice(1);
    }
    
    return (
      <div key={lineIdx} className="leading-relaxed">
        {tokens.length > 0 ? tokens : <span>&nbsp;</span>}
      </div>
    );
  });
};

// Helper component to render explanation tooltip content
const ExplanationContent: React.FC<{ explanation: Explanation }> = ({ explanation }) => (
  <div className="space-y-2">
    <p className="font-medium text-foreground">{explanation.description}</p>
    <div className="border-t border-border/50 pt-2">
      <span className="text-primary/80 text-[10px] uppercase tracking-wide">Ví dụ:</span>
      <div className="mt-1 font-mono text-[10px] bg-muted/30 p-2 rounded border border-border/30">
        {highlightCode(explanation.example)}
      </div>
    </div>
  </div>
);

const getExplanation = (name: string): Explanation | null => {
  return functionExplanations[name] || paramExplanations[name] || null;
};

// Giải thích ngữ nghĩa cho các loại câu lệnh
const statementExplanations: Record<string, Explanation> = {
  call: {
    description: "Gọi một hàm với các đối số. Kết quả lưu bằng cú pháp → output.",
    example: `call:
  fn: Scene_Factorization
  args:
    N: 720
    scale: 1.0
→ result

# Gọi Scene_Factorization(N=720)`
  },
  let: {
    description: "Khai báo biến cục bộ với giá trị literal hoặc biểu thức.",
    example: `let:
  scale: 1.5
  offset:
    expr: "core.mul($i, 1.2)"
    args: {i: $i}

# scale = 1.5
# offset = i * 1.2 (tính động)`
  },
  foreach: {
    description: "Lặp qua range hoặc mảng, thực thi body cho mỗi phần tử.",
    example: `foreach:
  var: i
  range: [0, 7]
  do:
    - call: {fn: ShowRow, args: {idx: $i}}

# i = 0 → ShowRow(idx=0)
# i = 1 → ShowRow(idx=1)
# ...
# i = 6 → ShowRow(idx=6)`
  },
  ir: {
    description: "Lệnh IR phát trực tiếp lệnh render cấp thấp đến timeline.",
    example: `ir:
  fn: text.show
  args:
    id: "title"
    text: "Đơn Giản Hóa"
    pos: [0, 7]
    t: 0.5

# Emit timeline event: showText tại t=0.5s`
  },
  return: {
    description: "Trả về giá trị từ hàm, làm giá trị khả dụng cho caller.",
    example: `return:
  expr: "$result"

# Trả về biến result
# Caller có thể dùng: → myVar`
  },
  params: {
    description: "Tham số đầu vào cho hàm, tham chiếu bằng $paramName.",
    example: `params: [N, scale]

# Trong body:
# $N → 720
# $scale → 1.0`
  },
};

// Unique key for a statement: fnName + stmtIndex
type StatementKey = { fnName: string; stmtIndex: number };

// Build upstream call chain for a statement - find which statements call the function containing this statement
function buildUpstreamChain(
  targetFnName: string,
  spec: YAMLSpec
): StatementKey[] {
  if (!spec.defs) return [];
  
  const chain: StatementKey[] = [];
  const visited = new Set<string>();
  
  // Find all functions that call targetFnName directly
  const findCallers = (fnName: string): StatementKey[] => {
    if (visited.has(fnName)) return [];
    visited.add(fnName);
    
    const callers: StatementKey[] = [];
    
    for (const [callerFnName, callerDef] of Object.entries(spec.defs!)) {
      callerDef.body.forEach((stmt, stmtIndex) => {
        if ('call' in stmt && stmt.call.fn === fnName) {
          callers.push({ fnName: callerFnName, stmtIndex });
        }
        // Also check foreach body for calls
        if ('foreach' in stmt) {
          stmt.foreach.do.forEach((innerStmt, innerIdx) => {
            if ('call' in innerStmt && innerStmt.call.fn === fnName) {
              // For foreach, we track the foreach statement itself
              callers.push({ fnName: callerFnName, stmtIndex });
            }
          });
        }
      });
    }
    
    return callers;
  };
  
  // Build chain from target up to entry point
  let currentFn = targetFnName;
  const entryFn = spec.program?.entry?.call?.fn;
  
  while (currentFn && currentFn !== entryFn) {
    const callers = findCallers(currentFn);
    if (callers.length === 0) break;
    
    // Take first caller (most common path)
    const caller = callers[0];
    chain.push(caller);
    currentFn = caller.fnName;
  }
  
  return chain;
}

// Key for a highlighted param: fnName + stmtIndex + paramPath (e.g., "args.N" or "args.pos.0")
export type ParamHighlightKey = { fnName: string; stmtIndex: number; paramPath: string };

interface YAMLTreePanelProps {
  spec: YAMLSpec | null;
  onFunctionSelect?: (fnName: string) => void;
  selectedFunction?: string | null;
  onParamsChange?: (params: Params) => void;
  onFunctionArgsChange?: (fnName: string, stmtIndex: number, newArgs: Record<string, unknown>) => void;
  paramsExpanded?: boolean;
  expandedParams?: Set<string>;
  expandedFunctions?: Set<string>;
  onParamsExpandedChange?: (expanded: boolean) => void;
  onExpandedParamsChange?: (expanded: Set<string>) => void;
  onExpandedFunctionsChange?: (expanded: Set<string>) => void;
  highlightedElementId?: string | null;
  // Call chain for primary/secondary highlighting
  elementCallChain?: CallChainEntry[] | null;
  zoomLevel?: number;
  // Callback when a statement is clicked
  onStatementClick?: (fnName: string, stmtIndex: number) => void;
  // Currently selected statement for highlighting
  selectedStatement?: { fnName: string; stmtIndex: number } | null;
  // Callback when a function definition is clicked (to highlight all calls)
  onFunctionDefinitionClick?: (fnName: string) => void;
  // Currently selected function definition for highlighting
  selectedFunctionDefinition?: string | null;
}

interface FunctionNode {
  name: string;
  def: FunctionDef;
  children: string[]; // Functions this one calls
  category: 'entry' | 'logic' | 'presentation' | 'primitive';
}

// Extract function calls from statements
function extractCalls(statements: Statement[]): string[] {
  const calls: string[] = [];
  
  for (const stmt of statements) {
    if ('call' in stmt) {
      const fnName = stmt.call.fn;
      // Skip IR functions
      if (!fnName.includes('.')) {
        calls.push(fnName);
      }
    }
    if ('foreach' in stmt) {
      calls.push(...extractCalls(stmt.foreach.do));
    }
  }
  
  return [...new Set(calls)];
}

// Categorize function based on its behavior
function categorizeFunction(name: string, def: FunctionDef, entryFn: string): FunctionNode['category'] {
  if (name === entryFn) return 'entry';
  
  // Check if it only emits IR (primitive)
  const hasOnlyIR = def.body.every(stmt => 'ir' in stmt || 'return' in stmt);
  if (hasOnlyIR) return 'primitive';
  
  // Check if it calls ShowTextTimed, ShowMathTimed, etc. (presentation)
  const calls = extractCalls(def.body);
  const presentationPatterns = ['Show', 'CrossFade', 'Present', 'Animate'];
  const isPresentation = presentationPatterns.some(p => name.includes(p)) ||
    calls.some(c => presentationPatterns.some(p => c.includes(p)));
  if (isPresentation) return 'presentation';
  
  return 'logic';
}

// Build function tree
function buildTree(spec: YAMLSpec): Map<string, FunctionNode> {
  const nodes = new Map<string, FunctionNode>();
  const entryFn = spec.program?.entry?.call?.fn || '';
  
  if (!spec.defs) return nodes;
  
  for (const [name, def] of Object.entries(spec.defs)) {
    const children = extractCalls(def.body);
    nodes.set(name, {
      name,
      def,
      children,
      category: categorizeFunction(name, def, entryFn),
    });
  }
  
  return nodes;
}

function formatValue(v: unknown): string {
  if (typeof v === 'string') {
    if (v.startsWith('$')) return v;
    if (v.startsWith('$.')) return v;
    return `"${v}"`;
  }
  if (typeof v === 'object' && v !== null) {
    if ('expr' in v) return `expr(${(v as {expr: string}).expr})`;
    return JSON.stringify(v);
  }
  return String(v);
}

// Determine if a value is safely editable (won't break DSL execution)
function isSafelyEditable(value: unknown): boolean {
  // Numbers are always safe to edit
  if (typeof value === 'number') return true;
  
  // Strings that start with $ are variable/param references - NOT safe
  if (typeof value === 'string') {
    if (value.startsWith('$')) return false; // Variable ref like $N, $Ladder
    if (value.startsWith('$.')) return false; // Param ref like $.params.number
    return true; // Plain string literals are safe
  }
  
  // Objects (expr, nested) are not directly editable
  return false;
}

// Get visual style class based on editability
function getValueStyle(value: unknown, isEditable: boolean): string {
  if (isEditable && isSafelyEditable(value)) {
    return 'text-foreground'; // Bright, clearly editable
  }
  
  // Read-only styles based on type
  if (typeof value === 'string' && value.startsWith('$')) {
    return 'text-cyan-500/70 italic'; // Variable references
  }
  if (typeof value === 'object' && value !== null && 'expr' in value) {
    return 'text-blue-400/70 italic'; // Expressions
  }
  return 'text-muted-foreground'; // Other read-only
}

// Statement component with expandable args
interface StatementRowProps {
  stmt: Statement;
  fnName: string;
  stmtIndex: number;
  defaultExpanded?: boolean;
  editable?: boolean;
  onArgsChange?: (newArgs: Record<string, unknown>) => void;
  highlightLevel?: 'primary' | 'secondary' | null;
  onClick?: () => void;
  isSelected?: boolean;
  // Chain navigation props
  isCurrentNav?: boolean;
  isInChain?: boolean;
  canGoUp?: boolean;
  canGoDown?: boolean;
  onNavigateUp?: () => void;
  onNavigateDown?: () => void;
  navIndex?: number;
  chainLength?: number;
  // Param highlighting props
  highlightedParams?: ParamHighlightKey[];
  onParamClick?: (fnName: string, stmtIndex: number, paramPath: string) => void;
  // Force expand when params are highlighted
  forceExpanded?: boolean;
}

const StatementRow: React.FC<StatementRowProps> = ({ 
  stmt, 
  fnName,
  stmtIndex,
  defaultExpanded = false,
  editable = false,
  onArgsChange,
  highlightLevel = null,
  onClick,
  isSelected = false,
  isCurrentNav = false,
  isInChain = false,
  canGoUp = false,
  canGoDown = false,
  onNavigateUp,
  onNavigateDown,
  navIndex = 0,
  chainLength = 0,
  highlightedParams = [],
  onParamClick,
  forceExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const rowRef = useRef<HTMLDivElement>(null);
  
  // Auto-expand when forceExpanded changes to true
  useEffect(() => {
    if (forceExpanded && !expanded) {
      setExpanded(true);
    }
  }, [forceExpanded]);
  
  // Use forceExpanded OR manual expanded state
  const isExpanded = forceExpanded || expanded;
  
  // Debug: check if onClick is passed
  const handleRowClick = () => {
    console.log('StatementRow clicked, onClick defined:', !!onClick);
    onClick?.();
  };
  
  // Highlight styles: current nav is bright green, chain items are dim yellow, selected is yellow
  const highlightClass = isCurrentNav
    ? 'bg-green-500/40 ring-2 ring-green-400/70 rounded cursor-pointer shadow-lg shadow-green-500/20'
    : isInChain
    ? 'bg-yellow-500/10 ring-1 ring-yellow-400/40 rounded cursor-pointer'
    : isSelected
    ? 'bg-yellow-500/30 ring-2 ring-yellow-400/70 rounded cursor-pointer'
    : highlightLevel === 'primary' 
    ? 'bg-primary/30 ring-2 ring-primary/60 rounded cursor-pointer' 
    : highlightLevel === 'secondary' 
    ? 'bg-primary/10 ring-1 ring-primary/20 rounded cursor-pointer' 
    : 'cursor-pointer hover:bg-muted/20';
  
  // Show nav buttons only on current navigation position
  const showNavButtons = isCurrentNav;
  
  // Render navigation buttons
  const renderNavButtons = () => {
    if (!showNavButtons) return null;
    return (
      <div className="flex items-center gap-0.5 shrink-0 ml-auto" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 hover:bg-muted"
          onClick={(e) => { e.stopPropagation(); onNavigateUp?.(); }}
          disabled={!canGoUp}
          title="Navigate up to parent caller"
        >
          <ChevronUp className="h-3 w-3" />
        </Button>
        <span className="text-[10px] text-muted-foreground w-8 text-center">
          {navIndex}/{chainLength}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 hover:bg-muted -ml-1"
          onClick={(e) => { e.stopPropagation(); onNavigateDown?.(); }}
          disabled={!canGoDown}
          title="Navigate down toward anchor"
        >
          <ChevronDown className="h-3 w-3" />
        </Button>
      </div>
    );
  };
  
  // Auto-scroll into view when current nav, primary highlight, or has highlighted params
  useEffect(() => {
    if ((isCurrentNav || highlightLevel === 'primary' || forceExpanded) && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isCurrentNav, highlightLevel, forceExpanded]);
  
  const handleArgChange = (key: string, value: string, originalValue: unknown) => {
    if (!onArgsChange || !('call' in stmt)) return;
    
    // Parse value based on original type
    let parsed: unknown = value;
    if (typeof originalValue === 'number') {
      parsed = value.trim() !== '' && !isNaN(Number(value)) ? Number(value) : value;
    } else if (typeof originalValue === 'boolean') {
      parsed = value === 'true';
    }
    
    const newArgs = { ...stmt.call.args, [key]: parsed };
    onArgsChange(newArgs);
  };
  
  if ('call' in stmt) {
    const args = Object.entries(stmt.call.args);
    const out = stmt.call.out ? ` → ${stmt.call.out}` : '';
    const hasArgs = args.length > 0;
    
    return (
      <div ref={rowRef} className={`py-1 ${highlightClass}`} onClick={handleRowClick}>
        <div 
          className="flex items-center gap-1 rounded px-1 -mx-1"
          onClick={(e) => { if (hasArgs) { e.stopPropagation(); setExpanded(!isExpanded); handleRowClick(); } }}
        >
          {hasArgs ? (
            isExpanded ? (
              <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
            )
          ) : (
            <span className="w-3" />
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-purple-400 cursor-help">call</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-sm text-xs">
              <ExplanationContent explanation={statementExplanations.call} />
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-primary cursor-help">{stmt.call.fn}</span>
            </TooltipTrigger>
            {getExplanation(stmt.call.fn) && (
              <TooltipContent side="top" className="max-w-sm text-xs">
                <ExplanationContent explanation={getExplanation(stmt.call.fn)!} />
              </TooltipContent>
            )}
          </Tooltip>
          {!isExpanded && hasArgs && (
            <span className="text-muted-foreground/60">({args.length} args)</span>
          )}
          {out && <span className="text-green-400">{out}</span>}
          {renderNavButtons()}
        </div>
        {isExpanded && hasArgs && (
          <div className="ml-6 pl-2 border-l border-border/40 mt-1 space-y-0.5">
            {args.map(([k, v]) => {
              const canEdit = editable && isSafelyEditable(v);
              const paramPath = `args.${k}`;
              const isParamHighlighted = highlightedParams.some(
                p => p.fnName === fnName && p.stmtIndex === stmtIndex && p.paramPath === paramPath
              );
              const highlightClass = isParamHighlighted 
                ? 'bg-cyan-500/30 ring-1 ring-cyan-400/60 rounded px-1 -mx-1' 
                : 'hover:bg-muted/30 rounded px-1 -mx-1 cursor-pointer';
              
              return (
                <div 
                  key={k} 
                  className={`flex items-center gap-2 ${highlightClass}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onParamClick?.(fnName, stmtIndex, paramPath);
                  }}
                >
                  <span className="text-orange-400 min-w-[60px]">{k}:</span>
                  {canEdit ? (
                    <Input
                      type={typeof v === 'number' ? 'number' : 'text'}
                      value={String(v)}
                      onChange={(e) => handleArgChange(k, e.target.value, v)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-5 text-xs px-1.5 py-0 bg-primary/10 border-primary/30 hover:border-primary/50 focus:border-primary w-24"
                    />
                  ) : (
                    <span className={`break-all text-xs ${getValueStyle(v, editable)}`}>
                      {formatValue(v)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }
  
  if ('let' in stmt) {
    const vars = Object.entries(stmt.let);
    const hasVars = vars.length > 0;
    
    const handleLetArgChange = (varName: string, argKey: string, value: string, originalValue: unknown) => {
      if (!onArgsChange) return;
      
      let parsed: unknown = value;
      if (typeof originalValue === 'number') {
        parsed = value.trim() !== '' && !isNaN(Number(value)) ? Number(value) : value;
      }
      
      const varValue = stmt.let[varName] as { expr: string; args: Record<string, unknown> };
      if (varValue && typeof varValue === 'object' && 'args' in varValue) {
        const newLetStmt = {
          ...stmt.let,
          [varName]: {
            ...varValue,
            args: { ...varValue.args, [argKey]: parsed }
          }
        };
        onArgsChange(newLetStmt);
      }
    };
    
    return (
      <div ref={rowRef} className={`py-1 ${highlightClass}`} onClick={handleRowClick}>
        <div 
          className="flex items-center gap-1 rounded px-1 -mx-1"
          onClick={(e) => { if (hasVars) { e.stopPropagation(); setExpanded(!isExpanded); handleRowClick(); } }}
        >
          {hasVars ? (
            isExpanded ? (
              <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
            )
          ) : (
            <span className="w-3" />
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-yellow-400 cursor-help">let</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-sm text-xs">
              <ExplanationContent explanation={statementExplanations.let} />
            </TooltipContent>
          </Tooltip>
          {!isExpanded && <span className="text-muted-foreground/60">({vars.length} vars)</span>}
          {renderNavButtons()}
        </div>
        {isExpanded && hasVars && (
          <div className="ml-6 pl-2 border-l border-border/40 mt-1 space-y-1">
            {vars.map(([k, v]) => {
              // Check if it's an expression with args
              const isExpr = typeof v === 'object' && v !== null && 'expr' in v && 'args' in v;
              const exprObj = isExpr ? v as { expr: string; args: Record<string, unknown> } : null;
              const canEditLet = editable && isSafelyEditable(v);
              
              // Check if this let variable is highlighted
              const paramPath = `let.${k}`;
              const isParamHighlighted = highlightedParams.some(
                p => p.fnName === fnName && p.stmtIndex === stmtIndex && p.paramPath === paramPath
              );
              const paramHighlightClass = isParamHighlighted 
                ? 'bg-cyan-500/30 ring-1 ring-cyan-400/60 rounded px-1 -mx-1' 
                : 'hover:bg-muted/30 rounded px-1 -mx-1 cursor-pointer';
              
              return (
                <div 
                  key={k}
                  className={paramHighlightClass}
                  onClick={(e) => {
                    e.stopPropagation();
                    onParamClick?.(fnName, stmtIndex, paramPath);
                  }}
                >
                  <div className="flex gap-2 items-center">
                    <span className="text-green-400">{k}</span>
                    <span className="text-muted-foreground">=</span>
                    {isExpr ? (
                      <span className="text-blue-400/70 italic text-xs">expr({exprObj?.expr})</span>
                    ) : canEditLet ? (
                      <Input
                        type={typeof v === 'number' ? 'number' : 'text'}
                        value={String(v)}
                        onChange={(e) => {
                          const parsed = typeof v === 'number' && !isNaN(Number(e.target.value)) 
                            ? Number(e.target.value) 
                            : e.target.value;
                          onArgsChange?.({ ...stmt.let, [k]: parsed });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="h-5 text-xs px-1.5 py-0 bg-primary/10 border-primary/30 hover:border-primary/50 focus:border-primary w-24"
                      />
                    ) : (
                      <span className={`break-all text-xs ${getValueStyle(v, editable)}`}>{formatValue(v)}</span>
                    )}
                  </div>
                  {/* Show editable args for expr */}
                  {isExpr && exprObj && Object.keys(exprObj.args).length > 0 && (
                    <div className="ml-4 pl-2 border-l border-border/30 mt-1 space-y-0.5">
                      {Object.entries(exprObj.args).map(([argK, argV]) => {
                        const canEditArg = editable && isSafelyEditable(argV);
                        const exprArgPath = `let.${k}.args.${argK}`;
                        const isExprArgHighlighted = highlightedParams.some(
                          p => p.fnName === fnName && p.stmtIndex === stmtIndex && p.paramPath === exprArgPath
                        );
                        const exprArgClass = isExprArgHighlighted 
                          ? 'bg-cyan-500/30 ring-1 ring-cyan-400/60 rounded px-1 -mx-1' 
                          : 'hover:bg-muted/30 rounded px-1 -mx-1 cursor-pointer';
                        
                        return (
                          <div 
                            key={argK} 
                            className={`flex items-center gap-2 ${exprArgClass}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onParamClick?.(fnName, stmtIndex, exprArgPath);
                            }}
                          >
                            <span className="text-orange-400 text-xs min-w-[50px]">{argK}:</span>
                            {canEditArg ? (
                              <Input
                                type={typeof argV === 'number' ? 'number' : 'text'}
                                value={String(argV)}
                                onChange={(e) => handleLetArgChange(k, argK, e.target.value, argV)}
                                onClick={(e) => e.stopPropagation()}
                                className="h-5 text-xs px-1.5 py-0 bg-primary/10 border-primary/30 hover:border-primary/50 focus:border-primary w-24"
                              />
                            ) : (
                              <span className={`text-xs ${getValueStyle(argV, editable)}`}>{formatValue(argV)}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }
  
  if ('foreach' in stmt) {
    return (
      <div ref={rowRef} className={`py-1 ${highlightClass}`} onClick={handleRowClick}>
        <div 
          className="flex items-center gap-1 rounded px-1 -mx-1"
          onClick={(e) => { e.stopPropagation(); setExpanded(!isExpanded); handleRowClick(); }}
        >
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-pink-400 cursor-help">foreach</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-sm text-xs">
              <ExplanationContent explanation={statementExplanations.foreach} />
            </TooltipContent>
          </Tooltip>
          <span className="text-green-400">{stmt.foreach.var}</span>
          <span className="text-muted-foreground">in</span>
          <span className="text-foreground/80">{formatValue(stmt.foreach.range)}</span>
          {renderNavButtons()}
        </div>
        {isExpanded && (
          <div className="ml-6 pl-2 border-l border-border/40 mt-1">
            {stmt.foreach.do.map((s, i) => (
              <StatementRow key={i} stmt={s} fnName={fnName} stmtIndex={stmtIndex} />
            ))}
          </div>
        )}
      </div>
    );
  }
  
  if ('ir' in stmt) {
    const args = Object.entries(stmt.ir.args);
    const hasArgs = args.length > 0;
    
    const handleIrArgChange = (key: string, value: string, originalValue: unknown) => {
      if (!onArgsChange) return;
      
      let parsed: unknown = value;
      if (typeof originalValue === 'number') {
        parsed = value.trim() !== '' && !isNaN(Number(value)) ? Number(value) : value;
      }
      
      onArgsChange({ ...stmt.ir.args, [key]: parsed });
    };
    
    return (
      <div ref={rowRef} className={`py-1 ${highlightClass}`} onClick={handleRowClick}>
        <div 
          className="flex items-center gap-1 rounded px-1 -mx-1"
          onClick={(e) => { if (hasArgs) { e.stopPropagation(); setExpanded(!isExpanded); handleRowClick(); } }}
        >
          {hasArgs ? (
            isExpanded ? (
              <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
            )
          ) : (
            <span className="w-3" />
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-orange-400 cursor-help">ir</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-sm text-xs">
              <ExplanationContent explanation={statementExplanations.ir} />
            </TooltipContent>
          </Tooltip>
          <span className="text-primary">{stmt.ir.fn}</span>
          {!isExpanded && hasArgs && (
            <span className="text-muted-foreground/60">({args.length} args)</span>
          )}
          {renderNavButtons()}
        </div>
        {isExpanded && hasArgs && (
          <div className="ml-6 pl-2 border-l border-border/40 mt-1 space-y-0.5">
            {args.map(([k, v]) => {
              const canEdit = editable && isSafelyEditable(v);
              const paramPath = `args.${k}`;
              const isParamHighlighted = highlightedParams.some(
                p => p.fnName === fnName && p.stmtIndex === stmtIndex && p.paramPath === paramPath
              );
              const paramHighlightClass = isParamHighlighted 
                ? 'bg-cyan-500/30 ring-1 ring-cyan-400/60 rounded px-1 -mx-1' 
                : 'hover:bg-muted/30 rounded px-1 -mx-1 cursor-pointer';
              
              return (
                <div 
                  key={k} 
                  className={`flex items-center gap-2 ${paramHighlightClass}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onParamClick?.(fnName, stmtIndex, paramPath);
                  }}
                >
                  <span className="text-orange-400 min-w-[50px]">{k}:</span>
                  {canEdit ? (
                    <Input
                      type={typeof v === 'number' ? 'number' : 'text'}
                      value={String(v)}
                      onChange={(e) => handleIrArgChange(k, e.target.value, v)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-5 text-xs px-1.5 py-0 bg-primary/10 border-primary/30 hover:border-primary/50 focus:border-primary w-24"
                    />
                  ) : (
                    <span className={`break-all text-xs ${getValueStyle(v, editable)}`}>{formatValue(v)}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }
  
  if ('return' in stmt) {
    return (
      <div ref={rowRef} className={`py-1 ${highlightClass}`} onClick={handleRowClick}>
        <div className="flex items-center gap-1">
          <span className="w-3" />
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-red-400 cursor-help">return</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-sm text-xs">
              <ExplanationContent explanation={statementExplanations.return} />
            </TooltipContent>
          </Tooltip>
          <span className="text-foreground/80">{formatValue(stmt.return)}</span>
          {renderNavButtons()}
        </div>
      </div>
    );
  }
  
  return <div className="py-1 text-muted-foreground">???</div>;
};

const categoryColors: Record<FunctionNode['category'], string> = {
  entry: 'text-primary',
  logic: 'text-primary',
  presentation: 'text-primary',
  primitive: 'text-primary',
};

const categoryIcons: Record<FunctionNode['category'], React.ReactNode> = {
  entry: <Play className="w-3.5 h-3.5" />,
  logic: <Play className="w-3.5 h-3.5" />,
  presentation: <Play className="w-3.5 h-3.5" />,
  primitive: <Play className="w-3.5 h-3.5" />,
};

const categoryLabels: Record<FunctionNode['category'], string> = {
  entry: 'Entry Point',
  logic: 'Logic',
  presentation: 'Presentation',
  primitive: 'Primitive',
};

interface TreeNodeProps {
  node: FunctionNode;
  allNodes: Map<string, FunctionNode>;
  depth: number;
  expanded: Set<string>;
  onToggle: (name: string) => void;
  selected: string | null;
  onSelect: (name: string) => void;
  editable?: boolean;
  onArgsChange?: (stmtIndex: number, newArgs: Record<string, unknown>) => void;
  highlightedElementId?: string | null;
  // Call chain for primary/secondary highlighting
  elementCallChain?: CallChainEntry[] | null;
  // Callback when a statement is clicked
  onStatementClick?: (fnName: string, stmtIndex: number) => void;
  // Currently selected statement for highlighting
  selectedStatement?: { fnName: string; stmtIndex: number } | null;
  // Callback when a function definition header is clicked
  onFunctionDefinitionClick?: (fnName: string) => void;
  // Currently selected function definition for highlighting
  selectedFunctionDefinition?: string | null;
  // Statement chain navigation props
  currentNavStatement?: StatementKey | null;
  chainStatements?: StatementKey[];
  canGoUp?: boolean;
  canGoDown?: boolean;
  onNavigateUp?: () => void;
  onNavigateDown?: () => void;
  navIndex?: number;
  chainLength?: number;
  // Function chain navigation props
  currentNavFnKey?: StatementKey | null;
  fnChainStatements?: StatementKey[];
  fnCanGoUp?: boolean;
  fnCanGoDown?: boolean;
  onFnNavigateUp?: () => void;
  onFnNavigateDown?: () => void;
  fnNavIndex?: number;
  fnChainLength?: number;
  // Param highlighting props
  highlightedParams?: ParamHighlightKey[];
  onParamClick?: (fnName: string, stmtIndex: number, paramPath: string) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  allNodes,
  depth,
  expanded,
  onToggle,
  selected,
  onSelect,
  editable = false,
  onArgsChange,
  highlightedElementId,
  elementCallChain,
  onStatementClick,
  selectedStatement,
  onFunctionDefinitionClick,
  selectedFunctionDefinition,
  currentNavStatement,
  chainStatements = [],
  canGoUp = false,
  canGoDown = false,
  onNavigateUp,
  onNavigateDown,
  navIndex = 0,
  chainLength = 0,
  // Function navigation props
  currentNavFnKey,
  fnChainStatements = [],
  fnCanGoUp = false,
  fnCanGoDown = false,
  onFnNavigateUp,
  onFnNavigateDown,
  fnNavIndex = 0,
  fnChainLength = 0,
  // Param highlighting props
  highlightedParams = [],
  onParamClick,
}) => {
  const isExpanded = expanded.has(node.name);
  const hasBody = node.def.body.length > 0;
  const isSelected = selected === node.name;
  const headerRef = useRef<HTMLDivElement>(null);
  
  // Check if this function header is the current navigation position
  const isFnCurrentNav = currentNavFnKey?.fnName === node.name && currentNavFnKey?.stmtIndex === -1;
  
  // Check if this function header is in the chain (as a statement caller, not the header itself)
  const isFnInChain = fnChainStatements.some(s => s.fnName === node.name && s.stmtIndex === -1);
  
  // Check if a statement in this function is the current navigation position for function chain
  const isStmtFnCurrentNav = currentNavFnKey?.fnName === node.name && currentNavFnKey?.stmtIndex >= 0;
  const fnNavStmtIndex = currentNavFnKey?.stmtIndex ?? -1;
  
  // Check if a statement in this function is in the function chain
  const getStmtFnInChain = (stmtIdx: number) => 
    fnChainStatements.some(s => s.fnName === node.name && s.stmtIndex === stmtIdx);
  
  // Auto-scroll function header into view when current nav
  useEffect(() => {
    if (isFnCurrentNav && headerRef.current) {
      headerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isFnCurrentNav]);
  
  // Check if any statement in this node creates/targets the highlighted element
  // This returns an array of all element IDs that could be created by this statement
  const getStatementElementIds = (stmt: Statement): string[] => {
    const ids: string[] = [];
    
    // Check ir statements (primitives)
    if ('ir' in stmt && stmt.ir.args.id) {
      const id = stmt.ir.args.id;
      // Only match if it's a literal string, not a variable reference
      if (typeof id === 'string' && !id.startsWith('$')) {
        ids.push(id);
      }
    }
    // Check call statements with id argument
    if ('call' in stmt && stmt.call.args.id) {
      const id = stmt.call.args.id;
      // Only match if it's a literal string, not a variable reference or expression
      if (typeof id === 'string' && !id.startsWith('$')) {
        ids.push(id);
      }
    }
    // Check foreach loops - if the loop generates IDs with patterns like R0, R1, L0, L1...
    // We mark the foreach as containing the ID if the pattern matches
    if ('foreach' in stmt) {
      // Check inner statements for ID patterns
      for (const innerStmt of stmt.foreach.do) {
        const innerIds = getStatementElementIds(innerStmt);
        ids.push(...innerIds);
      }
    }
    return ids;
  };
  
  // Check if a statement could generate an element with a pattern-based ID
  // This matches IDs like "R0", "R1", "L0", "L1" to foreach loops that generate them
  const statementMatchesElementId = (stmt: Statement, elementId: string): boolean => {
    const directIds = getStatementElementIds(stmt);
    if (directIds.includes(elementId)) return true;
    
    // Check for pattern-based ID generation in call statements (e.g., core.format('R%d', i))
    if ('call' in stmt && stmt.call.args.id) {
      const idArg = stmt.call.args.id;
      if (typeof idArg === 'object' && idArg !== null && 'expr' in idArg) {
        const expr = (idArg as { expr: string }).expr;
        // Match patterns like "core.format('R%d', i)" or "core.format('L%d', ...)"
        const formatMatch = expr.match(/core\.format\s*\(\s*['"]([^'"]+)['"]/);
        if (formatMatch) {
          const pattern = formatMatch[1]; // e.g., "R%d" or "L%d"
          // Convert pattern to regex: "R%d" -> /^R\d+$/
          const regexPattern = pattern.replace(/%d/g, '\\d+');
          const regex = new RegExp(`^${regexPattern}$`);
          if (regex.test(elementId)) return true;
        }
      }
    }
    
    // For foreach loops, check inner statements recursively
    if ('foreach' in stmt) {
      for (const innerStmt of stmt.foreach.do) {
        if (statementMatchesElementId(innerStmt, elementId)) return true;
      }
    }
    return false;
  };
  
// Check if this function definition is selected for highlighting
  const isFnDefSelected = selectedFunctionDefinition === node.name;
  
  // Determine function header highlight class
  const fnHeaderHighlightClass = isFnCurrentNav
    ? 'bg-green-500/40 ring-2 ring-green-400/70 shadow-lg shadow-green-500/20'
    : isFnInChain
    ? 'bg-yellow-500/10 ring-1 ring-yellow-400/40'
    : isFnDefSelected 
    ? 'bg-yellow-500/30 ring-2 ring-yellow-400/70' 
    : isSelected 
    ? 'bg-primary/20 ring-1 ring-primary/40' 
    : 'hover:bg-muted/50';
  
  // Render function navigation buttons
  const renderFnNavButtons = () => {
    if (!isFnCurrentNav) return null;
    return (
      <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 hover:bg-muted"
          onClick={(e) => { e.stopPropagation(); onFnNavigateUp?.(); }}
          disabled={!fnCanGoUp}
          title="Navigate up to parent caller"
        >
          <ChevronUp className="h-3 w-3" />
        </Button>
        <span className="text-[10px] text-muted-foreground w-8 text-center">
          {fnNavIndex}/{fnChainLength}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 hover:bg-muted -ml-1"
          onClick={(e) => { e.stopPropagation(); onFnNavigateDown?.(); }}
          disabled={!fnCanGoDown}
          title="Navigate down toward anchor"
        >
          <ChevronDown className="h-3 w-3" />
        </Button>
      </div>
    );
  };
  
  return (
    <div>
      {/* Function header */}
      <div
        ref={headerRef}
        className={`
          flex items-center gap-1.5 px-2 py-1.5 cursor-pointer rounded transition-colors
          ${fnHeaderHighlightClass}
        `}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => {
          onSelect(node.name);
          onFunctionDefinitionClick?.(node.name);
        }}
      >
        {/* Expand/collapse button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle(node.name);
          }}
          className={`p-0.5 rounded hover:bg-muted ${!hasBody && 'invisible'}`}
        >
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>
        
        {/* Category icon */}
        <span className={categoryColors[node.category]}>
          {categoryIcons[node.category]}
        </span>
        
        {/* Function name with tooltip */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`font-mono text-sm ${categoryColors[node.category]} cursor-help`}>
              {node.name}
            </span>
          </TooltipTrigger>
          {getExplanation(node.name) && (
            <TooltipContent side="right" className="max-w-sm text-xs">
              <ExplanationContent explanation={getExplanation(node.name)!} />
            </TooltipContent>
          )}
        </Tooltip>
        
        {/* Params */}
        {node.def.params && node.def.params.length > 0 && (
          <span className="text-xs text-muted-foreground">
            ({node.def.params.join(', ')})
          </span>
        )}
        
        {/* Function navigation buttons */}
        {renderFnNavButtons()}
        
        {/* Category badge - push to end if no nav buttons */}
        {!isFnCurrentNav && (
          <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${categoryColors[node.category]} bg-current/10`}>
            {categoryLabels[node.category]}
          </span>
        )}
      </div>
      
      {/* Expanded content - just the function body */}
      {isExpanded && (
        <div className="border-l border-border/50 ml-6">
          <div className="py-1 px-3 text-xs font-mono bg-muted/20 rounded-r my-1 mx-2">
          {node.def.body.map((stmt, idx) => {
              // Determine highlight level based on call chain
              // Only highlight the lowest-level statement (first entry = direct creator)
              let highlightLevel: 'primary' | 'secondary' | null = null;
              if (elementCallChain && elementCallChain.length > 0) {
                // Primary = first entry in chain only (direct creator at lowest level)
                if (elementCallChain[0].fnName === node.name && elementCallChain[0].stmtIndex === idx) {
                  highlightLevel = 'primary';
                }
                // Do NOT highlight parent callers (secondary) - user wants only one statement
              }
              
// Check if this statement is selected
              const isStatementSelected = selectedStatement?.fnName === node.name && selectedStatement?.stmtIndex === idx;
              
              // Check if this statement is the current navigation position (statement chain)
              const isCurrentNav = currentNavStatement?.fnName === node.name && currentNavStatement?.stmtIndex === idx;
              
              // Check if this statement is in the statement chain (but not current nav)
              const isInNavChain = !isCurrentNav && chainStatements.some(
                s => s.fnName === node.name && s.stmtIndex === idx
              );
              
              // Check if this statement is the current navigation position (function chain)
              const isFnChainCurrentNav = isStmtFnCurrentNav && fnNavStmtIndex === idx;
              
              // Check if this statement is in the function chain (but not current nav)
              const isInFnChain = !isFnChainCurrentNav && getStmtFnInChain(idx);
              
              // Combine chain highlighting - function chain takes priority if active
              const effectiveIsCurrentNav = isCurrentNav || isFnChainCurrentNav;
              const effectiveIsInChain = isInNavChain || isInFnChain;
              
              // Use function chain nav controls if function chain is active
              const usesFnNav = isFnChainCurrentNav;
              
              // Check if this statement has highlighted params that should force expansion
              const hasHighlightedParams = highlightedParams.some(
                p => p.fnName === node.name && p.stmtIndex === idx
              );
              
              return (
                <StatementRow 
                  key={idx} 
                  stmt={stmt}
                  fnName={node.name}
                  stmtIndex={idx}
                  editable={editable}
                  onArgsChange={onArgsChange ? (newArgs) => onArgsChange(idx, newArgs) : undefined}
                  highlightLevel={highlightLevel}
                  onClick={onStatementClick ? () => onStatementClick(node.name, idx) : undefined}
                  isSelected={isStatementSelected}
                  isCurrentNav={effectiveIsCurrentNav}
                  isInChain={effectiveIsInChain}
                  canGoUp={effectiveIsCurrentNav ? (usesFnNav ? fnCanGoUp : canGoUp) : false}
                  canGoDown={effectiveIsCurrentNav ? (usesFnNav ? fnCanGoDown : canGoDown) : false}
                  onNavigateUp={usesFnNav ? onFnNavigateUp : onNavigateUp}
                  onNavigateDown={usesFnNav ? onFnNavigateDown : onNavigateDown}
                  navIndex={usesFnNav ? fnNavIndex : navIndex}
                  chainLength={usesFnNav ? fnChainLength : chainLength}
                  highlightedParams={highlightedParams}
                  onParamClick={onParamClick}
                  forceExpanded={hasHighlightedParams}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// Editable params section component
interface ParamsEditorProps {
  params: Params;
  onChange: (params: Params) => void;
  // Controlled state props
  mainExpanded?: boolean;
  expandedParams?: Set<string>;
  onMainExpandedChange?: (expanded: boolean) => void;
  onExpandedParamsChange?: (expanded: Set<string>) => void;
}

const ParamsEditor: React.FC<ParamsEditorProps> = ({ 
  params, 
  onChange,
  mainExpanded = true,
  expandedParams = new Set(['number']),
  onMainExpandedChange,
  onExpandedParamsChange,
}) => {
  
  const toggleParam = (key: string) => {
    const next = new Set(expandedParams);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onExpandedParamsChange?.(next);
  };
  
  const handleValueChange = (key: string, value: string) => {
    // Try to parse as number, otherwise keep as string
    const parsed = !isNaN(Number(value)) && value.trim() !== '' ? Number(value) : value;
    onChange({ ...params, [key]: parsed } as Params);
  };
  
  const renderNestedValue = (key: string, value: unknown, path: string[] = []): React.ReactNode => {
    const fullPath = [...path, key].join('.');
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Nested object - render recursively
      return (
        <div key={fullPath} className="ml-2 border-l border-border/40 pl-2">
          <div className="text-xs text-muted-foreground py-1">{key}:</div>
          {Object.entries(value).map(([k, v]) => renderNestedValue(k, v, [...path, key]))}
        </div>
      );
    }
    
    if (typeof value === 'number' || typeof value === 'string') {
      return (
        <div key={fullPath} className="flex items-center gap-2 py-1">
          <span className="text-xs text-orange-400 min-w-[80px]">{key}:</span>
          <Input
            type={typeof value === 'number' ? 'number' : 'text'}
            value={String(value)}
            onChange={(e) => {
              // Update nested value
              if (path.length === 0) {
                handleValueChange(key, e.target.value);
              } else {
                // Deep update for nested params
                const newParams = JSON.parse(JSON.stringify(params)) as Params;
                let obj: Record<string, unknown> = newParams as unknown as Record<string, unknown>;
                for (const p of path) {
                  obj = obj[p] as Record<string, unknown>;
                }
                const parsed = !isNaN(Number(e.target.value)) && e.target.value.trim() !== '' 
                  ? Number(e.target.value) 
                  : e.target.value;
                obj[key] = parsed;
                onChange(newParams);
              }
            }}
            className="h-6 text-xs px-2 py-0 bg-muted/50 border-border/50 w-24"
          />
        </div>
      );
    }
    
    // Array or other - display as read-only
    return (
      <div key={fullPath} className="flex items-center gap-2 py-1">
        <span className="text-xs text-orange-400 min-w-[80px]">{key}:</span>
        <span className="text-xs text-foreground/60">{JSON.stringify(value)}</span>
      </div>
    );
  };
  
  const renderParamInput = (key: string, value: unknown) => {
    const isObject = typeof value === 'object' && value !== null && !Array.isArray(value);
    const isExpanded = expandedParams.has(key);
    
    // For primitive values (like 'number'), just render the input directly
    if (!isObject) {
      const explanation = getExplanation(key);
      return (
        <div key={key} className="flex items-center gap-2 py-1.5 px-2 hover:bg-muted/30 rounded">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-orange-400 font-medium min-w-[80px] cursor-help">{key}:</span>
            </TooltipTrigger>
            {explanation && (
              <TooltipContent side="right" className="max-w-sm text-xs">
                <ExplanationContent explanation={explanation} />
              </TooltipContent>
            )}
          </Tooltip>
          <Input
            type={typeof value === 'number' ? 'number' : 'text'}
            value={String(value)}
            onChange={(e) => handleValueChange(key, e.target.value)}
            className="h-6 text-xs px-2 py-0 bg-primary/10 border-primary/30 hover:border-primary/50 focus:border-primary w-24"
          />
        </div>
      );
    }
    
    // For objects, render as collapsible section
    const explanation = getExplanation(key);
    return (
      <div key={key} className="border-b border-border/30 last:border-b-0">
        <div 
          className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-muted/30 rounded"
          onClick={() => toggleParam(key)}
        >
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-orange-400 font-medium cursor-help">{key}</span>
            </TooltipTrigger>
            {explanation && (
              <TooltipContent side="right" className="max-w-sm text-xs">
                <ExplanationContent explanation={explanation} />
              </TooltipContent>
            )}
          </Tooltip>
          {!isExpanded && (
            <span className="text-xs text-muted-foreground">
              ({Object.keys(value as object).length} fields)
            </span>
          )}
        </div>
        {isExpanded && (
          <div className="ml-4 pl-2 pb-2 border-l border-border/40">
            {Object.entries(value as object).map(([k, v]) => renderNestedValue(k, v, [key]))}
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="border-b border-border/50">
      <div 
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/30"
        onClick={() => onMainExpandedChange?.(!mainExpanded)}
      >
        {mainExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        )}
        <Settings className="w-3.5 h-3.5 text-primary" />
        <span className="text-sm font-medium text-primary">Parameters</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {Object.keys(params).length} params
        </span>
      </div>
      {mainExpanded && (
        <div className="px-2 pb-2">
          {Object.entries(params).map(([k, v]) => renderParamInput(k, v))}
        </div>
      )}
    </div>
  );
};

export const YAMLTreePanel: React.FC<YAMLTreePanelProps> = ({
  spec,
  onFunctionSelect,
  selectedFunction,
  onParamsChange,
  onFunctionArgsChange,
  paramsExpanded = true,
  expandedParams = new Set(['number']),
  expandedFunctions = new Set(['SimplifyRoot']),
  onParamsExpandedChange,
  onExpandedParamsChange,
  onExpandedFunctionsChange,
  highlightedElementId,
  elementCallChain,
  zoomLevel = 100,
  onStatementClick,
  selectedStatement,
  onFunctionDefinitionClick,
  selectedFunctionDefinition,
}) => {
  const [selected, setSelected] = useState<string | null>(selectedFunction || null);
  
// Chain navigation state for statements
  const [anchorStatement, setAnchorStatement] = useState<StatementKey | null>(null);
  const [stmtNavIndex, setStmtNavIndex] = useState<number>(0);
  
  // Chain navigation state for function definitions
  const [anchorFunction, setAnchorFunction] = useState<string | null>(null);
  const [fnNavIndex, setFnNavIndex] = useState<number>(0);
  
  // Param highlighting state: when a param is clicked, we trace its origin through the call chain
  const [anchorParam, setAnchorParam] = useState<ParamHighlightKey | null>(null);
  
  const nodes = useMemo(() => {
    if (!spec) return new Map();
    return buildTree(spec);
  }, [spec]);
  
  // Build upstream call chain for the anchor statement
  const upstreamChain = useMemo(() => {
    if (!anchorStatement || !spec) return [];
    return buildUpstreamChain(anchorStatement.fnName, spec);
  }, [anchorStatement, spec]);
  
// Current statement navigation position
  // stmtNavIndex 0 = anchor, stmtNavIndex 1 = first upstream caller, etc.
  const currentNavStatement = useMemo((): StatementKey | null => {
    if (!anchorStatement) return null;
    if (stmtNavIndex === 0) return anchorStatement;
    if (stmtNavIndex > 0 && stmtNavIndex <= upstreamChain.length) {
      return upstreamChain[stmtNavIndex - 1];
    }
    return null;
  }, [anchorStatement, stmtNavIndex, upstreamChain]);
  
  // All statements in the chain (for dim highlighting)
  const chainStatements = useMemo((): StatementKey[] => {
    if (!anchorStatement) return [];
    const allInChain = [anchorStatement, ...upstreamChain];
    // Exclude the current navigation position (it gets bright highlight)
    return allInChain.filter(s => 
      !(s.fnName === currentNavStatement?.fnName && s.stmtIndex === currentNavStatement?.stmtIndex)
    );
  }, [anchorStatement, upstreamChain, currentNavStatement]);
  
  // Build upstream call chain for the anchor function (all functions that call this function)
  const fnUpstreamChain = useMemo(() => {
    if (!anchorFunction || !spec) return [];
    return buildUpstreamChain(anchorFunction, spec);
  }, [anchorFunction, spec]);
  
  // Current function navigation position
  // fnNavIndex 0 = anchor function, fnNavIndex 1+ = upstream callers
  const currentNavFnKey = useMemo((): StatementKey | null => {
    if (!anchorFunction) return null;
    if (fnNavIndex === 0) return { fnName: anchorFunction, stmtIndex: -1 }; // -1 = function header
    if (fnNavIndex > 0 && fnNavIndex <= fnUpstreamChain.length) {
      return fnUpstreamChain[fnNavIndex - 1];
    }
    return null;
  }, [anchorFunction, fnNavIndex, fnUpstreamChain]);
  
  // All functions/statements in the function chain (for dim highlighting)
  const fnChainStatements = useMemo((): StatementKey[] => {
    if (!anchorFunction) return [];
    const allInChain: StatementKey[] = [
      { fnName: anchorFunction, stmtIndex: -1 },
      ...fnUpstreamChain
    ];
    // Exclude the current navigation position
    return allInChain.filter(s => 
      !(s.fnName === currentNavFnKey?.fnName && s.stmtIndex === currentNavFnKey?.stmtIndex)
    );
  }, [anchorFunction, fnUpstreamChain, currentNavFnKey]);
  
  // Build param origin chain: trace a param value through the call chain to find all contributing params
  // Example: If we click on "N" in Present_Micro_LadderRow, and it has value "$N", we trace up to find 
  // Build a tree of all params/values that contributed to the clicked param
  // Traces variable references ($N) back through let statements and function params
  const highlightedParams = useMemo((): ParamHighlightKey[] => {
    if (!anchorParam || !spec?.defs) return [];
    
    const result: ParamHighlightKey[] = [anchorParam];
    
    // Get the statement that contains the clicked param
    const fnDef = spec.defs[anchorParam.fnName];
    if (!fnDef) return result;
    
    const stmt = fnDef.body[anchorParam.stmtIndex];
    if (!stmt) return result;
    
    // Extract the param value from the statement
    let paramValue: unknown = null;
    const pathParts = anchorParam.paramPath.split('.');
    
    if ('call' in stmt && pathParts[0] === 'args' && pathParts.length >= 2) {
      const argKey = pathParts[1];
      paramValue = stmt.call.args[argKey];
    } else if ('ir' in stmt && pathParts[0] === 'args' && pathParts.length >= 2) {
      const argKey = pathParts[1];
      paramValue = stmt.ir.args[argKey];
    }
    
    // Helper: find let statement that defines a variable in the current function
    const findLetStatement = (fnName: string, varName: string): { stmtIndex: number; value: unknown } | null => {
      const fn = spec.defs[fnName];
      if (!fn) return null;
      
      // Search statements in reverse order (later let can override)
      for (let i = fn.body.length - 1; i >= 0; i--) {
        const s = fn.body[i];
        if ('let' in s && varName in s.let) {
          return { stmtIndex: i, value: s.let[varName] };
        }
      }
      return null;
    };
    
    // Helper: trace a variable reference recursively
    const traceVariable = (
      fnName: string, 
      varName: string, 
      visited: Set<string> = new Set()
    ): void => {
      const visitKey = `${fnName}:${varName}`;
      if (visited.has(visitKey)) return;
      visited.add(visitKey);
      
      const fn = spec.defs[fnName];
      if (!fn) return;
      
      // First, check if this variable comes from a let statement in the same function
      const letDef = findLetStatement(fnName, varName);
      if (letDef) {
        // Add the let statement as a highlighted param
        result.push({
          fnName,
          stmtIndex: letDef.stmtIndex,
          paramPath: `let.${varName}`
        });
        
        // If the let value is another variable reference, trace it
        const letValue = letDef.value;
        if (typeof letValue === 'string' && letValue.startsWith('$') && !letValue.startsWith('$.')) {
          const nextVar = letValue.substring(1).split('.')[0];
          traceVariable(fnName, nextVar, visited);
        } else if (typeof letValue === 'object' && letValue !== null && 'args' in letValue) {
          // Expression with args - trace each arg that's a variable
          const exprArgs = (letValue as { args: Record<string, unknown> }).args;
          for (const [argKey, argVal] of Object.entries(exprArgs)) {
            if (typeof argVal === 'string' && argVal.startsWith('$') && !argVal.startsWith('$.')) {
              const nextVar = argVal.substring(1).split('.')[0];
              traceVariable(fnName, nextVar, visited);
            }
          }
        }
        return;
      }
      
      // If not from a let, check if it's a function parameter
      if (fn.params?.includes(varName)) {
        // Trace upstream through the call chain
        const chain = buildUpstreamChain(fnName, spec);
        
        if (chain.length > 0) {
          const caller = chain[0];
          const callerFnDef = spec.defs[caller.fnName];
          if (callerFnDef) {
            const callerStmt = callerFnDef.body[caller.stmtIndex];
            if (callerStmt && 'call' in callerStmt && callerStmt.call.fn === fnName) {
              // Find the arg that corresponds to this param
              let callerArgKey: string | null = null;
              let callerArgValue: unknown = null;
              
              // Try by param name first
              if (varName in callerStmt.call.args) {
                callerArgKey = varName;
                callerArgValue = callerStmt.call.args[varName];
              } else {
                // Try positional matching
                const paramIndex = fn.params.indexOf(varName);
                const callerArgs = Object.entries(callerStmt.call.args);
                if (paramIndex < callerArgs.length) {
                  [callerArgKey, callerArgValue] = callerArgs[paramIndex];
                }
              }
              
              if (callerArgKey) {
                // Add this to highlighted params
                result.push({
                  fnName: caller.fnName,
                  stmtIndex: caller.stmtIndex,
                  paramPath: `args.${callerArgKey}`
                });
                
                // If the value is another variable reference, trace it in the caller
                if (typeof callerArgValue === 'string' && callerArgValue.startsWith('$') && !callerArgValue.startsWith('$.')) {
                  const nextVar = callerArgValue.substring(1).split('.')[0];
                  traceVariable(caller.fnName, nextVar, visited);
                }
              }
            }
          }
        }
      }
    };
    
    // If the value is a variable reference like $N, trace it
    if (typeof paramValue === 'string' && paramValue.startsWith('$') && !paramValue.startsWith('$.')) {
      const varName = paramValue.substring(1).split('.')[0];
      traceVariable(anchorParam.fnName, varName);
    }
    
    return result;
  }, [anchorParam, spec]);
  
  // Handle param click
  const handleParamClick = useCallback((fnName: string, stmtIndex: number, paramPath: string) => {
    console.log('YAMLTreePanel: Param clicked', { fnName, stmtIndex, paramPath });
    
    // Toggle: if clicking the same param, clear it
    if (anchorParam?.fnName === fnName && anchorParam?.stmtIndex === stmtIndex && anchorParam?.paramPath === paramPath) {
      setAnchorParam(null);
    } else {
      setAnchorParam({ fnName, stmtIndex, paramPath });
    }
  }, [anchorParam]);
  
  // Handle statement click - set as anchor
  const handleStatementClickInternal = useCallback((fnName: string, stmtIndex: number) => {
    console.log('YAMLTreePanel: Statement clicked', { fnName, stmtIndex });
    const clickedKey = { fnName, stmtIndex };
    
    // Clear function navigation when statement is clicked
    setAnchorFunction(null);
    setFnNavIndex(0);
    
    if (anchorStatement?.fnName === fnName && anchorStatement?.stmtIndex === stmtIndex) {
      // Click same statement - clear navigation
      console.log('YAMLTreePanel: Clearing anchor');
      setAnchorStatement(null);
      setStmtNavIndex(0);
    } else {
      // Set new anchor
      console.log('YAMLTreePanel: Setting new anchor');
      setAnchorStatement(clickedKey);
      setStmtNavIndex(0);
    }
    
    // Also call external handler if provided
    onStatementClick?.(fnName, stmtIndex);
  }, [anchorStatement, onStatementClick]);
  
  // Handle function definition click - set as anchor for function chain navigation
  const handleFunctionDefinitionClickInternal = useCallback((fnName: string) => {
    console.log('YAMLTreePanel: Function definition clicked', { fnName });
    
    // Clear statement navigation when function is clicked
    setAnchorStatement(null);
    setStmtNavIndex(0);
    
    if (anchorFunction === fnName) {
      // Click same function - clear navigation
      console.log('YAMLTreePanel: Clearing function anchor');
      setAnchorFunction(null);
      setFnNavIndex(0);
    } else {
      // Set new function anchor
      console.log('YAMLTreePanel: Setting new function anchor');
      setAnchorFunction(fnName);
      setFnNavIndex(0);
    }
    
    // Also call external handler if provided
    onFunctionDefinitionClick?.(fnName);
  }, [anchorFunction, onFunctionDefinitionClick]);
  
  // Statement navigation: Navigate up (to higher level / parent caller)
  const navigateUp = useCallback(() => {
    if (stmtNavIndex < upstreamChain.length) {
      setStmtNavIndex(stmtNavIndex + 1);
    }
  }, [stmtNavIndex, upstreamChain.length]);
  
  // Statement navigation: Navigate down (back toward anchor)
  const navigateDown = useCallback(() => {
    if (stmtNavIndex > 0) {
      setStmtNavIndex(stmtNavIndex - 1);
    }
  }, [stmtNavIndex]);
  
  // Function navigation: Navigate up (to higher level / parent caller)
  const fnNavigateUp = useCallback(() => {
    if (fnNavIndex < fnUpstreamChain.length) {
      setFnNavIndex(fnNavIndex + 1);
    }
  }, [fnNavIndex, fnUpstreamChain.length]);
  
  // Function navigation: Navigate down (back toward anchor)
  const fnNavigateDown = useCallback(() => {
    if (fnNavIndex > 0) {
      setFnNavIndex(fnNavIndex - 1);
    }
  }, [fnNavIndex]);
  
  const canGoUp = !!anchorStatement && stmtNavIndex < upstreamChain.length;
  const canGoDown = !!anchorStatement && stmtNavIndex > 0;
  const chainLength = upstreamChain.length + 1; // +1 for anchor
  
  const fnCanGoUp = !!anchorFunction && fnNavIndex < fnUpstreamChain.length;
  const fnCanGoDown = !!anchorFunction && fnNavIndex > 0;
  const fnChainLength = fnUpstreamChain.length + 1; // +1 for anchor
  
  // Auto-expand functions in the navigation chain
  useEffect(() => {
    if (!anchorStatement) return;
    
    console.log('YAMLTreePanel: Auto-expand effect', { 
      anchorStatement, 
      upstreamChain,
      chainLength: upstreamChain.length 
    });
    
    const functionsToExpand = [anchorStatement.fnName, ...upstreamChain.map(s => s.fnName)];
    const next = new Set(expandedFunctions);
    let changed = false;
    
    for (const fnName of functionsToExpand) {
      if (!next.has(fnName)) {
        next.add(fnName);
        changed = true;
      }
    }
    
    if (changed) {
      console.log('YAMLTreePanel: Expanding functions', functionsToExpand);
      onExpandedFunctionsChange?.(next);
    }
  }, [anchorStatement, upstreamChain, expandedFunctions, onExpandedFunctionsChange]);
  
  // Auto-expand functions in the function navigation chain
  useEffect(() => {
    if (!anchorFunction) return;
    
    const functionsToExpand = [anchorFunction, ...fnUpstreamChain.map(s => s.fnName)];
    const next = new Set(expandedFunctions);
    let changed = false;
    
    for (const fnName of functionsToExpand) {
      if (!next.has(fnName)) {
        next.add(fnName);
        changed = true;
      }
    }
    
    if (changed) {
      onExpandedFunctionsChange?.(next);
    }
  }, [anchorFunction, fnUpstreamChain, expandedFunctions, onExpandedFunctionsChange]);

  // Auto-expand functions and statements containing highlighted params
  useEffect(() => {
    if (highlightedParams.length === 0) return;
    
    // Expand all functions that contain highlighted params
    const functionsToExpand = [...new Set(highlightedParams.map(p => p.fnName))];
    const nextFunctions = new Set(expandedFunctions);
    let functionsChanged = false;
    
    for (const fnName of functionsToExpand) {
      if (!nextFunctions.has(fnName)) {
        nextFunctions.add(fnName);
        functionsChanged = true;
      }
    }
    
    if (functionsChanged) {
      console.log('YAMLTreePanel: Auto-expanding functions for param tracing', functionsToExpand);
      onExpandedFunctionsChange?.(nextFunctions);
    }
  }, [highlightedParams, expandedFunctions, onExpandedFunctionsChange]);

  const statementHasElementId = (stmt: Statement, elementId: string): boolean => {
    // Check direct literal IDs
    if ('ir' in stmt && stmt.ir.args.id) {
      const id = stmt.ir.args.id;
      if (typeof id === 'string' && !id.startsWith('$') && id === elementId) {
        return true;
      }
    }
    if ('call' in stmt && stmt.call.args.id) {
      const id = stmt.call.args.id;
      if (typeof id === 'string' && !id.startsWith('$') && id === elementId) {
        return true;
      }
      // Check for pattern-based ID generation (e.g., core.format('R%d', i))
      if (typeof id === 'object' && id !== null && 'expr' in id) {
        const expr = (id as { expr: string }).expr;
        const formatMatch = expr.match(/core\.format\s*\(\s*['"]([^'"]+)['"]/);
        if (formatMatch) {
          const pattern = formatMatch[1];
          const regexPattern = pattern.replace(/%d/g, '\\d+');
          const regex = new RegExp(`^${regexPattern}$`);
          if (regex.test(elementId)) return true;
        }
      }
    }
    // Check foreach loops recursively
    if ('foreach' in stmt) {
      for (const innerStmt of stmt.foreach.do) {
        if (statementHasElementId(innerStmt, elementId)) return true;
      }
    }
    return false;
  };
  
  // Find which function contains the highlighted element
  const functionWithHighlightedElement = useMemo(() => {
    if (!highlightedElementId || !spec?.defs) return null;
    
    // For pattern-based IDs like L1, R2, etc., check which functions have matching patterns
    for (const [fnName, fnDef] of Object.entries(spec.defs)) {
      for (const stmt of fnDef.body) {
        if (statementHasElementId(stmt, highlightedElementId)) {
          return fnName;
        }
      }
    }
    return null;
  }, [highlightedElementId, spec]);
  
  // Auto-expand all functions in the call chain
  useEffect(() => {
    if (elementCallChain && elementCallChain.length > 0) {
      const functionsToExpand = elementCallChain.map(entry => entry.fnName);
      const next = new Set(expandedFunctions);
      let changed = false;
      for (const fnName of functionsToExpand) {
        if (!next.has(fnName)) {
          next.add(fnName);
          changed = true;
        }
      }
      if (changed) {
        onExpandedFunctionsChange?.(next);
      }
    }
  }, [elementCallChain, expandedFunctions, onExpandedFunctionsChange]);
  
  // Show all functions as flat list
  const allFunctions = useMemo(() => {
    return Array.from(nodes.values()).sort((a, b) => {
      // Entry first, then by category, then alphabetically
      const categoryOrder = { entry: 0, logic: 1, presentation: 2, primitive: 3 };
      if (a.category !== b.category) {
        return categoryOrder[a.category] - categoryOrder[b.category];
      }
      return a.name.localeCompare(b.name);
    });
  }, [nodes]);
  
  const handleToggle = (name: string) => {
    const next = new Set(expandedFunctions);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    onExpandedFunctionsChange?.(next);
  };
  
  const handleSelect = (name: string) => {
    setSelected(name);
    onFunctionSelect?.(name);
  };
  
  
  if (!spec) {
    return (
      <div className="flex flex-col h-full panel">
        <div className="panel-header">YAMLScript Tree</div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          No spec loaded
        </div>
      </div>
    );
  }
  
  const handleParamsChange = (newParams: Params) => {
    onParamsChange?.(newParams);
  };
  
  return (
    <div className="flex flex-col h-full min-h-0 panel">
      <div className="panel-header sr-only">YAMLScript Tree</div>
      
      <ScrollArea className="flex-1 min-h-0">
        <div style={{ zoom: zoomLevel / 100 }}>
          {/* Editable Parameters */}
          {spec?.params && onParamsChange && (
            <ParamsEditor 
              params={spec.params} 
              onChange={handleParamsChange}
              mainExpanded={paramsExpanded}
              expandedParams={expandedParams}
              onMainExpandedChange={onParamsExpandedChange}
              onExpandedParamsChange={onExpandedParamsChange}
            />
          )}
          
          
          <div className="py-2">
          {allFunctions.map(node => (
<TreeNode
              key={node.name}
              node={node}
              allNodes={nodes}
              depth={0}
              expanded={expandedFunctions}
              onToggle={handleToggle}
              selected={selected}
              onSelect={handleSelect}
              editable={!!onFunctionArgsChange}
              onArgsChange={onFunctionArgsChange ? (stmtIdx, newArgs) => onFunctionArgsChange(node.name, stmtIdx, newArgs) : undefined}
              highlightedElementId={highlightedElementId}
              elementCallChain={elementCallChain}
              onStatementClick={handleStatementClickInternal}
              selectedStatement={selectedStatement}
              onFunctionDefinitionClick={handleFunctionDefinitionClickInternal}
              selectedFunctionDefinition={selectedFunctionDefinition}
              currentNavStatement={currentNavStatement}
              chainStatements={chainStatements}
              canGoUp={canGoUp}
              canGoDown={canGoDown}
              onNavigateUp={navigateUp}
              onNavigateDown={navigateDown}
              navIndex={stmtNavIndex}
              chainLength={chainLength}
              // Function chain navigation props
              currentNavFnKey={currentNavFnKey}
              fnChainStatements={fnChainStatements}
              fnCanGoUp={fnCanGoUp}
              fnCanGoDown={fnCanGoDown}
              onFnNavigateUp={fnNavigateUp}
              onFnNavigateDown={fnNavigateDown}
              fnNavIndex={fnNavIndex}
              fnChainLength={fnChainLength}
              // Param highlighting props
              highlightedParams={highlightedParams}
              onParamClick={handleParamClick}
            />
          ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
