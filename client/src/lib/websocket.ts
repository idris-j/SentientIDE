import { useState, useEffect, useCallback, useRef } from 'react';

export function useWebSocket() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10; // Increased max attempts
  const baseReconnectDelay = 1000;
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      if (wsRef.current?.readyState === WebSocket.CONNECTING) {
        return; // Don't create a new connection if one is pending
      }

      const socket = new WebSocket(`${protocol}//${window.location.host}/ws/ide`);
      wsRef.current = socket;

      socket.onopen = () => {
        console.log('WebSocket connected successfully');
        setIsConnected(true);
        reconnectAttempts.current = 0;
        setWs(socket);
        // Store the WebSocket instance globally for the editor to use
        (window as any).aiWebSocket = socket;
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message received:', data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };

      socket.onclose = (event) => {
        console.log('WebSocket disconnected', event.code, event.reason);
        setIsConnected(false);
        (window as any).aiWebSocket = null;

        // Implement exponential backoff for reconnection
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
          reconnectAttempts.current++;
          
          setTimeout(() => {
            if (!isConnected) {
              connect();
            }
          }, delay);
        }
      };

      setWs(socket);
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      setIsConnected(false);
    }
  }, [isConnected]);

  useEffect(() => {
    connect();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [connect]);

  // Provide both the WebSocket instance and connection state
  return ws;
}
