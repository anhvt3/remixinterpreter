import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatPanelProps {
  title?: string;
  zoomLevel?: number;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ title = '6.Chat', zoomLevel = 100 }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Welcome! This is the AnimYAML-DSL interpreter. Edit the YAML to modify the animation, or ask questions about the DSL syntax.',
    },
  ]);
  const [input, setInput] = useState('');
  
  const handleSend = () => {
    if (!input.trim()) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    
    // Simulated response
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'This is a placeholder response. In a full implementation, this would provide guidance on the AnimYAML-DSL syntax and help with animation creation.',
      };
      setMessages((prev) => [...prev, assistantMessage]);
    }, 500);
  };
  
  return (
    <div className="flex flex-col h-full min-h-0 panel">
      <div className="panel-header shrink-0">{title}</div>
      
      <div className="flex-1 min-h-0 overflow-auto p-4 space-y-4 scrollbar-thin" style={{ zoom: zoomLevel / 100 }}>
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}
      </div>
      
      <div className="p-3 border-t border-panel-border">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about the DSL..."
            className="min-h-[40px] max-h-[120px] resize-none bg-muted border-0 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim()}
            className="shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
