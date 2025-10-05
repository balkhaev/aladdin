import { BaseService } from "@aladdin/service";
import { closeBrowser, initBrowser } from "./browser";
import { TwitterClickHouseClient } from "./clickhouse-client";
import { scrapeTweetsByUser } from "./scraper";
import type { Tweet } from "./types";

const SCRAPE_INTERVAL_MS = 600_000; // 10 minutes
const TWEETS_PER_INFLUENCER = 10;
const MS_PER_MINUTE = 60_000;
const REQUEST_DELAY_MS = 2000; // Delay between requests to avoid rate limiting

// Top crypto influencers to track
const CRYPTO_INFLUENCERS = [
  "VitalikButerin",
  "APompliano",
  "CryptoCobain",
  "CryptoWhale",
  "saylor",
  "novogratz",
  "RaoulGMI",
  "CryptosRUs",
  "IvanOnTech",
  "TheCryptoDog",
  "WClementeThird",
  "PeterLBrandt",
  "KoroushAK",
  "TheBlockCrypto",
  "CoinDesk",
];

export class TwityService extends BaseService {
  private browserInitialized = false;
  private chClient: TwitterClickHouseClient;
  private scrapeInterval: NodeJS.Timeout | null = null;

  constructor(deps: ConstructorParameters<typeof BaseService>[0]) {
    super(deps);
    this.chClient = new TwitterClickHouseClient(this.logger);
  }

  getServiceName(): string {
    return "twity";
  }

  protected onInitialize(): Promise<void> {
    // Проверяем наличие необходимых переменных окружения (опционально)
    const hasTwitterUsername = !!process.env.TWITTER_USERNAME;
    const hasTwUsername = !!process.env.TW_USERNAME;
    const hasUsername = !!process.env.USERNAME;
    const hasAnyCredentials =
      hasTwitterUsername || hasTwUsername || hasUsername;

    if (!hasAnyCredentials) {
      this.logger.warn(
        "Twitter credentials not provided. Scraping might be limited."
      );
    }

    this.logger.info("Twity service configuration validated");
    return Promise.resolve();
  }

  protected async onStart(): Promise<void> {
    try {
      // Инициализируем браузер при старте
      await initBrowser();
      this.browserInitialized = true;
      this.logger.info("Browser initialized successfully");

      // Запускаем первый сбор сразу
      this.scrapeAndSave().catch((error) => {
        this.logger.error("Initial scrape failed", error);
      });

      // Запускаем периодический сбор
      this.scrapeInterval = setInterval(() => {
        this.scrapeAndSave().catch((error) => {
          this.logger.error("Periodic scrape failed", error);
        });
      }, SCRAPE_INTERVAL_MS);

      this.logger.info("Started periodic Twitter scraping", {
        intervalMinutes: SCRAPE_INTERVAL_MS / MS_PER_MINUTE,
      });
    } catch (error) {
      this.logger.error("Failed to initialize browser", error);
      throw error;
    }
  }

  protected async onStop(): Promise<void> {
    this.logger.info("Stopping Twity service...");

    try {
      // Stop periodic scraping
      if (this.scrapeInterval) {
        clearInterval(this.scrapeInterval);
        this.scrapeInterval = null;
        this.logger.info("Stopped periodic scraping");
      }

      // Close browser
      if (this.browserInitialized) {
        await closeBrowser();
        this.logger.info("Browser closed");
      }

      // Close ClickHouse connection
      await this.chClient.close();
      this.logger.info("ClickHouse connection closed");
    } catch (error) {
      this.logger.error("Error during shutdown", error);
      throw error;
    }
  }

  protected onHealthCheck(): Promise<Record<string, boolean>> {
    return Promise.resolve({
      browserReady: this.browserInitialized,
    });
  }

  /**
   * Scrape tweets from all influencers and save to ClickHouse
   */
  private async scrapeAndSave(): Promise<void> {
    const runId = await this.chClient.startScrapeRun();
    let totalTweets = 0;
    let influencersScraped = 0;

    try {
      this.logger.info("Starting periodic Twitter scrape", {
        runId,
        influencers: CRYPTO_INFLUENCERS.length,
      });

      // Scrape each influencer
      for (const username of CRYPTO_INFLUENCERS) {
        try {
          const tweets = await scrapeTweetsByUser(
            username,
            TWEETS_PER_INFLUENCER
          );

          if (tweets.length > 0) {
            await this.chClient.saveTweets(tweets);
            totalTweets += tweets.length;
            influencersScraped++;

            this.logger.info("Scraped and saved tweets", {
              username,
              tweets: tweets.length,
            });
          }

          // Small delay between requests to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
        } catch (error) {
          this.logger.error("Failed to scrape influencer", error, { username });
          // Continue with other influencers
        }
      }

      await this.chClient.completeScrapeRun({
        runId,
        status: "completed",
        influencersScraped,
        tweetsCollected: totalTweets,
      });

      this.logger.info("Completed periodic Twitter scrape", {
        runId,
        totalTweets,
        influencersScraped,
      });
    } catch (error) {
      await this.chClient.completeScrapeRun({
        runId,
        status: "failed",
        influencersScraped,
        tweetsCollected: totalTweets,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      this.logger.error("Periodic scrape failed", error, { runId });
      throw error;
    }
  }

  /**
   * Получить твиты пользователя (для manual запросов)
   */
  async getUserTweets(username: string, limit = 20): Promise<Tweet[]> {
    this.logger.info("Fetching user tweets", { username, limit });
    try {
      const tweets = await scrapeTweetsByUser(username, limit);
      this.logger.info("User tweets fetch completed", {
        username,
        found: tweets.length,
      });
      return tweets;
    } catch (error) {
      this.logger.error("Failed to fetch user tweets", error, { username });
      throw error;
    }
  }
}
