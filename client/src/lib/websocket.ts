import { useState, useEffect, useCallback, useRef } from 'react';

export function useWebSocket() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    try {
      if (wsRef.current?.readyState === WebSocket.CONNECTING) {
        console.log('WebSocket connection already in progress');
        return;
      }

      // Close existing connection if any
      if (wsRef.current) {
        console.log('Closing existing WebSocket connection');
        wsRef.current.close();
        wsRef.current = null;
        setWs(null);
        setIsConnected(false);
      }

      console.log('Initializing WebSocket connection...');
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${protocol}//${window.location.host}/ws/ide`);
      wsRef.current = socket;

      socket.onopen = () => {
        console.log('WebSocket connected successfully');
        setIsConnected(true);
        reconnectAttempts.current = 0;
        setWs(socket);
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
        setWs(null);
        (window as any).aiWebSocket = null;

        // Clear any existing reconnection timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }

        // Only attempt reconnection if it wasn't a clean close
        if (event.code !== 1000 && event.code !== 1001) {
          // Implement exponential backoff for reconnection
          if (reconnectAttempts.current < maxReconnectAttempts) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
            reconnectAttempts.current++;
            console.log(`Attempting reconnection in ${delay}ms (attempt ${reconnectAttempts.current})`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              if (!isConnected) {
                connect();
              }
            }, delay);
          } else {
            console.error('Max reconnection attempts reached');
          }
        }
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        // Don't close the socket here, let the onclose handler handle reconnection
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        // Close the socket on error to trigger reconnection
        socket.close();
      };

    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      setIsConnected(false);
      setWs(null);
      
      // Attempt to reconnect after error
      reconnectTimeoutRef.current = setTimeout(connect, 2000);
    }
  }, [isConnected]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setWs(null);
      setIsConnected(false);
    };
  }, [connect]);

  return ws;
}
