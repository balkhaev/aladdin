import type { Logger } from "@aladdin/shared/logger";
import type { NatsClient } from "@aladdin/shared/nats-client";

export type TelegramMessage = {
  channelId: string;
  messageId: number;
  text: string;
  date: number;
  views?: number;
  forwards?: number;
  timestamp: number;
};

export type TelegramSignal = {
  pair?: string;
  direction?: "LONG" | "SHORT" | "BUY" | "SELL";
  entry?: number;
  targets?: number[];
  stopLoss?: number;
  confidence?: number;
  text: string;
  timestamp: number;
  channelId: string;
};

// Regex для парсинга
const NUMBER_REGEX = /\d+\.?\d*/g;
const TRAILING_SLASH_REGEX = /\/$/;

// Константы
const MAX_TARGETS = 3;
const DEFAULT_SIGNAL_LIMIT = 50;
const DEFAULT_SIGNALS_LIMIT = 100;
const HEALTH_CHECK_TIMEOUT_MS = 5000;
const TIMESTAMP_MS_MULTIPLIER = 1000;
const BASE_CONFIDENCE = 0.3;
const CONFIDENCE_INCREMENT = 0.1;
const MAX_CONFIDENCE = 0.7;

/**
| * Telegram Client - интеграция с telega сервисом через NATS
| */
export class TelegramClient {
  private telegaUrl: string;
  private messages: TelegramMessage[] = [];
  private signals: TelegramSignal[] = [];
  private readonly MAX_MESSAGES = 1000;

  constructor(
    telegaUrl: string,
    private logger: Logger,
    private natsClient: NatsClient
  ) {
    this.telegaUrl = telegaUrl.replace(TRAILING_SLASH_REGEX, "");
    this.subscribeToMessages();

    // Загружаем исторические сообщения с задержкой,
    // чтобы дать telega время запуститься
    setTimeout(() => {
      this.loadHistoricalMessages().catch((error) => {
        this.logger.error("Failed to load historical messages", error);
      });
    }, 3000);
  }

  /**
   * Подписка на сообщения из Telegram через NATS
   */
  private subscribeToMessages(): void {
    this.natsClient.subscribe<TelegramMessage>("telega.message", (msg) => {
      this.logger.debug("Received Telegram message", {
        channelId: msg.channelId,
        messageId: msg.messageId,
      });

      this.processMessage(msg);
    });

    this.logger.info("Subscribed to telega.message NATS topic");
  }

  /**
   * Загрузка исторических сообщений из Telegram при старте
   */
  private async loadHistoricalMessages(): Promise<void> {
    this.logger.info("Loading historical Telegram messages...");

    try {
      const response = await fetch(
        `${this.telegaUrl}/channels/messages/recent?limit=100`
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        channels: Array<{
          channelId: string;
          messages: Array<{
            id: number;
            date: number;
            message: string;
            views?: number;
            forwards?: number;
          }>;
        }>;
      };

      let totalSignals = 0;

      for (const channel of data.channels) {
        for (const msg of channel.messages) {
          const telegramMsg: TelegramMessage = {
            channelId: channel.channelId,
            messageId: msg.id,
            text: msg.message,
            date: msg.date,
            views: msg.views,
            forwards: msg.forwards,
            timestamp: msg.date * TIMESTAMP_MS_MULTIPLIER,
          };

          const signalsBefore = this.signals.length;
          this.processMessage(telegramMsg);

          if (this.signals.length > signalsBefore) {
            totalSignals++;
          }
        }
      }

      this.logger.info("Historical messages loaded", {
        totalMessages: data.channels.reduce(
          (sum, ch) => sum + ch.messages.length,
          0
        ),
        signalsParsed: totalSignals,
      });
    } catch (error) {
      this.logger.error("Failed to load historical messages", error);
    }
  }

  /**
   * Обработка сообщения (для NATS и HTTP)
   */
  private processMessage(msg: TelegramMessage): void {
    // Сохраняем сообщение
    this.messages.push(msg);
    if (this.messages.length > this.MAX_MESSAGES) {
      this.messages = this.messages.slice(-this.MAX_MESSAGES);
    }

    // Парсим сигналы из сообщения
    const signal = this.parseSignal(msg);
    if (signal) {
      this.logger.info("Parsed trading signal", {
        pair: signal.pair,
        direction: signal.direction,
        confidence: signal.confidence,
      });
      this.signals.push(signal);
      if (this.signals.length > this.MAX_MESSAGES) {
        this.signals = this.signals.slice(-this.MAX_MESSAGES);
      }
    }
  }

