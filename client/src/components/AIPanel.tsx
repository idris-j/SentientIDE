import { useEffect, useState, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEventSource } from '@/lib/websocket';
import { useFile } from '@/lib/file-context';
import { Send, Code, Copy, Check } from 'lucide-react';
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
  const [reconnectTimer, setReconnectTimer] = useState<NodeJS.Timeout | null>(null);
  const maxRetries = 3;
  const retryCount = useRef(0);

  const setupEventSource = useCallback(() => {
    if (eventSource) {
      eventSource.close();
    }

    const newEventSource = new EventSource('/api/sse');
    
    newEventSource.onopen = () => {
      console.log('SSE connection established');
      setIsConnected(true);
      retryCount.current = 0;
    };

    newEventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'connection') {
          console.log('SSE connection status:', data.status);
          return;
        }
        
        setMessages(prev => [...prev, {
          id: data.id,
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

    newEventSource.onerror = (error) => {
      console.error('SSE error:', error);
      setIsConnected(false);
      newEventSource.close();
      
      if (retryCount.current < maxRetries) {
        const timeout = setTimeout(() => {
          retryCount.current++;
          console.log(`Retrying SSE connection (${retryCount.current}/${maxRetries})`);
          setupEventSource();
        }, 2000 * Math.pow(2, retryCount.current));
        
        setReconnectTimer(timeout);
      } else {
        toast({
          title: 'Connection Error',
          description: 'Failed to establish connection after multiple attempts',
          variant: 'destructive',
        });
      }
    };

    setEventSource(newEventSource);
  }, [toast]);

  useEffect(() => {
    setupEventSource();
    
    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
    };
  }, [setupEventSource]);

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
        throw new Error(data.error || 'Failed to send message');
      }

      return await response.json();
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  };
  const { currentFile, addFile } = useFile();

  useEffect(() => {
    if (eventSource) {
      const messageHandler = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'connection') {
            console.log('SSE connection status:', data.status);
            return;
          }
          
          setMessages(prev => [...prev, {
            id: data.id,
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

      const errorHandler = (error: Event) => {
        console.error('SSE error:', error);
        toast({
          title: 'Connection Error',
          description: 'Lost connection to server. Attempting to reconnect...',
          variant: 'destructive',
        });
      };

      eventSource.onmessage = messageHandler;
      eventSource.onerror = errorHandler;

      return () => {
        eventSource.onmessage = null;
        eventSource.onerror = null;
      };
    }
  }, [eventSource, toast]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    try {
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        type: 'text',
        content: input
      };

      // Add user message to the chat
      setMessages(prev => [...prev, userMessage]);
      setInput('');
      setIsLoading(true);

      try {
        const result = await sendMessage(input, currentFile);
        if (!result.success && result.needNewKey) {
          // Show toast notification for API key issue
          toast({
            title: 'API Key Required',
            description: 'The AI service needs a valid API key. Please ask an administrator to update the configuration.',
            variant: 'destructive',
            duration: 5000,
          });
          
          // Add system message to chat
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            type: 'error',
            content: 'The AI service requires a valid API key. Please contact an administrator to resolve this issue.'
          }]);
          return;
        }
      } catch (error: any) {
        console.error('AI Service error:', error);
        
        const errorMessage = error.response?.data?.error || 
                           'Failed to get response from AI. Please try again later.';
        
        // Add error message to chat
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          type: 'error',
          content: errorMessage
        }]);
        
        // Show appropriate toast notification based on error type
        const toastMessage = error.response?.status === 429 ? 
          'Too many requests. Please wait a moment before trying again.' :
          errorMessage;
        
        toast({
          title: 'AI Service Error',
          description: toastMessage,
          variant: 'destructive',
          duration: error.response?.status === 429 ? 3000 : 5000,
        });
      } finally {
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Message handling error:', error);
      toast({
        title: 'Error',
        description: 'Failed to process message. Please try again.',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
      e.preventDefault();
      handleSend();
    }
  };

  const applySuggestion = async (suggestion: Message) => {
    if (!suggestion.fileName) return;

    try {
      const editor = (window as any).monaco?.editor
        .getModels()
        .find((model: any) => model.uri.path === suggestion.fileName);

      if (editor) {
        editor.pushEditOperations(
          [],
          [{
            range: editor.getFullModelRange(),
            text: suggestion.content
          }],
          () => null
        );

        toast({
          title: 'Success',
          description: 'Code changes applied successfully',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to apply code changes',
        variant: 'destructive',
      });
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
                      {message.type === 'suggestion' && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => applySuggestion(message)}
                          className="h-6 w-6"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
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
