const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws";

type EventHandler = (data: Record<string, unknown>) => void;

/**
 * Managed WebSocket connection with auto-reconnect.
 */
export function createSocket(
  path: string,
  onEvent: EventHandler,
  options?: { maxRetries?: number }
) {
  const maxRetries = options?.maxRetries ?? 5;
  let ws: WebSocket | null = null;
  let retries = 0;
  let disposed = false;

  function connect() {
    if (disposed) return;
    ws = new WebSocket(`${WS_URL}${path}`);

    ws.onopen = () => {
      retries = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onEvent(data);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (disposed) return;
      if (retries < maxRetries) {
        retries++;
        const delay = Math.min(1000 * 2 ** retries, 30_000);
        setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      ws?.close();
    };
  }

  connect();

  return {
    close() {
      disposed = true;
      ws?.close();
    },
  };
}
