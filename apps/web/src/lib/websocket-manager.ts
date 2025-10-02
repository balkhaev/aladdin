import { API_CONFIG } from "./config";

type MessageHandler = (data: unknown) => void;
type ErrorHandler = (error: Event) => void;
type ConnectionHandler = () => void;

const RECONNECT_DELAY = 3000; // 3 секунды
const MAX_RECONNECT_ATTEMPTS = 5;
const PING_INTERVAL = 30_000; // 30 секунд
const isDevelopment = import.meta.env.DEV;

// Вспомогательная функция для логирования только в dev режиме
const devLog = (...args: unknown[]) => {
  if (isDevelopment) {
    console.log(...args);
  }
};

const devError = (...args: unknown[]) => {
  if (isDevelopment) {
    console.error(...args);
  }
};

/**
 * WebSocket Manager для управления WebSocket соединением
 *
 * Функции:
 * - Автоматическое переподключение при разрыве
 * - Ping/pong для поддержания соединения
 * - Подписка на события
 * - Type-safe обработка сообщений
 */
export class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private messageHandlers = new Set<MessageHandler>();
  private errorHandlers = new Set<ErrorHandler>();
  private openHandlers = new Set<ConnectionHandler>();
  private closeHandlers = new Set<ConnectionHandler>();
  private isManualClose = false;
  private isConnecting = false; // Флаг для отслеживания процесса подключения
  private messageQueue: unknown[] = []; // Очередь сообщений до подключения

  constructor(private url: string = API_CONFIG.WS_URL) {}

  /**
   * Подключение к WebSocket серверу
   */
  connect(): void {
    // Если уже подключены или в процессе подключения - ничего не делаем
    if (this.ws?.readyState === WebSocket.OPEN) {
      devLog("[WebSocket] Already connected");
      return;
    }

    if (this.isConnecting) {
      devLog("[WebSocket] Connection already in progress");
      return;
    }

    this.isManualClose = false;
    this.isConnecting = true;

    try {
      devLog(`[WebSocket] Connecting to ${this.url}...`);
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        devLog("[WebSocket] Connected successfully");
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        this.startPing();
        this.flushMessageQueue(); // Отправляем накопленные сообщения
        this.notifyOpenHandlers();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.notifyMessageHandlers(data);
        } catch (error) {
          devError("[WebSocket] Failed to parse message:", error);
        }
      };

      this.ws.onerror = (error) => {
        devError("[WebSocket] Error:", error);
        this.isConnecting = false;
        this.notifyErrorHandlers(error);
      };

      this.ws.onclose = () => {
        devLog("[WebSocket] Connection closed");
        this.isConnecting = false;
        this.stopPing();
        this.notifyCloseHandlers();

        if (!this.isManualClose) {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      devError("[WebSocket] Failed to create connection:", error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Отключение от WebSocket сервера
   */
  disconnect(): void {
    this.isManualClose = true;
    this.stopPing();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    devLog("[WebSocket] Disconnected");
  }

  /**
   * Отправка сообщения на сервер
   */
  send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      devLog("[WebSocketManager] Sending:", data);
      this.ws.send(JSON.stringify(data));
    } else {
      devLog("[WebSocketManager] Queueing message (not connected yet):", data);
      this.messageQueue.push(data);
    }
  }

  /**
   * Подписка на события
   */
  subscribe(
    type: string,
    options?: {
      symbols?: string[];
      userId?: string;
      portfolioId?: string;
    }
  ): void {
    devLog(`[WebSocketManager] Subscribing to ${type}:`, options);
    this.send({
      type: "subscribe",
      channels: [type],
      ...options,
    });
  }

  /**
   * Отписка от событий
   */
  unsubscribe(
    type: string,
    options?: {
      symbols?: string[];
      portfolioId?: string;
    }
  ): void {
    devLog(`[WebSocketManager] Unsubscribing from ${type}:`, options);
    this.send({
      type: "unsubscribe",
      channels: [type],
      ...options,
    });
  }

  /**
   * Добавление обработчика сообщений
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  /**
   * Добавление обработчика ошибок
   */
  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  /**
   * Добавление обработчика открытия соединения
   */
  onOpen(handler: ConnectionHandler): () => void {
    this.openHandlers.add(handler);
    return () => this.openHandlers.delete(handler);
  }

  /**
   * Добавление обработчика закрытия соединения
   */
  onClose(handler: ConnectionHandler): () => void {
    this.closeHandlers.add(handler);
    return () => this.closeHandlers.delete(handler);
  }

  /**
   * Проверка состояния соединения
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Планирование переподключения
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      devError(
        `[WebSocket] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached`
      );
      return;
    }

    this.reconnectAttempts += 1;
    const delay = RECONNECT_DELAY * this.reconnectAttempts;

    devLog(
      `[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`
    );

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Запуск ping для поддержания соединения
   */
  private startPing(): void {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: "ping" });
      }
    }, PING_INTERVAL);
  }

  /**
   * Остановка ping
   */
  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Отправка накопленных сообщений из очереди
   */
  private flushMessageQueue(): void {
    if (this.messageQueue.length === 0) {
      return;
    }

    devLog(
      `[WebSocketManager] Flushing ${this.messageQueue.length} queued messages`
    );

    for (const message of this.messageQueue) {
      if (this.ws?.readyState === WebSocket.OPEN) {
        devLog("[WebSocketManager] Sending queued:", message);
        this.ws.send(JSON.stringify(message));
      }
    }

    this.messageQueue = [];
  }

  /**
   * Уведомление обработчиков сообщений
   */
  private notifyMessageHandlers(data: unknown): void {
    for (const handler of this.messageHandlers) {
      try {
        handler(data);
      } catch (error) {
        devError("[WebSocket] Message handler error:", error);
      }
    }
  }

  /**
   * Уведомление обработчиков ошибок
   */
  private notifyErrorHandlers(error: Event): void {
    for (const handler of this.errorHandlers) {
      try {
        handler(error);
      } catch (err) {
        devError("[WebSocket] Error handler error:", err);
      }
    }
  }

  /**
   * Уведомление обработчиков открытия соединения
   */
  private notifyOpenHandlers(): void {
    for (const handler of this.openHandlers) {
      try {
        handler();
      } catch (error) {
        devError("[WebSocket] Open handler error:", error);
      }
    }
  }

  /**
   * Уведомление обработчиков закрытия соединения
   */
  private notifyCloseHandlers(): void {
    for (const handler of this.closeHandlers) {
      try {
        handler();
      } catch (error) {
        devError("[WebSocket] Close handler error:", error);
      }
    }
  }
}

// Singleton instance
let wsManager: WebSocketManager | null = null;

/**
 * Получить singleton instance WebSocket Manager
 */
export function getWebSocketManager(): WebSocketManager {
  if (!wsManager) {
    wsManager = new WebSocketManager();
  }
  return wsManager;
}
