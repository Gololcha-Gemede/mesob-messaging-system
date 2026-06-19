import { useEffect, useRef } from 'react';

const SSE_BASE_URL = 'http://localhost:5000';

export function useSSE(token, handlers = {}) {
  const eventSourceRef = useRef(null);
  const handlersRef = useRef(handlers);
  const retryTimeoutRef = useRef(null);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!token) return;

    function connect() {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      const url = `${SSE_BASE_URL}/api/events?token=${encodeURIComponent(token)}`;
      console.log('[SSE] Connecting to', url);
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.addEventListener('connected', (e) => {
        console.log('[SSE] Connected:', JSON.parse(e.data));
      });

      es.addEventListener('new_message', (e) => {
        console.log('[SSE] new_message received');
        const data = JSON.parse(e.data);
        handlersRef.current.onNewMessage?.(data);
      });

      es.addEventListener('message_read', (e) => {
        console.log('[SSE] message_read received');
        const data = JSON.parse(e.data);
        handlersRef.current.onMessageRead?.(data);
      });

      es.addEventListener('notification_update', (e) => {
        const data = JSON.parse(e.data);
        handlersRef.current.onNotificationUpdate?.(data);
      });

      es.onopen = () => {
        console.log('[SSE] Connection opened, readyState:', es.readyState);
      };

      es.onerror = () => {
        console.log('[SSE] Error, readyState:', es.readyState);
        es.close();
        eventSourceRef.current = null;
        if (es.readyState === EventSource.CONNECTING) {
          console.log('[SSE] Reconnecting in 3s...');
          retryTimeoutRef.current = setTimeout(connect, 3000);
        } else {
          console.log('[SSE] Connection closed permanently');
        }
      };
    }

    connect();

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [token]);
}
