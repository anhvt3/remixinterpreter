import React from 'react';

interface Token {
  type: 
    | 'keyword-call' 
    | 'keyword-let' 
    | 'keyword-foreach' 
    | 'keyword-ir' 
    | 'keyword-return'
    | 'keyword-structural'  // fn, args, body, var, range, do, entry, expr
    | 'keyword-section'     // params, defs, program
    | 'function-name'
    | 'variable-name'       // variable names after let, foreach var
    | 'out-value'           // the value after out:
    | 'param-key'
    | 'string' 
    | 'number' 
    | 'boolean' 
    | 'null' 
    | 'comment' 
    | 'punctuation' 
    | 'reference'           // $variable references
    | 'expression'          // expr(...)
    | 'value'               // plain values
    | 'text';
  value: string;
}

// Track context for multi-line awareness
type LineContext = {
  inCall?: boolean;
  inLet?: boolean;
  inForeach?: boolean;
  inIr?: boolean;
  afterFn?: boolean;
  afterOut?: boolean;
  afterVar?: boolean;
};

function tokenizeYamlLine(line: string, prevContext?: LineContext): { tokens: Token[], context: LineContext } {
  const tokens: Token[] = [];
  let remaining = line;
  const context: LineContext = {};

  // Comment line
  if (remaining.trimStart().startsWith('#')) {
    const leadingSpaces = remaining.match(/^(\s*)/)?.[1] || '';
    if (leadingSpaces) {
      tokens.push({ type: 'text', value: leadingSpaces });
    }
    tokens.push({ type: 'comment', value: remaining.trimStart() });
    return { tokens, context };
  }

  // Match leading whitespace
  const leadingMatch = remaining.match(/^(\s+)/);
  if (leadingMatch) {
    tokens.push({ type: 'text', value: leadingMatch[1] });
    remaining = remaining.slice(leadingMatch[1].length);
  }

  // Try to match key: value pattern
  const keyMatch = remaining.match(/^([a-zA-Z_][a-zA-Z0-9_-]*)(\s*:\s*)/);
  if (keyMatch) {
    const keyName = keyMatch[1];
    
    // Determine key type based on DSL semantics
    let keyType: Token['type'] = 'param-key';
    
    if (keyName === 'call') {
      keyType = 'keyword-call';
      context.inCall = true;
    } else if (keyName === 'let') {
      keyType = 'keyword-let';
      context.inLet = true;
    } else if (keyName === 'foreach') {
      keyType = 'keyword-foreach';
      context.inForeach = true;
    } else if (keyName === 'ir') {
      keyType = 'keyword-ir';
      context.inIr = true;
    } else if (keyName === 'return') {
      keyType = 'keyword-return';
    } else if (keyName === 'fn') {
      keyType = 'keyword-structural';
      context.afterFn = true;
    } else if (keyName === 'out') {
      keyType = 'keyword-structural';
      context.afterOut = true;
    } else if (keyName === 'var') {
      keyType = 'keyword-structural';
      context.afterVar = true;
    } else if (keyName === 'params' || keyName === 'defs' || keyName === 'program') {
      keyType = 'keyword-section';
    } else if (keyName === 'args' || keyName === 'body' || keyName === 'range' || keyName === 'do' || keyName === 'entry' || keyName === 'expr') {
      keyType = 'keyword-structural';
    }
    
    tokens.push({ type: keyType, value: keyName });
    tokens.push({ type: 'punctuation', value: keyMatch[2] });
    remaining = remaining.slice(keyMatch[0].length);
  }

  // Match list item marker
  const listMatch = remaining.match(/^(-\s+)/);
  if (listMatch) {
    tokens.push({ type: 'punctuation', value: listMatch[1] });
    remaining = remaining.slice(listMatch[1].length);

    // Check for key after list marker
    const listKeyMatch = remaining.match(/^([a-zA-Z_][a-zA-Z0-9_-]*)(\s*:\s*)/);
    if (listKeyMatch) {
      const keyName = listKeyMatch[1];
      let keyType: Token['type'] = 'param-key';
      
      if (keyName === 'call') {
        keyType = 'keyword-call';
        context.inCall = true;
      } else if (keyName === 'let') {
        keyType = 'keyword-let';
        context.inLet = true;
      } else if (keyName === 'foreach') {
        keyType = 'keyword-foreach';
        context.inForeach = true;
      } else if (keyName === 'ir') {
        keyType = 'keyword-ir';
        context.inIr = true;
      } else if (keyName === 'return') {
        keyType = 'keyword-return';
      }
      
      tokens.push({ type: keyType, value: keyName });
      tokens.push({ type: 'punctuation', value: listKeyMatch[2] });
      remaining = remaining.slice(listKeyMatch[0].length);
    }
  }

  // Process the rest of the line
  while (remaining.length > 0) {
    // Expression: expr(...)
    const exprMatch = remaining.match(/^(expr\([^)]*\))/);
    if (exprMatch) {
      tokens.push({ type: 'expression', value: exprMatch[1] });
      remaining = remaining.slice(exprMatch[1].length);
      continue;
    }

    // Variable reference: $something or $.path
    const refMatch = remaining.match(/^(\$[a-zA-Z_.][a-zA-Z0-9_.]*)/);
    if (refMatch) {
      tokens.push({ type: 'reference', value: refMatch[1] });
      remaining = remaining.slice(refMatch[1].length);
      continue;
    }

    // Double quoted string
    const doubleQuoteMatch = remaining.match(/^("[^"]*")/);
    if (doubleQuoteMatch) {
      tokens.push({ type: 'string', value: doubleQuoteMatch[1] });
      remaining = remaining.slice(doubleQuoteMatch[1].length);
      continue;
    }

    // Single quoted string
    const singleQuoteMatch = remaining.match(/^('[^']*')/);
    if (singleQuoteMatch) {
      tokens.push({ type: 'string', value: singleQuoteMatch[1] });
      remaining = remaining.slice(singleQuoteMatch[1].length);
      continue;
    }

    // Boolean
    const boolMatch = remaining.match(/^(true|false)(?=\s|$|,|\]|\})/);
    if (boolMatch) {
      tokens.push({ type: 'boolean', value: boolMatch[1] });
      remaining = remaining.slice(boolMatch[1].length);
      continue;
    }

    // Null
    const nullMatch = remaining.match(/^(null|~)(?=\s|$|,|\]|\})/);
    if (nullMatch) {
      tokens.push({ type: 'null', value: nullMatch[1] });
      remaining = remaining.slice(nullMatch[1].length);
      continue;
    }

    // Number (including negative and decimals)
    const numMatch = remaining.match(/^(-?\d+\.?\d*(?:e[+-]?\d+)?)(?=\s|$|,|\]|\})/i);
    if (numMatch) {
      tokens.push({ type: 'number', value: numMatch[1] });
      remaining = remaining.slice(numMatch[1].length);
      continue;
    }

    // Inline comment
    const inlineCommentMatch = remaining.match(/^(\s*#.*)/);
    if (inlineCommentMatch) {
      tokens.push({ type: 'comment', value: inlineCommentMatch[1] });
      remaining = '';
      continue;
    }

    // Punctuation
    const punctMatch = remaining.match(/^([:\[\]\{\},|>-])/);
    if (punctMatch) {
      tokens.push({ type: 'punctuation', value: punctMatch[1] });
      remaining = remaining.slice(punctMatch[1].length);
      continue;
    }

    // Identifier - determine type based on context
    const identMatch = remaining.match(/^([a-zA-Z_][a-zA-Z0-9_]*)/);
    if (identMatch) {
      const ident = identMatch[1];
      let identType: Token['type'] = 'value';
      
      // PascalCase = function name
      if (/^[A-Z]/.test(ident)) {
        identType = 'function-name';
      }
      // After fn: = function name
      else if (context.afterFn) {
        identType = 'function-name';
        context.afterFn = false;
      }
      // After out: = variable/output name (green)
      else if (context.afterOut) {
        identType = 'out-value';
        context.afterOut = false;
      }
      // After var: in foreach = variable name (green)
      else if (context.afterVar) {
        identType = 'variable-name';
        context.afterVar = false;
      }
      
      tokens.push({ type: identType, value: ident });
      remaining = remaining.slice(ident.length);
      continue;
    }

    // Dot notation for function calls like text.create
    const dotFuncMatch = remaining.match(/^([a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*)/);
    if (dotFuncMatch) {
      tokens.push({ type: 'function-name', value: dotFuncMatch[1] });
      remaining = remaining.slice(dotFuncMatch[1].length);
      continue;
    }

    // Whitespace
    const spaceMatch = remaining.match(/^(\s+)/);
    if (spaceMatch) {
      tokens.push({ type: 'text', value: spaceMatch[1] });
      remaining = remaining.slice(spaceMatch[1].length);
      continue;
    }

    // Fallback: single character
    tokens.push({ type: 'text', value: remaining[0] });
    remaining = remaining.slice(1);
  }

  return { tokens, context };
}

// Colors matched to TreeView (YAMLTreePanel.tsx)
const tokenStyles: Record<Token['type'], string> = {
  // Statement keywords - match StatementRow colors
  'keyword-call': 'text-purple-400 font-medium',
  'keyword-let': 'text-yellow-400 font-medium',
  'keyword-foreach': 'text-pink-400 font-medium',
  'keyword-ir': 'text-orange-400 font-medium',
  'keyword-return': 'text-red-400 font-medium',
  
  // Structural keywords
  'keyword-structural': 'text-muted-foreground',
  'keyword-section': 'text-primary font-medium',
  
  // Names
  'function-name': 'text-blue-400 font-medium',  // Function names in blue
  'variable-name': 'text-green-400',            // Same as TreeView let variable names
  'out-value': 'text-green-400',                // Same as TreeView out value
  'param-key': 'text-orange-400',               // Same as TreeView arg keys
  
  // Values - match getValueStyle and formatValue colors
  'string': 'text-foreground',                  // Editable strings are bright
  'number': 'text-foreground',                  // Editable numbers are bright
  'boolean': 'text-foreground',
  'null': 'text-muted-foreground italic',
  'value': 'text-foreground',                   // Plain values
  
  // Special
  'reference': 'text-cyan-400 italic',          // $variable references
  'expression': 'text-blue-400/70 italic',      // expr(...) 
  
  // Syntax
  'comment': 'text-muted-foreground/60 italic',
  'punctuation': 'text-muted-foreground/60',
  'text': 'text-foreground',
};

interface SyntaxHighlighterProps {
  content: string;
  language?: 'yaml' | 'json' | 'text';
}

interface SyntaxHighlightedLineProps {
  line: string;
  language?: 'yaml' | 'json' | 'text';
}

// Component for highlighting a single line - used in clickable line mode
export const SyntaxHighlightedLine: React.FC<SyntaxHighlightedLineProps> = ({
  line,
  language = 'yaml'
}) => {
  if (language !== 'yaml') {
    return <span className="text-foreground">{line || ' '}</span>;
  }

  const { tokens } = tokenizeYamlLine(line);
  
  if (tokens.length === 0) {
    return <span>&nbsp;</span>;
  }

  return (
    <>
      {tokens.map((token, idx) => (
        <span key={idx} className={tokenStyles[token.type]}>
          {token.value}
        </span>
      ))}
    </>
  );
};

export const SyntaxHighlighter: React.FC<SyntaxHighlighterProps> = ({ 
  content,
  language = 'yaml' 
}) => {
  const lines = content.split('\n');

  if (language !== 'yaml') {
    // For non-YAML, just render plain text (inherit font size from parent)
    return (
      <pre className="font-mono text-foreground whitespace-pre">
        {content}
      </pre>
    );
  }

  // Process lines with context tracking
  let context: LineContext = {};
  const processedLines = lines.map((line) => {
    const result = tokenizeYamlLine(line, context);
    context = result.context;
    return result.tokens;
  });

  return (
    <pre className="font-mono whitespace-pre m-0 p-0" style={{ lineHeight: '1.6' }}>
      {processedLines.map((lineTokens, lineIdx) => (
        <div key={lineIdx}>
          {lineTokens.map((token, tokenIdx) => (
            <span key={tokenIdx} className={tokenStyles[token.type]}>
              {token.value}
            </span>
          ))}
          {lineTokens.length === 0 && ' '}
        </div>
      ))}
    </pre>
  );
};
