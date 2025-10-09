import type { Logger } from "@aladdin/logger";
import type { NewsArticle, NewsSource } from "../types";

/**
 * Base class for news sources
 * Provides common functionality for scraping crypto news
 */
export abstract class BaseNewsSource implements NewsSource {
  abstract name: string;
  abstract baseUrl: string;
  enabled = true;

  constructor(protected readonly logger: Logger) {}

  /**
   * Scrape articles from the news source
   */
  abstract scrape(limit: number): Promise<NewsArticle[]>;

  /**
   * Extract crypto symbols from text
   */
  protected extractSymbols(text: string): string[] {
    const symbols = new Set<string>();
    const upperText = text.toUpperCase();

    // Common crypto symbols
    const knownSymbols = [
      "BTC",
      "BITCOIN",
      "ETH",
      "ETHEREUM",
      "BNB",
      "BINANCE",
      "SOL",
      "SOLANA",
      "XRP",
      "RIPPLE",
      "ADA",
      "CARDANO",
      "DOGE",
      "DOGECOIN",
      "DOT",
      "POLKADOT",
      "MATIC",
      "POLYGON",
      "AVAX",
      "AVALANCHE",
      "LINK",
      "CHAINLINK",
      "UNI",
      "UNISWAP",
      "ATOM",
      "COSMOS",
      "LTC",
      "LITECOIN",
      "ETC",
      "XLM",
      "STELLAR",
      "NEAR",
      "ALGO",
      "ALGORAND",
      "FIL",
      "FILECOIN",
      "APT",
      "APTOS",
      "ARB",
      "ARBITRUM",
      "OP",
      "OPTIMISM",
    ];

    for (const symbol of knownSymbols) {
      if (upperText.includes(symbol)) {
        // Normalize to ticker symbol
        const ticker = this.normalizeToTicker(symbol);
        if (ticker) {
          symbols.add(ticker);
        }
      }
    }

    // Look for $SYMBOL patterns
    const dollarMatches = text.match(/\$([A-Z]{2,10})/g);
    if (dollarMatches) {
      for (const match of dollarMatches) {
        symbols.add(match.slice(1)); // Remove $
      }
    }

    return Array.from(symbols);
  }

  /**
   * Normalize coin name to ticker symbol
   */
  private normalizeToTicker(name: string): string | null {
    const nameToTicker: Record<string, string> = {
      BITCOIN: "BTC",
      ETHEREUM: "ETH",
      BINANCE: "BNB",
      SOLANA: "SOL",
      RIPPLE: "XRP",
      CARDANO: "ADA",
      DOGECOIN: "DOGE",
      POLKADOT: "DOT",
      POLYGON: "MATIC",
      AVALANCHE: "AVAX",
      CHAINLINK: "LINK",
      UNISWAP: "UNI",
      COSMOS: "ATOM",
      LITECOIN: "LTC",
      STELLAR: "XLM",
      ALGORAND: "ALGO",
      FILECOIN: "FIL",
      APTOS: "APT",
      ARBITRUM: "ARB",
      OPTIMISM: "OP",
    };

    return nameToTicker[name.toUpperCase()] || name;
  }

  /**
   * Extract categories from text and metadata
   */
  protected extractCategories(text: string, tags?: string[]): string[] {
    const categories = new Set<string>();

    const categoryKeywords: Record<string, string[]> = {
      regulation: [
        "regulation",
        "regulatory",
        "sec",
        "lawsuit",
        "legal",
        "compliance",
        "enforcement",
      ],
      adoption: [
        "adoption",
        "institutional",
        "mainstream",
        "partnership",
        "integration",
      ],
      technology: [
        "technology",
        "upgrade",
        "protocol",
        "blockchain",
        "smart contract",
        "layer 2",
      ],
      market: [
        "price",
        "trading",
        "market",
        "rally",
        "crash",
        "volatility",
        "bull",
        "bear",
      ],
      defi: ["defi", "decentralized finance", "liquidity", "yield", "lending"],
      nft: ["nft", "non-fungible", "collectible", "metaverse"],
      mining: ["mining", "miner", "hashrate", "difficulty"],
      exchange: ["exchange", "binance", "coinbase", "kraken", "ftx"],
    };

    const lowerText = text.toLowerCase();

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          categories.add(category);
          break;
        }
      }
    }

    // Add tags if provided
    if (tags) {
      for (const tag of tags) {
        categories.add(tag.toLowerCase());
      }
    }

    return Array.from(categories);
  }

  /**
   * Generate unique ID for article
   */
  protected generateArticleId(url: string, publishedAt: Date): string {
    const urlHash = url.split("/").pop() || url;
    const timestamp = publishedAt.getTime();
    return `${this.name}_${urlHash}_${timestamp}`;
  }

  /**
   * Clean and normalize text content
   */
  protected cleanText(text: string): string {
    return text
      .replace(/\s+/g, " ") // Multiple spaces to single
      .replace(/\n+/g, "\n") // Multiple newlines to single
      .trim();
  }
}
