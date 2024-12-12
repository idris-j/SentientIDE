import { useState, useEffect, useCallback, useRef } from 'react';

export function useWebSocket() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const maxRetries = 3;
  const retryCount = useRef(0);

  const connect = useCallback(async () => {
    if (isConnecting) return;

    try {
      setIsConnecting(true);

      // Clean up existing connection
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
        setWs(null);
      }

      // Create new WebSocket connection
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${protocol}//${window.location.host}/ws/ide`);
      wsRef.current = socket;

      return new Promise<WebSocket>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
          socket.close();
        }, 5000);

        socket.onopen = () => {
          clearTimeout(timeout);
          console.log('WebSocket connected successfully');
          setWs(socket);
          (window as any).aiWebSocket = socket;
          retryCount.current = 0;
          setIsConnecting(false);
          resolve(socket);
        };

        socket.onclose = (event) => {
          clearTimeout(timeout);
          console.log('WebSocket disconnected:', event.code, event.reason);
          setWs(null);
          (window as any).aiWebSocket = null;
          setIsConnecting(false);

          if (event.code !== 1000 && event.code !== 1001 && retryCount.current < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, retryCount.current), 5000);
            retryCount.current += 1;
            console.log(`Attempting reconnection in ${delay}ms (attempt ${retryCount.current})`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, delay);
          }
        };

        socket.onerror = (error) => {
          clearTimeout(timeout);
          console.error('WebSocket error:', error);
          setIsConnecting(false);
          reject(error);
          socket.close();
        };
      });
    } catch (error) {
      console.error('Error establishing WebSocket connection:', error);
      setIsConnecting(false);
      
      if (retryCount.current < maxRetries) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 2000);
        retryCount.current += 1;
      }
    }
  }, [isConnecting]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
        wsRef.current = null;
        setWs(null);
      }
    };
  }, [connect]);

  return ws;
}