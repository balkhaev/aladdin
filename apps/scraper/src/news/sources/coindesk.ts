import { initBrowser, preparePage } from "../../twitter/browser";
import type { NewsArticle } from "../types";
import { BaseNewsSource } from "./base";

const PAGE_LOAD_TIMEOUT_MS = 60_000;
const ARTICLE_SELECTOR_TIMEOUT_MS = 20_000;

/**
 * CoinDesk news scraper
 * Scrapes latest crypto news from CoinDesk.com
 */
export class CoinDeskSource extends BaseNewsSource {
  name = "coindesk";
  baseUrl = "https://www.coindesk.com";

  /**
   * Scrape latest articles from CoinDesk
   */
  async scrape(limit = 20): Promise<NewsArticle[]> {
    this.logger.info("Starting CoinDesk scraping", {
      source: this.name,
      limit,
    });

    const browser = await initBrowser();
    const page = await browser.newPage();
    await preparePage(page);

    const articles: NewsArticle[] = [];

    try {
      // Navigate to CoinDesk homepage
      this.logger.debug("Navigating to CoinDesk", { url: this.baseUrl });
      await page.goto(this.baseUrl, {
        waitUntil: "domcontentloaded",
        timeout: PAGE_LOAD_TIMEOUT_MS,
      });

      // Wait for articles to load
      try {
        await page.waitForSelector("article, .article-card, .card", {
          timeout: ARTICLE_SELECTOR_TIMEOUT_MS,
        });
      } catch (error) {
        this.logger.warn("No articles found on page", { error });
        await page.close();
        return [];
      }

      // Extract article links from homepage
      const articleLinks = await page.$$eval(
        "article a[href*='/'], .article-card a[href*='/'], .card a[href*='/']",
        (links) =>
          links
            .map((link) => (link as HTMLAnchorElement).href)
            .filter((href) => {
              if (!href) return false;
              if (href.includes("#")) return false;
              if (href.includes("mailto:")) return false;
              if (href.includes("/author/")) return false;
              if (href.includes("/tag/")) return false;

              return (
                href.includes("/news/") ||
                href.includes("/markets/") ||
                href.includes("/policy/") ||
                href.includes("/tech/") ||
                href.includes("/business/")
              );
            })
      );

      this.logger.info("Found article links on homepage", {
        count: articleLinks.length,
      });

      // Deduplicate links
      const uniqueLinks = Array.from(new Set(articleLinks)).slice(0, limit);

      // Scrape each article
      for (const articleUrl of uniqueLinks) {
        try {
          const article = await this.scrapeArticle(page, articleUrl);
          if (article) {
            articles.push(article);
            this.logger.debug("Scraped article", {
              title: article.title.substring(0, 60),
              url: articleUrl,
            });
          }
        } catch (error) {
          this.logger.error("Failed to scrape article", {
            url: articleUrl,
            error,
          });
        }

        // Small delay between articles
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      this.logger.info("CoinDesk scraping completed", {
        articlesScraped: articles.length,
        target: limit,
      });
    } catch (error) {
      this.logger.error("CoinDesk scraping failed", { error });
    } finally {
      await page.close();
    }

    return articles;
  }

  /**
   * Scrape individual article content
   */
  private async scrapeArticle(
    page: ReturnType<Awaited<ReturnType<typeof initBrowser>>["newPage"]>,
    url: string
  ): Promise<NewsArticle | null> {
    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: PAGE_LOAD_TIMEOUT_MS,
      });

      // Wait for article content to load
      await page.waitForSelector("article, .article-content, .content-body", {
        timeout: ARTICLE_SELECTOR_TIMEOUT_MS,
      });

      // Extract article data
      const articleData = await page.evaluate(() => {
        // Title
        const titleEl =
          document.querySelector("h1") ||
          document.querySelector(".article-title") ||
          document.querySelector('[data-testid="headline"]');
        const title = titleEl?.textContent?.trim() || "";

        // Content - try multiple selectors
        const contentEl =
          document.querySelector(".article-content") ||
          document.querySelector(".content-body") ||
          document.querySelector('[data-testid="article-body"]') ||
          document.querySelector("article");

        const content =
          contentEl?.textContent
            ?.trim()
            .replace(/\s+/g, " ")
            .substring(0, 5000) || ""; // Limit content length

        // Author
        const authorEl =
          document.querySelector('[rel="author"]') ||
          document.querySelector(".author-name") ||
          document.querySelector('[data-testid="author-name"]');
        const author = authorEl?.textContent?.trim() || null;

        // Published date
        const timeEl = document.querySelector("time");
        const publishedAt = timeEl?.getAttribute("datetime") || null;

        // Image
        const imgEl =
          document.querySelector("article img") ||
          document.querySelector(".article-image img");
        const imageUrl = imgEl?.getAttribute("src") || null;

        // Tags/Categories
        const tagElements = document.querySelectorAll(
          ".tag, .category, [data-testid='tag']"
        );
        const tags = Array.from(tagElements).map((el) =>
          el.textContent?.trim().toLowerCase()
        );

        return {
          title,
          content,
          author,
          publishedAt,
          imageUrl,
          tags: tags.filter(Boolean) as string[],
        };
      });

      if (!articleData.title) {
        this.logger.warn("Article missing title", { url });
        return null;
      }

      if (!articleData.content) {
        this.logger.warn("Article missing content", { url });
        return null;
      }

      // Parse published date
      const publishedAt = articleData.publishedAt
        ? new Date(articleData.publishedAt)
        : new Date();

      // Extract symbols and categories
      const fullText = `${articleData.title} ${articleData.content}`;
      const symbols = this.extractSymbols(fullText);
      const categories = this.extractCategories(fullText, articleData.tags);

      // Create article object
      const article: NewsArticle = {
        id: this.generateArticleId(url, publishedAt),
        title: this.cleanText(articleData.title),
        content: this.cleanText(articleData.content),
        source: this.name,
        author: articleData.author || undefined,
        url,
        publishedAt,
        scrapedAt: new Date(),
        symbols,
        categories,
        imageUrl: articleData.imageUrl || undefined,
      };

      return article;
    } catch (error) {
      this.logger.error("Failed to extract article data", { url, error });
      return null;
    }
  }
}