  /**
   * Парсинг торгового сигнала из текста сообщения
   * Поддерживает как англ, так и рус тексты
   */
  private parseSignal(msg: TelegramMessage): TelegramSignal | null {
    const text = msg.text.toLowerCase();

    // Ищем упоминания криптовалют
    const pairs = [
      "btc",
      "eth",
      "sol",
      "bnb",
      "xrp",
      "ada",
      "doge",
      "avax",
      "dot",
      "matic",
      "биткоин",
      "эфир",
    ];
    const foundPair = pairs.find((p) => text.includes(p));
    if (!foundPair) {
      return null;
    }

    // Нормализуем символ
    const normalizedPair = this.normalizePairName(foundPair);

    // Определяем направление сигнала (поддержка англ + рус)
    let direction: "LONG" | "SHORT" | "BUY" | "SELL" | undefined;
    let confidence = BASE_CONFIDENCE; // Низкая confidence для новостных сообщений

    const bullishWords = [
      "long",
      "buy",
      "bullish",
      "rally",
      "surge",
      "pump",
      "moon",
      "breakout",
      "gain",
      "profit",
      "green",
      "рост",
      "покупк",
      "приток",
      "бычь",
      "ралли",
      "пробой",
      "прибыл",
      "позитив",
    ];

    const bearishWords = [
      "short",
      "sell",
      "bearish",
      "crash",
      "dump",
      "drop",
      "fall",
      "loss",
      "red",
      "падени",
      "продаж",
      "медвеж",
      "обвал",
      "снижени",
      "убыт",
      "негатив",
    ];

    // Подсчитываем bullish и bearish слова
    const bullishCount = bullishWords.filter((w) => text.includes(w)).length;
    const bearishCount = bearishWords.filter((w) => text.includes(w)).length;

    if (bullishCount > bearishCount && bullishCount > 0) {
      direction = "LONG";
      confidence = Math.min(
        BASE_CONFIDENCE + bullishCount * CONFIDENCE_INCREMENT,
        MAX_CONFIDENCE
      );
    } else if (bearishCount > bullishCount && bearishCount > 0) {
      direction = "SHORT";
      confidence = Math.min(
        BASE_CONFIDENCE + bearishCount * CONFIDENCE_INCREMENT,
        MAX_CONFIDENCE
      );
    }

    // Если направление не определено, но есть упоминание крипты - NEUTRAL
    if (!direction) {
      return null; // Пропускаем нейтральные сообщения
    }

    // Извлекаем числовые значения для entry, targets, stop loss
    const numbers = text.match(NUMBER_REGEX)?.map(Number) || [];
    const entry = numbers[0];
    const targets = numbers.slice(1, MAX_TARGETS + 1);
    const stopLoss = numbers.at(-1);

    return {
      pair: `${normalizedPair}USDT`,
      direction,
      entry,
      targets: targets.length > 0 ? targets : undefined,
      stopLoss,
      confidence,
      text: msg.text,
      timestamp: msg.timestamp,
      channelId: msg.channelId,
    };
  }

  /**
   * Нормализация названия пары
   */
  private normalizePairName(pair: string): string {
    const mapping: Record<string, string> = {
      биткоин: "BTC",
      эфир: "ETH",
      ethereum: "ETH",
      bitcoin: "BTC",
    };

    return mapping[pair.toLowerCase()] || pair.toUpperCase();
  }

  /**
   * Получить последние сигналы
   */
  getSignals(limit = DEFAULT_SIGNALS_LIMIT): TelegramSignal[] {
    return this.signals.slice(-limit);
  }

  /**
   * Получить сигналы для конкретной пары
   */
  getSignalsForPair(
    pair: string,
    limit = DEFAULT_SIGNAL_LIMIT
  ): TelegramSignal[] {
    return this.signals
      .filter((s) => s.pair === pair.toUpperCase())
      .slice(-limit);
  }

  /**
   * Получить статистику для debug
   */
  getDebugStats() {
    const signalsByPair = this.signals.reduce(
      (acc, signal) => {
        const pair = signal.pair || "UNKNOWN";
        acc[pair] = (acc[pair] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalMessages: this.messages.length,
      totalSignals: this.signals.length,
      signalsByPair,
      lastSignals: this.signals.slice(-5).map((s) => ({
        pair: s.pair,
        direction: s.direction,
        confidence: s.confidence,
        timestamp: s.timestamp,
      })),
    };
  }

  /**
   * Публичный метод для ручной перезагрузки истории
   */
  async reloadHistory(): Promise<{ messages: number; signals: number }> {
    await this.loadHistoricalMessages();
    return {
      messages: this.messages.length,
      signals: this.signals.length,
    };
  }

  /**
   * Check health of telega service
   */
  async checkHealth(): Promise<boolean> {
    try {
      const url = `${this.telegaUrl}/health`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
      });
      return response.ok;
    } catch (error) {
      this.logger.error("Telegram service health check failed", error);
      return false;
    }
  }

  /**
   * Analyze sentiment from Telegram signals
   * Returns a score from -1 (very bearish) to 1 (very bullish)
   */
  analyzeSentiment(signals: TelegramSignal[]): {
    score: number;
    bullish: number;
    bearish: number;
    total: number;
  } {
    if (signals.length === 0) {
      return { score: 0, bullish: 0, bearish: 0, total: 0 };
    }

    let bullish = 0;
    let bearish = 0;

    for (const signal of signals) {
      if (signal.direction === "LONG" || signal.direction === "BUY") {
        bullish++;
      } else if (signal.direction === "SHORT" || signal.direction === "SELL") {
        bearish++;
      }
    }

    const total = bullish + bearish;
    const score = total > 0 ? (bullish - bearish) / total : 0;

    return { score, bullish, bearish, total };
  }
}
