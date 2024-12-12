import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useWebSocket } from '@/lib/websocket';

interface Suggestion {
  id: string;
  type: 'suggestion' | 'explanation';
  content: string;
}

export function AIPanel() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const ws = useWebSocket();

  useEffect(() => {
    if (ws) {
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setSuggestions(prev => [...prev, data]);
      };
    }
  }, [ws]);

  const applySuggestion = (suggestion: Suggestion) => {
    // Implement suggestion application logic
  };

  return (
    <Card className="h-full rounded-none border-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">AI Assistant</h2>
      </div>
      
      <ScrollArea className="h-[calc(100%-4rem)] rounded-none">
        <div className="p-4 space-y-4">
          {suggestions.map((suggestion) => (
            <Card key={suggestion.id} className="p-4 bg-card hover:bg-card/80 transition-colors">
              <p className="text-sm mb-2">{suggestion.content}</p>
              {suggestion.type === 'suggestion' && (
                <Button 
                  size="sm" 
                  variant="default"
                  onClick={() => applySuggestion(suggestion)}
                >
                  Apply Suggestion
                </Button>
              )}
            </Card>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}
