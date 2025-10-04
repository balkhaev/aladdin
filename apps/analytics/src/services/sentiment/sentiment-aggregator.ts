import { BaseService } from "@aladdin/shared/base-service";
import { TelegramClient } from "./telegram-client";
import { type Tweet, TwitterClient } from "./twitter-client";

export type SentimentAnalysis = {
  symbol: string;
  overall: number; // -1 to 1
  telegram: {
    score: number;
    bullish: number;
    bearish: number;
    signals: number;
  };
  twitter: {
    score: number;
    positive: number;
    negative: number;
    neutral: number;
    tweets: number;
  };
  confidence: number; // 0 to 1
  timestamp: Date;
};

export type SentimentShift = {
  symbol: string;
  shift: "BULLISH" | "BEARISH" | "NEUTRAL";
  magnitude: number; // 0 to 1
  confidence: number; // 0 to 1
  previousScore: number;
  currentScore: number;
  timestamp: Date;
};

const SHIFT_THRESHOLD = 0.3; // Minimum change to consider a shift
const HIGH_CONFIDENCE_TWEETS = 20; // Min tweets for high confidence
const HIGH_CONFIDENCE_SIGNALS = 5; // Min signals for high confidence
const ANALYSIS_INTERVAL_MS = 300_000; // 5 minutes
const MILLISECONDS_PER_MINUTE = 60_000;
const MAX_TELEGRAM_WEIGHT = 10;
const MAX_TWITTER_WEIGHT = 50;
const TOP_INFLUENCERS_TO_TRACK = 3;
const TWEETS_PER_INFLUENCER = 5;
const DEFAULT_TELEGRAM_SIGNALS_LIMIT = 50;
const DEFAULT_TWITTER_TWEETS_LIMIT = 50;
const DEFAULT_SENTIMENT_SCORE = 0;
const TREND_CONFIDENCE_DIVISOR = 1;

/**
 * Sentiment Aggregator Service
 * Aggregates sentiment from multiple sources (Telegram, Twitter)
 */
export class SentimentAggregator extends BaseService {
  private telegramClient!: TelegramClient;
  private twitterClient!: TwitterClient;
  private sentimentHistory: Map<string, number[]> = new Map();
  private readonly HISTORY_SIZE = 10; // Keep last 10 sentiment scores

  // Crypto influencers to track (updated list 2025)
  private readonly CRYPTO_INFLUENCERS = [
    "VitalikButerin", // Ethereum founder
    "APompliano", // Crypto analyst, investor
    "CryptoCobain", // Crypto trader
    "CryptoWhale", // Crypto analyst
    "saylor", // Michael Saylor (MicroStrategy)
    "novogratz", // Galaxy Digital founder
    "RaoulGMI", // Macro investor, crypto bull
    "CryptosRUs", // Crypto educator
    "IvanOnTech", // Crypto educator
    "TheCryptoDog", // Crypto trader
    "WClementeThird", // On-chain analyst
    "PeterLBrandt", // Veteran trader
    "KoroushAK", // On-chain analyst
    "TheBlockCrypto", // Crypto news
    "CoinDesk", // Crypto news
  ];

  getServiceName(): string {
    return "sentiment";
  }

  protected onInitialize(): Promise<void> {
    if (!this.natsClient) {
      throw new Error("NATS client is required for Sentiment Service");
    }

    // Initialize clients
    const telegaUrl = process.env.TELEGA_URL || "http://localhost:3005";
    const twityUrl = process.env.TWITY_URL || "http://localhost:8000";

    this.telegramClient = new TelegramClient(
      telegaUrl,
      this.logger,
      this.natsClient
    );
    this.twitterClient = new TwitterClient(twityUrl, this.logger);

    this.logger.info("Sentiment Aggregator initialized", {
      telegaUrl,
      twityUrl,
    });

    // Start periodic sentiment analysis
    this.startPeriodicAnalysis();

    return Promise.resolve();
  }

  protected onHealthCheck(): Promise<Record<string, boolean>> {
    return Promise.resolve({
      telegram: true, // Will be checked async
      twitter: true, // Will be checked async
    });
  }

  /**
   * Start periodic sentiment analysis
   */
  private startPeriodicAnalysis(): void {
    setInterval(async () => {
      try {
        // Analyze popular crypto symbols
        const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"];

        for (const symbol of symbols) {
          const analysis = await this.analyzeSentiment(symbol);

          // Publish to NATS
          await this.natsClient?.publish(
            "sentiment.analysis",
            JSON.stringify({
              type: "sentiment.analysis",
              data: analysis,
            })
          );

          // Check for sentiment shifts
          const shift = this.detectSentimentShift(symbol, analysis.overall);
          if (shift) {
            await this.natsClient?.publish(
              "sentiment.shift",
              JSON.stringify({
                type: "sentiment.shift",
                data: shift,
              })
            );

            this.logger.info("Sentiment shift detected", shift);
          }
        }
      } catch (error) {
        this.logger.error("Failed to run periodic sentiment analysis", error);
      }
    }, ANALYSIS_INTERVAL_MS);

    this.logger.info("Started periodic sentiment analysis", {
      intervalMinutes: ANALYSIS_INTERVAL_MS / MILLISECONDS_PER_MINUTE,
    });
  }

