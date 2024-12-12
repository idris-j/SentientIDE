import { useEffect, useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWebSocket } from '@/lib/websocket';
import { useFile } from '@/lib/file-context';
import { Send, Code, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  type: 'text' | 'code' | 'suggestion' | 'explanation';
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
  const ws = useWebSocket();
  const { currentFile, addFile } = useFile();

  useEffect(() => {
    if (ws) {
      const messageHandler = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
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
        console.error('WebSocket error:', error);
        toast({
          title: 'Connection Error',
          description: 'Lost connection to server. Attempting to reconnect...',
          variant: 'destructive',
        });
      };

      ws.onmessage = messageHandler;
      ws.onerror = errorHandler;

      return () => {
        ws.onmessage = null;
        ws.onerror = null;
      };
    }
  }, [ws, toast]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    try {
      // Wait for WebSocket connection if not ready
      let retries = 0;
      const maxRetries = 3;
      
      while ((!ws || ws.readyState !== WebSocket.OPEN) && retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        retries++;
      }

      // Final check if WebSocket is connected
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        throw new Error('Unable to establish WebSocket connection. Please refresh the page.');
      }

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

      // Send message through WebSocket
      ws.send(JSON.stringify({
        type: 'query',
        content: input,
        currentFile,
      }));
    } catch (error) {
      console.error('WebSocket error:', error);
      toast({
        title: 'Connection Error',
        description: error instanceof Error ? error.message : 'Failed to send message. Please try again.',
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
