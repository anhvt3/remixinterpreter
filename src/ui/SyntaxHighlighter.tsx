import React from 'react';

interface Token {
  type: 
    | 'keyword-call' 
    | 'keyword-let' 
    | 'keyword-foreach' 
    | 'keyword-ir' 
    | 'keyword-return'
    | 'keyword-fn'
    | 'keyword-out'
    | 'keyword-params'
    | 'keyword-defs'
    | 'keyword-program'
    | 'function-name'
    | 'param-key'
    | 'variable-name'
    | 'string' 
    | 'number' 
    | 'boolean' 
    | 'null' 
    | 'comment' 
    | 'punctuation' 
    | 'reference' 
    | 'expression' 
    | 'text';
  value: string;
}

// Keywords that define DSL structure
const DSL_KEYWORDS = new Set(['call', 'let', 'foreach', 'ir', 'return', 'fn', 'out', 'params', 'defs', 'program', 'entry', 'body', 'var', 'range', 'do', 'args', 'expr']);
const STATEMENT_KEYWORDS = new Set(['call', 'let', 'foreach', 'ir', 'return']);

function tokenizeYamlLine(line: string, prevLineContext?: string): { tokens: Token[], context?: string } {
  const tokens: Token[] = [];
  let remaining = line;
  let context = prevLineContext;

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
      context = 'call';
    } else if (keyName === 'let') {
      keyType = 'keyword-let';
      context = 'let';
    } else if (keyName === 'foreach') {
      keyType = 'keyword-foreach';
      context = 'foreach';
    } else if (keyName === 'ir') {
      keyType = 'keyword-ir';
      context = 'ir';
    } else if (keyName === 'return') {
      keyType = 'keyword-return';
    } else if (keyName === 'fn') {
      keyType = 'keyword-fn';
    } else if (keyName === 'out') {
      keyType = 'keyword-out';
    } else if (keyName === 'params' || keyName === 'defs' || keyName === 'program') {
      keyType = 'keyword-program';
    } else if (keyName === 'args' || keyName === 'body' || keyName === 'var' || keyName === 'range' || keyName === 'do' || keyName === 'entry' || keyName === 'expr') {
      keyType = 'keyword-fn';
    }
    
    tokens.push({ type: keyType, value: keyName });
    tokens.push({ type: 'punctuation', value: keyMatch[2] });
    remaining = remaining.slice(keyMatch[0].length);
    
    // Check if the value after colon is a function name (after fn:)
    if (keyName === 'fn' && remaining.trim()) {
      const fnNameMatch = remaining.match(/^([a-zA-Z_][a-zA-Z0-9_.]*)/);
      if (fnNameMatch) {
        tokens.push({ type: 'function-name', value: fnNameMatch[1] });
        remaining = remaining.slice(fnNameMatch[1].length);
      }
    }
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
        context = 'call';
      } else if (keyName === 'let') {
        keyType = 'keyword-let';
        context = 'let';
      } else if (keyName === 'foreach') {
        keyType = 'keyword-foreach';
        context = 'foreach';
      } else if (keyName === 'ir') {
        keyType = 'keyword-ir';
        context = 'ir';
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

    // Function name (PascalCase identifier, likely a function)
    const funcMatch = remaining.match(/^([A-Z][a-zA-Z0-9_]*)/);
    if (funcMatch) {
      tokens.push({ type: 'function-name', value: funcMatch[1] });
      remaining = remaining.slice(funcMatch[1].length);
      continue;
    }

    // Any other identifier (variable name in let context, or just text)
    const wordMatch = remaining.match(/^([a-zA-Z_][a-zA-Z0-9_]*)/);
    if (wordMatch) {
      // If we're in a 'let' context, this might be a variable name
      tokens.push({ type: 'text', value: wordMatch[1] });
      remaining = remaining.slice(wordMatch[1].length);
      continue;
    }

    // Any other non-space character
    const otherMatch = remaining.match(/^([^\s]+)/);
    if (otherMatch) {
      tokens.push({ type: 'text', value: otherMatch[1] });
      remaining = remaining.slice(otherMatch[1].length);
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

const tokenStyles: Record<Token['type'], string> = {
  'keyword-call': 'text-purple-400 font-medium',
  'keyword-let': 'text-yellow-400 font-medium',
  'keyword-foreach': 'text-pink-400 font-medium',
  'keyword-ir': 'text-orange-400 font-medium',
  'keyword-return': 'text-red-400 font-medium',
  'keyword-fn': 'text-muted-foreground',
  'keyword-out': 'text-green-400',
  'keyword-params': 'text-primary font-medium',
  'keyword-defs': 'text-primary font-medium',
  'keyword-program': 'text-primary font-medium',
  'function-name': 'text-blue-400',
  'param-key': 'text-orange-400',
  'variable-name': 'text-green-400',
  'string': 'text-amber-400',
  'number': 'text-amber-400',
  'boolean': 'text-amber-400',
  'null': 'text-muted-foreground italic',
  'comment': 'text-muted-foreground/60 italic',
  'punctuation': 'text-muted-foreground/80',
  'reference': 'text-cyan-400 italic',
  'expression': 'text-blue-400/80 italic',
  'text': 'text-foreground',
};

interface SyntaxHighlighterProps {
  content: string;
  language?: 'yaml' | 'json' | 'text';
}

export const SyntaxHighlighter: React.FC<SyntaxHighlighterProps> = ({ 
  content,
  language = 'yaml' 
}) => {
  const lines = content.split('\n');

  if (language !== 'yaml') {
    // For non-YAML, just render plain text
    return (
      <pre className="font-mono text-sm text-foreground whitespace-pre">
        {content}
      </pre>
    );
  }

  // Process lines with context tracking
  let context: string | undefined;
  const processedLines = lines.map((line) => {
    const result = tokenizeYamlLine(line, context);
    context = result.context;
    return result.tokens;
  });

  return (
    <pre className="font-mono text-sm whitespace-pre">
      {processedLines.map((lineTokens, lineIdx) => (
        <div key={lineIdx} style={{ lineHeight: '1.6' }}>
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
