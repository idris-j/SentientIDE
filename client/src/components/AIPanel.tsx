
import React, { useEffect, useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFile } from '@/lib/file-context';
import { Send, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  type: 'text' | 'code' | 'suggestion' | 'explanation' | 'error';
  content: string;
  codeLanguage?: string;
  fileName?: string;
}

export function AIPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { currentFile } = useFile();

  const setupEventSource = () => {
    if (eventSource) {
      eventSource.close();
    }

    const newEventSource = new EventSource('/api/sse');
    
    newEventSource.onopen = () => {
      console.log('SSE connection established');
      setIsConnected(true);
    };

    newEventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'connection') {
          console.log('SSE connection status:', data.status);
          return;
        }

        if (data.type === 'error') {
          if (data.content.includes('API key')) {
            toast({
              title: 'API Key Required',
              description: 'Please set up your NVIDIA API key to use the IBM Granite code model.',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Error',
              description: data.content,
              variant: 'destructive',
            });
          }
          setIsLoading(false);
          return;
        }
        
        setMessages(prev => [...prev, {
          id: `${Date.now()}-${Math.random()}`,
          role: 'assistant',
          type: data.type,
          content: data.content,
          codeLanguage: data.codeLanguage,
          fileName: data.fileName
        }]);
        setIsLoading(false);
      } catch (error) {
        console.error('Error processing message:', error);
        toast({
          title: 'Error',
          description: 'Failed to process message from server',
          variant: 'destructive',
        });
        setIsLoading(false);
      }
    };

    newEventSource.onerror = () => {
      console.error('SSE connection error');
      setIsConnected(false);
      newEventSource.close();
      
      // Attempt to reconnect after 2 seconds
      setTimeout(() => {
        console.log('Attempting to reconnect...');
        setupEventSource();
      }, 2000);
      
      toast({
        title: 'Connection Error',
        description: 'Lost connection to server. Attempting to reconnect...',
        variant: 'destructive',
      });
    };

    setEventSource(newEventSource);
  };

  useEffect(() => {
    setupEventSource();
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  const sendMessage = async (content: string, currentFile: string | null) => {
    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content, currentFile }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (data.needNewKey) {
          toast({
            title: 'API Key Required',
            description: 'Please set up your Claude API key in the environment variables.',
            variant: 'destructive',
          });
          return { success: false, needNewKey: true };
        }
        throw new Error(data.error || 'Failed to send message');
      }

      return await response.json();
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `${Date.now()}-${Math.random()}`,
      role: 'user',
      type: 'text',
      content: input
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      await sendMessage(input, currentFile);
    } catch (error: any) {
      console.error('Message handling error:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to get response';
      setMessages(prev => [...prev, {
        id: `${Date.now()}-${Math.random()}`,
        role: 'assistant',
        type: 'error',
        content: `Error: ${errorMessage}. Please try again.`
      }]);
      setIsLoading(false);
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyToClipboard = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast({
        title: 'Success',
        description: 'Copied to clipboard',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="h-full rounded-none border-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">AI Assistant</h2>
      </div>
      
      <div className="flex flex-col h-[calc(100%-8rem)]">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex w-max max-w-[80%] flex-col gap-2 rounded-lg px-3 py-2 text-sm",
                  message.role === 'user'
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                {message.type === 'code' || message.type === 'suggestion' ? (
                  <div className="relative">
                    <pre className="overflow-x-auto p-2 rounded bg-muted-foreground/5">
                      <code>{message.content}</code>
                    </pre>
                    <div className="absolute top-2 right-2 flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => copyToClipboard(message.content)}
                        className="h-6 w-6"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm">{message.content}</div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2 text-muted-foreground">
                <div className="animate-pulse">●</div>
                <div className="animate-pulse animation-delay-200">●</div>
                <div className="animate-pulse animation-delay-400">●</div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              placeholder="Ask me anything about your code..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
