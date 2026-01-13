import React from 'react';
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
  info: 'bg-muted/50',
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

export const ChatPanel: React.FC<ChatPanelProps> = ({ title = '6. Activity Log', zoomLevel = 100 }) => {
  const { logs, clearLogs } = useActivityLog();

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
            title="Clear logs"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      
      <div
        className="flex-1 min-h-0 overflow-auto p-2 space-y-1 scrollbar-thin font-mono text-xs"
        style={{ zoom: zoomLevel / 100 }}
      >
        {logs.length === 0 ? (
          <div className="text-muted-foreground text-center py-4">
            No activity yet. Actions will be logged here.
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className={`rounded px-2 py-1.5 ${levelBgColors[log.level]}`}
            >
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground shrink-0">
                  [{formatTime(log.timestamp)}]
                </span>
                <span className="text-primary shrink-0 font-medium">
                  [{log.source}]
                </span>
                <span className={levelColors[log.level]}>
                  {log.message}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