  /**
   * Analyze sentiment for a symbol
   */
  async analyzeSentiment(symbol: string): Promise<SentimentAnalysis> {
    this.logger.info("Analyzing sentiment", { symbol });

    // Получаем сигналы из Telegram (синхронно из кеша)
    const telegramSignals = this.telegramClient.getSignalsForPair(
      symbol,
      DEFAULT_TELEGRAM_SIGNALS_LIMIT
    );

    // Fetch tweets from Twitter
    const tweets = await this.searchSymbolOnTwitter(
      symbol,
      DEFAULT_TWITTER_TWEETS_LIMIT
    );

    // Analyze sentiment from each source
    const telegramSentiment =
      this.telegramClient.analyzeSentiment(telegramSignals);
    const twitterSentiment = this.twitterClient.analyzeSentiment(tweets);

    // Calculate weighted overall sentiment
    const telegramWeight = Math.min(
      telegramSignals.length / MAX_TELEGRAM_WEIGHT,
      1
    );
    const twitterWeight = Math.min(tweets.length / MAX_TWITTER_WEIGHT, 1);

    const totalWeight = telegramWeight + twitterWeight;
    const overall =
      totalWeight > 0
        ? (telegramSentiment.score * telegramWeight +
            twitterSentiment.score * twitterWeight) /
          totalWeight
        : 0;

    // Calculate confidence based on data volume
    const signalsConfidence = Math.min(
      telegramSignals.length / HIGH_CONFIDENCE_SIGNALS,
      1
    );
    const tweetsConfidence = Math.min(
      tweets.length / HIGH_CONFIDENCE_TWEETS,
      1
    );
    const confidence = (signalsConfidence + tweetsConfidence) / 2;

    return {
      symbol,
      overall,
      telegram: {
        score: telegramSentiment.score,
        bullish: telegramSentiment.bullish,
        bearish: telegramSentiment.bearish,
        signals: telegramSignals.length,
      },
      twitter: {
        score: twitterSentiment.score,
        positive: twitterSentiment.positive,
        negative: twitterSentiment.negative,
        neutral: twitterSentiment.neutral,
        tweets: tweets.length,
      },
      confidence,
      timestamp: new Date(),
    };
  }

  /**
   * Get tweets about a symbol from ClickHouse
   */
  private async searchSymbolOnTwitter(
    symbol: string,
    limit: number
  ): Promise<Tweet[]> {
    // Fetch from ClickHouse (already filtered by symbol)
    const tweets = await this.twitterClient.searchTweetsBySymbol(symbol, limit);

    // Remove duplicates by ID (just in case)
    const uniqueTweets = Array.from(
      new Map(tweets.map((t) => [t.id, t])).values()
    );

    return uniqueTweets;
  }

  /**
   * Detect sentiment shift
   */
  private detectSentimentShift(
    symbol: string,
    currentScore: number
  ): SentimentShift | null {
    // Get history
    let history = this.sentimentHistory.get(symbol) || [];

    // Add current score
    history.push(currentScore);

    // Keep only last N scores
    if (history.length > this.HISTORY_SIZE) {
      history = history.slice(-this.HISTORY_SIZE);
    }

    this.sentimentHistory.set(symbol, history);

    // Need at least 2 scores to detect shift
    if (history.length < 2) {
      return null;
    }

    // Calculate average of previous scores
    const previousScores = history.slice(0, history.length - 1);
    const previousAvg =
      previousScores.reduce((sum, s) => sum + s, 0) / previousScores.length;

    // Calculate change
    const change = currentScore - previousAvg;
    const magnitude = Math.abs(change);

    // Check if shift is significant
    if (magnitude < SHIFT_THRESHOLD) {
      return null;
    }

    // Determine shift direction
    let shift: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
    if (change > SHIFT_THRESHOLD) {
      shift = "BULLISH";
    } else if (change < -SHIFT_THRESHOLD) {
      shift = "BEARISH";
    }

    // Calculate confidence based on consistency of trend
    const RECENT_SCORES_SIZE = 5;
    const recentScores = history.slice(-RECENT_SCORES_SIZE);
    const trend =
      recentScores.length > 1
        ? (recentScores.at(-1) ?? DEFAULT_SENTIMENT_SCORE) -
          (recentScores[0] ?? DEFAULT_SENTIMENT_SCORE)
        : DEFAULT_SENTIMENT_SCORE;
    const confidence = Math.min(Math.abs(trend) / TREND_CONFIDENCE_DIVISOR, 1);

    return {
      symbol,
      shift,
      magnitude,
      confidence,
      previousScore: previousAvg,
      currentScore,
      timestamp: new Date(),
    };
  }

  /**
   * Get sentiment history for a symbol
   */
  getSentimentHistory(symbol: string): number[] {
    return this.sentimentHistory.get(symbol) || [];
  }

  /**
   * Check health of external services
   */
  async checkExternalServices(): Promise<{
    telegram: boolean;
    twitter: boolean;
  }> {
    const [telegram, twitter] = await Promise.all([
      this.telegramClient.checkHealth(),
      this.twitterClient.checkHealth(),
    ]);

    return { telegram, twitter };
  }

  /**
   * Debug метод для проверки внутреннего состояния
   */
  getDebugInfo() {
    return {
      telegram: this.telegramClient.getDebugStats(),
      sentimentHistory: Object.fromEntries(this.sentimentHistory),
    };
  }

  /**
   * Перезагрузить историю Telegram сообщений
   */
  async reloadTelegramHistory() {
    return await this.telegramClient.reloadHistory();
  }
}
