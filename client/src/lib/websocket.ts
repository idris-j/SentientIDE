import { useState, useEffect, useCallback, useRef } from 'react';

export interface EventSourceMessage {
  id: string;
  type: 'text' | 'code' | 'suggestion' | 'explanation' | 'error';
  content: string;
  codeLanguage?: string;
  fileName?: string;
}

interface EventSourceWithReconnect extends EventSource {
  reconnectAttempt?: number;
}

export function useEventSource() {
  const [eventSource, setEventSource] = useState<EventSourceWithReconnect | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const eventSourceRef = useRef<EventSourceWithReconnect | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const maxRetries = 3;
  const retryCount = useRef(0);

  const connect = useCallback(() => {
    if (isConnecting) return;

    try {
      setIsConnecting(true);

      // Clean up existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        setEventSource(null);
      }

      // Create new EventSource connection
      const source = new EventSource('/api/sse') as EventSourceWithReconnect;
      source.reconnectAttempt = 0;
      eventSourceRef.current = source;

      source.onopen = () => {
        console.log('SSE connected successfully');
        setEventSource(source);
        (window as any).aiEventSource = source;
        retryCount.current = 0;
        setIsConnecting(false);
      };

      source.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('SSE message received:', data);
        } catch (error) {
          console.error('Error parsing SSE message:', error);
        }
      };

      source.onerror = (error) => {
        console.error('SSE error:', error);
        source.close();
        setEventSource(null);
        setIsConnecting(false);

        if (retryCount.current < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, retryCount.current), 5000);
          retryCount.current += 1;
          console.log(`SSE reconnection attempt ${retryCount.current} in ${delay}ms`);
          
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

    } catch (error) {
      console.error('Error establishing SSE connection:', error);
      setIsConnecting(false);
    }
  }, [isConnecting]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        setEventSource(null);
      }
    };
  }, [connect]);

  // Function to send messages to the server with retry logic
  const sendMessage = async (content: string, currentFile: string | null) => {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const response = await fetch('/api/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content, currentFile }),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to send message: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        attempt++;
        if (attempt === maxRetries) {
          console.error('Error sending message after retries:', error);
          throw error;
        }
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, attempt), 5000)));
      }
    }
  };

  return { eventSource, sendMessage };
}