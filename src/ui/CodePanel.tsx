import React from 'react';

interface CodePanelProps {
  title: string;
  content: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  language?: 'yaml' | 'json' | 'text';
}

export const CodePanel: React.FC<CodePanelProps> = ({
  title,
  content,
  onChange,
  readOnly = false,
  language = 'text',
}) => {
  return (
    <div className="flex flex-col h-full panel">
      <div className="panel-header flex items-center justify-between shrink-0">
        <span>{title}</span>
        <span className="text-xs text-syntax-comment">{language.toUpperCase()}</span>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <pre className="p-4 text-sm font-mono text-foreground whitespace-pre-wrap">
          <textarea
            value={content}
            onChange={(e) => onChange?.(e.target.value)}
            readOnly={readOnly}
            className="w-full h-full min-h-[calc(100vh-12rem)] bg-transparent text-sm font-mono text-foreground resize-none focus:outline-none border-none"
            style={{
              lineHeight: '1.6',
              tabSize: 2,
            }}
            spellCheck={false}
          />
        </pre>
      </div>
    </div>
  );
};
