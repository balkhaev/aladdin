/**
 * Bybit Futures WebSocket Connector
 * Connects to Bybit linear (USDT perpetual) WebSocket
 */

import type { Logger } from "@aladdin/logger";
import { WebSocket } from "ws";

type ConnectorOptions = {
  logger: Logger;
  wsUrl: string;
  apiUrl: string;
};

type TickerData = {
  symbol: string;
  lastPrice: string;
  volume24h: string;
  turnover24h: string; // Volume in quote currency (USD)
  highPrice24h: string;
  lowPrice24h: string;
  prevPrice24h: string;
  price24hPcnt: string;
  bid1Price: string;
  ask1Price: string;
  bid1Size: string;
  ask1Size: string;
};

export class BybitFuturesConnector {
  private ws: WebSocket | null = null;
  private subscriptions: Set<string> = new Set();
  private reconnectTimer: Timer | null = null;
  private pingInterval: Timer | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 5000;
  private isConnecting = false;
  private onTickCallback?: (symbol: string, data: TickerData) => void;
  private tickerState: Map<string, TickerData> = new Map(); // Track state per symbol

  constructor(private options: ConnectorOptions) {}

  /**
   * Connect to Bybit WebSocket
   */
  async connect(): Promise<void> {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return await Promise.resolve();
    }

    this.isConnecting = true;
    const { logger, wsUrl } = this.options;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.on("open", () => {
          logger.info("Connected to Bybit WebSocket");
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.startPingInterval();

          // Resubscribe to all symbols
          for (const symbol of this.subscriptions) {
            this.subscribeToSymbol(symbol);
          }

          resolve();
        });

        this.ws.on("message", (data: Buffer) => {
          this.handleMessage(data.toString());
        });

        this.ws.on("error", (error: Error) => {
          logger.error("Bybit WebSocket error", error);
          this.isConnecting = false;
          reject(error);
        });

        this.ws.on("close", () => {
          logger.warn("Bybit WebSocket closed");
          this.isConnecting = false;
          this.stopPingInterval();
          this.attemptReconnect();
        });
      } catch (error) {
        this.isConnecting = false;
        logger.error("Failed to create WebSocket", error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from Bybit WebSocket
   */
  async disconnect(): Promise<void> {
    const { logger } = this.options;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopPingInterval();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
      logger.info("Disconnected from Bybit WebSocket");
    }

    return await Promise.resolve();
  }

  /**
   * Subscribe to symbol
   */
  subscribe(symbol: string): void {
    this.subscriptions.add(symbol);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.subscribeToSymbol(symbol);
    }
  }

  /**
   * Unsubscribe from symbol
   */
  unsubscribe(symbol: string): void {
    this.subscriptions.delete(symbol);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.unsubscribeFromSymbol(symbol);
    }
  }

  /**
   * Set tick callback
   */
  onTick(callback: (symbol: string, data: TickerData) => void): void {
    this.onTickCallback = callback;
  }

  /**
   * Get all USDT Perpetual symbols from Bybit API
   */
  async getAllSymbols(): Promise<string[]> {
    const { logger, apiUrl } = this.options;

    try {
      const response = await fetch(
        `${apiUrl}/v5/market/instruments-info?category=linear&limit=1000`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.retCode !== 0) {
        throw new Error(`Bybit API error: ${data.retMsg}`);
      }

      // Filter for USDT perpetuals only
      const symbols = data.result.list
        .filter(
          (item: { symbol: string; quoteCoin: string; status: string }) =>
            item.quoteCoin === "USDT" && item.status === "Trading"
        )
        .map((item: { symbol: string }) => item.symbol);

      logger.info("Fetched Bybit symbols", { count: symbols.length });
      return symbols;
    } catch (error) {
      logger.error("Failed to fetch Bybit symbols", error);
      throw error;
    }
  }

  /**
   * Get current subscriptions
   */
  async getSubscriptions(): Promise<string[]> {
    return await Promise.resolve(Array.from(this.subscriptions));
  }

  /**
   * Subscribe to symbol via WebSocket
   */
  private subscribeToSymbol(symbol: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          op: "subscribe",
          args: [`tickers.${symbol}`],
        })
      );
    }
  }

  /**
   * Unsubscribe from symbol via WebSocket
   */
  private unsubscribeFromSymbol(symbol: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          op: "unsubscribe",
          args: [`tickers.${symbol}`],
        })
      );
    }
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(message: string): void {
    try {
      const data = JSON.parse(message);

      // Handle pong
      if (data.op === "pong") {
        return;
      }

      // Handle subscription confirmation
      if (data.op === "subscribe") {
        return;
      }

      // Handle ticker data
      if (data.topic?.startsWith("tickers.")) {
        const partialUpdate = data.data as Partial<TickerData>;
        const symbol = partialUpdate.symbol;

        if (!symbol) return;

        // Get existing state or create new
        const currentState = this.tickerState.get(symbol) || ({} as TickerData);

        // Merge partial update with existing state
        const updatedState: TickerData = {
          ...currentState,
          ...partialUpdate,
        };

        // Store updated state
        this.tickerState.set(symbol, updatedState);

        // Only call callback if we have essential data
        if (
          updatedState.lastPrice &&
          updatedState.turnover24h &&
          this.onTickCallback
        ) {
          this.onTickCallback(symbol, updatedState);
        }
      }
    } catch (error) {
      this.options.logger.error("Failed to parse WebSocket message", {
        error,
        message,
      });
    }
  }

  /**
   * Start ping interval
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ op: "ping" }));
      }
    }, 20_000); // Ping every 20 seconds
  }

  /**
   * Stop ping interval
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Attempt to reconnect to WebSocket
   */
  private async attemptReconnect(): Promise<void> {
    const { logger } = this.options;

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error("Max reconnection attempts reached");
      return await Promise.resolve();
    }

    this.reconnectAttempts++;
    logger.info("Attempting to reconnect to Bybit WebSocket", {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
    });

    return await new Promise((resolve) => {
      this.reconnectTimer = setTimeout(() => {
        this.connect()
          .then(resolve)
          .catch((error) => {
            logger.error("Reconnection failed", error);
            resolve();
          });
      }, this.reconnectDelay * this.reconnectAttempts);
    });
  }
}
