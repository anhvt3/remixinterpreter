import React from 'react';

interface Token {
  type: 'key' | 'string' | 'number' | 'boolean' | 'null' | 'comment' | 'punctuation' | 'reference' | 'expression' | 'text';
  value: string;
}

function tokenizeYamlLine(line: string): Token[] {
  const tokens: Token[] = [];
  let remaining = line;

  // Comment line
  if (remaining.trimStart().startsWith('#')) {
    const leadingSpaces = remaining.match(/^(\s*)/)?.[1] || '';
    if (leadingSpaces) {
      tokens.push({ type: 'text', value: leadingSpaces });
    }
    tokens.push({ type: 'comment', value: remaining.trimStart() });
    return tokens;
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
    tokens.push({ type: 'key', value: keyMatch[1] });
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
      tokens.push({ type: 'key', value: listKeyMatch[1] });
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

    // Any other character (unquoted string or word)
    const wordMatch = remaining.match(/^([^\s:\[\]\{\},#"'$]+)/);
    if (wordMatch) {
      tokens.push({ type: 'text', value: wordMatch[1] });
      remaining = remaining.slice(wordMatch[1].length);
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

  return tokens;
}

const tokenStyles: Record<Token['type'], string> = {
  key: 'text-syntax-key',
  string: 'text-syntax-string',
  number: 'text-syntax-number',
  boolean: 'text-syntax-boolean',
  null: 'text-syntax-null',
  comment: 'text-syntax-comment italic',
  punctuation: 'text-syntax-punctuation',
  reference: 'text-cyan-400 italic',
  expression: 'text-blue-400 italic',
  text: 'text-foreground',
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

  return (
    <pre className="font-mono text-sm whitespace-pre">
      {lines.map((line, lineIdx) => (
        <div key={lineIdx} style={{ lineHeight: '1.6' }}>
          {tokenizeYamlLine(line).map((token, tokenIdx) => (
            <span key={tokenIdx} className={tokenStyles[token.type]}>
              {token.value}
            </span>
          ))}
          {line === '' && ' '}
        </div>
      ))}
    </pre>
  );
};
