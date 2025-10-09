import { getLogger } from "@aladdin/logger";
import { initBrowser, preparePage } from "./browser.js";
import type { Tweet } from "./types.js";
import { autoScroll, scrollUntilEnough } from "./utils.js";

const logger = getLogger("twity");

const PAGE_LOAD_TIMEOUT_MS = 60_000;
const ARTICLE_SELECTOR_TIMEOUT_MS = 20_000;
const AUTO_SCROLL_ITERATIONS = 8;
const SCROLL_DELAY_MS = 800;
const MAX_USER_SCROLLS = 20;
const LARGE_EXTRACTION_LIMIT = 100;

function extractTweets(articles: Element[], limit: number): Tweet[] {
  const arr: Tweet[] = [];
  for (const art of articles.slice(0, limit)) {
    const textEl = art.querySelector(
      'div[data-testid="tweetText"], div[lang]'
    ) as HTMLElement | null;
    const timeEl = art.querySelector("time") as HTMLTimeElement | null;
    if (!textEl) continue;

    const anchor = timeEl?.parentElement as HTMLAnchorElement | null;
    let url: string | null = anchor?.getAttribute("href") ?? null;
    if (url?.startsWith("/")) {
      url = `https://twitter.com${url}`;
    }
    const id = url?.split("/").pop() ?? null;

    const userAnchor = art.querySelector(
      'div[data-testid="User-Name"], div[data-testid="User-Names"]'
    ) as HTMLElement | null;

    let username: string | null = null;
    let displayName: string | null = null;
    if (userAnchor) {
      const anchorEl =
        (userAnchor.querySelector('a[href^="/"]') as HTMLAnchorElement) ||
        (userAnchor as HTMLAnchorElement);
      const href = anchorEl?.getAttribute?.("href");
      if (href) {
        const parts = href.split("/").filter(Boolean);
        username = parts.length > 0 ? parts[0] : null;
      }
      const span = userAnchor.querySelector("span");
      displayName = span?.textContent?.trim() ?? null;
    }

    function getCount(testId: string): number {
      const el = art.querySelector(
        `div[data-testid="${testId}"] span`
      ) as HTMLElement | null;
      if (!el) return 0;
      const num = (el.textContent ?? "").replace(/[^0-9]/g, "");
      return num ? Number.parseInt(num, 10) : 0;
    }

    const replies = getCount("reply");
    const retweets = getCount("retweet");
    const likes = getCount("like");

    arr.push({
      text: textEl.textContent?.trim() ?? "",
      datetime: timeEl ? timeEl.getAttribute("datetime") : null,
      url,
      id,
      username,
      displayName,
      replies,
      retweets,
      likes,
    });
  }
  return arr;
}

export async function scrapeTweetsBySearch(
  query: string,
  limit = 20
): Promise<Tweet[]> {
  const url = `https://twitter.com/search?q=${encodeURIComponent(
    query
  )}&src=typed_query&f=live`;

  logger.info("Starting tweet search", { query, limit, url });

  const startTime = Date.now();
  const br = await initBrowser();
  const page = await br.newPage();
  await preparePage(page);

  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: PAGE_LOAD_TIMEOUT_MS,
    });

    logger.debug("Search page loaded", {
      query,
      timeMs: Date.now() - startTime,
    });

    try {
      await page.waitForSelector("article", {
        timeout: ARTICLE_SELECTOR_TIMEOUT_MS,
      });
      logger.debug("Tweets found on search page", { query });
    } catch (error) {
      logger.warn("No tweets found initially, scrolling", { query, error });
      await autoScroll(page, AUTO_SCROLL_ITERATIONS);
    }

    logger.debug("Scrolling to load enough tweets", { query, target: limit });
    await scrollUntilEnough(page, limit);

    const rawTweets = (await page.$$eval(
      "article",
      extractTweets,
      limit
    )) as Tweet[];

    logger.debug("Tweets extracted from DOM", {
      query,
      extracted: rawTweets.length,
    });

    rawTweets.sort(
      (a, b) =>
        new Date(b.datetime || 0).getTime() -
        new Date(a.datetime || 0).getTime()
    );

    const result = rawTweets.slice(0, limit);
    const duration = Date.now() - startTime;

    logger.info("Tweet search completed successfully", {
      query,
      found: result.length,
      totalExtracted: rawTweets.length,
      durationMs: duration,
      avgLikes:
        result.length > 0
          ? Math.round(
              result.reduce((sum, t) => sum + t.likes, 0) / result.length
            )
          : 0,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("Tweet search failed", {
      query,
      error,
      durationMs: duration,
    });
    throw error;
  } finally {
    await page.close();
    logger.debug("Page closed", { query });
  }
}

export async function scrapeTweetsByUser(
  username: string,
  limit = 20
): Promise<Tweet[]> {
  const url = `https://twitter.com/${username}`;

  logger.info("Starting user tweets scrape", { username, limit, url });

  const startTime = Date.now();
  const br = await initBrowser();
  const page = await br.newPage();
  await preparePage(page);

  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: PAGE_LOAD_TIMEOUT_MS,
    });

    logger.debug("User page loaded", {
      username,
      timeMs: Date.now() - startTime,
    });

    try {
      await page.waitForSelector("article", {
        timeout: ARTICLE_SELECTOR_TIMEOUT_MS,
      });
      logger.debug("User tweets found", { username });
    } catch (error) {
      logger.warn("No tweets found for user", { username, error });
    }

    const tweets: Tweet[] = [];
    const seen = new Set<string>();

    logger.debug("Starting scroll iterations", {
      username,
      maxScrolls: MAX_USER_SCROLLS,
      target: limit,
    });

    for (let i = 0; i < MAX_USER_SCROLLS && tweets.length < limit; i++) {
      const chunk = (await page.$$eval(
        "article",
        extractTweets,
        LARGE_EXTRACTION_LIMIT
      )) as Tweet[];

      let newTweets = 0;
      for (const t of chunk) {
        if (t.datetime && !seen.has(t.datetime)) {
          seen.add(t.datetime);
          tweets.push(t);
          newTweets++;
        }
      }

      logger.debug("Scroll iteration completed", {
        username,
        iteration: i + 1,
        newTweets,
        totalTweets: tweets.length,
      });

      if (tweets.length >= limit) {
        logger.debug("Target reached, stopping scroll", {
          username,
          tweets: tweets.length,
        });
        break;
      }

      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });
      await new Promise((r) => setTimeout(r, SCROLL_DELAY_MS));
    }

    tweets.sort(
      (a, b) =>
        new Date(b.datetime || 0).getTime() -
        new Date(a.datetime || 0).getTime()
    );

    const result = tweets.slice(0, limit);
    const duration = Date.now() - startTime;

    logger.info("User tweets scrape completed successfully", {
      username,
      found: result.length,
      totalExtracted: tweets.length,
      durationMs: duration,
      avgEngagement:
        result.length > 0
          ? Math.round(
              result.reduce((sum, t) => sum + t.likes + t.retweets, 0) /
                result.length
            )
          : 0,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("User tweets scrape failed", {
      username,
      error,
      durationMs: duration,
    });
    throw error;
  } finally {
    await page.close();
    logger.debug("Page closed", { username });
  }
}
