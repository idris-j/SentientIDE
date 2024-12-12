import { useState, useEffect, useRef } from 'react';

export function useWebSocket() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const maxRetries = 3;
  const retryCount = useRef(0);

  useEffect(() => {
    function connect() {
      try {
        // Clean up any existing connection
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
          setWs(null);
        }

        // Create new WebSocket connection
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const socket = new WebSocket(`${protocol}//${window.location.host}/ws/ide`);
        wsRef.current = socket;

        socket.onopen = () => {
          console.log('WebSocket connected successfully');
          setWs(socket);
          (window as any).aiWebSocket = socket;
          retryCount.current = 0; // Reset retry count on successful connection
        };

        socket.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason);
          setWs(null);
          (window as any).aiWebSocket = null;

          // Only retry if not a normal closure and haven't exceeded max retries
          if (event.code !== 1000 && event.code !== 1001 && retryCount.current < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, retryCount.current), 5000);
            retryCount.current += 1;
            console.log(`Attempting reconnection in ${delay}ms (attempt ${retryCount.current})`);
            
            reconnectTimeoutRef.current = setTimeout(connect, delay);
          }
        };

        socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          socket.close(); // Close socket on error to trigger reconnect
        };

      } catch (error) {
        console.error('Error establishing WebSocket connection:', error);
        if (retryCount.current < maxRetries) {
          reconnectTimeoutRef.current = setTimeout(connect, 2000);
          retryCount.current += 1;
        }
      }
    }

    connect(); // Initial connection attempt

    // Cleanup function
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
  }, []); // Empty dependency array since we don't want to recreate the effect

  return ws;
}