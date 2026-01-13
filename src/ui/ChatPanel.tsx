import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useActivityLog, type ActivityLogEntry, type ActivityLogLevel } from '@/contexts/ActivityLogContext';

interface ChatPanelProps {
  title?: string;
  zoomLevel?: number;
}

const levelColors: Record<ActivityLogLevel, string> = {
  info: 'text-muted-foreground',
  success: 'text-green-500',
  warning: 'text-yellow-500',
  error: 'text-destructive',
};

const levelBgColors: Record<ActivityLogLevel, string> = {
  info: 'bg-muted/30',
  success: 'bg-green-500/10',
  warning: 'bg-yellow-500/10',
  error: 'bg-destructive/10',
};

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

export const ChatPanel: React.FC<ChatPanelProps> = ({ title = '6. Chat', zoomLevel = 100 }) => {
  const { logs, clearLogs, addLog } = useActivityLog();
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = () => {
    if (inputValue.trim()) {
      addLog('info', 'User', inputValue.trim());
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 panel">
      <div className="panel-header shrink-0 flex items-center justify-between">
        <span>{title}</span>
        {logs.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={clearLogs}
            title="Clear chat"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      
      {/* Chat messages area */}
      <div
        className="flex-1 min-h-0 overflow-auto p-2 space-y-2 scrollbar-thin"
        style={{ zoom: zoomLevel / 100 }}
      >
        {logs.length === 0 ? (
          <div className="text-muted-foreground text-center py-4 text-xs">
            No messages yet. Start a conversation.
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className={`rounded-lg px-3 py-2 ${levelBgColors[log.level]} ${
                log.source === 'User' ? 'ml-4 bg-primary/10' : 'mr-4'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-primary text-xs font-medium">
                  {log.source}
                </span>
                <span className="text-muted-foreground text-[0.65rem]">
                  {formatTime(log.timestamp)}
                </span>
              </div>
              <div className={`text-sm ${levelColors[log.level]}`}>
                {log.message}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Chat input bar */}
      <div className="shrink-0 border-t border-border p-2">
        <div className="flex items-center gap-2">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 min-h-[36px] max-h-[100px] px-3 py-2 text-sm bg-muted/50 border border-border rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-primary/30"
            rows={1}
          />
          <button
            onClick={handleSubmit}
            disabled={!inputValue.trim()}
            className="px-2 py-1.5 text-[0.65rem] font-medium rounded bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            VA2320-EDIT-DSL
          </button>
        </div>
      </div>
    </div>
  );
};
