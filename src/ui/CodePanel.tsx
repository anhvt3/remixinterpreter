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
    <div className="flex flex-col h-full panel overflow-hidden">
      <div className="panel-header flex items-center justify-between shrink-0">
        <span>{title}</span>
        <span className="text-xs text-syntax-comment">{language.toUpperCase()}</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        <textarea
          value={content}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={readOnly}
          className="w-full h-full p-4 bg-transparent text-sm font-mono text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
          style={{
            lineHeight: '1.6',
            tabSize: 2,
          }}
          spellCheck={false}
        />
      </div>
    </div>
  );
};
