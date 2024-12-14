import React, { useEffect, useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFile } from '@/lib/file-context';
import { Send, Copy, Check, Menu as MenuIcon } from 'lucide-react';
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

    const newEventSource = new EventSource('/api/sse', { 
      withCredentials: true 
    });
    
    let retryCount = 0;
    const maxRetries = 5;
    const baseDelay = 1000;
    let retryTimeout: NodeJS.Timeout | null = null;
    
    const cleanup = () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
        retryTimeout = null;
      }
      if (newEventSource) {
        newEventSource.close();
      }
    };

    newEventSource.onopen = () => {
      console.log('SSE connection established');
      setIsConnected(true);
      retryCount = 0;
    };

    newEventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'connection') {
          console.log('SSE connection status:', data.status);
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
        setIsLoading(false);
      }
    };

    newEventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      setIsConnected(false);
      cleanup();
      
      if (retryCount < maxRetries) {
        retryCount++;
        const delay = Math.min(baseDelay * Math.pow(2, retryCount - 1), 10000);
        console.log(`Retrying connection (${retryCount}/${maxRetries}) in ${delay}ms...`);
        
        retryTimeout = setTimeout(() => {
          setupEventSource();
        }, delay);
      } else {
        toast({
          title: 'Connection Error',
          description: 'Unable to establish connection. Please refresh the page.',
          variant: 'destructive',
        });
      }
    };

    setEventSource(newEventSource);

    // Cleanup on unmount
    return cleanup;
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
      setMessages(prev => [...prev, {
        id: `${Date.now()}-${Math.random()}`,
        role: 'assistant',
        type: 'error',
        content: 'Failed to get response. Please check your API key and try again.'
      }]);
      setIsLoading(false);
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
      <div className="sticky top-0 z-10 flex items-center justify-between p-2 sm:p-4 border-b bg-inherit">
        <h2 className="text-base sm:text-lg font-semibold">AI Assistant</h2>
        <Button
          variant="ghost"
          className="lg:hidden hover:bg-accent/50"
          onClick={() => document.documentElement.classList.toggle('hide-ai-panel')}
          size="sm"
        >
          <span className="sr-only">Toggle AI Panel</span>
          <MenuIcon className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="flex flex-col h-[calc(100%-8rem)] overflow-hidden">
        <ScrollArea className="flex-1 px-2 py-4 md:px-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex w-full sm:w-max max-w-[95%] sm:max-w-[80%] flex-col gap-2 rounded-lg px-2 sm:px-3 py-2 text-xs sm:text-sm break-words",
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

        <div className="p-2 md:p-4 border-t">
          <div className="flex gap-2">
            <Input
              placeholder="Ask me anything about your code..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              className="flex-1 text-sm md:text-base"
            />
            <Button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              size="icon"
              className="h-10 w-10 md:h-12 md:w-12"
            >
              <Send className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}