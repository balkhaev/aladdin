import { getLogger } from "@aladdin/shared/logger";
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

  logger.info("Starting tweet search", { query, limit });

  const br = await initBrowser();
  const page = await br.newPage();
  await preparePage(page);
  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: PAGE_LOAD_TIMEOUT_MS,
  });
  try {
    await page.waitForSelector("article", {
      timeout: ARTICLE_SELECTOR_TIMEOUT_MS,
    });
  } catch (error) {
    logger.debug("No articles found initially, scrolling", { error });
    await autoScroll(page, AUTO_SCROLL_ITERATIONS);
  }

  await scrollUntilEnough(page, limit);

  const rawTweets = (await page.$$eval(
    "article",
    extractTweets,
    limit
  )) as Tweet[];
  await page.close();

  rawTweets.sort(
    (a, b) =>
      new Date(b.datetime || 0).getTime() - new Date(a.datetime || 0).getTime()
  );

  logger.info("Tweet search completed", { query, found: rawTweets.length });

  return rawTweets.slice(0, limit);
}

export async function scrapeTweetsByUser(
  username: string,
  limit = 20
): Promise<Tweet[]> {
  const url = `https://twitter.com/${username}`;

  logger.info("Starting user tweets scrape", { username, limit });

  const br = await initBrowser();
  const page = await br.newPage();
  await preparePage(page);
  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: PAGE_LOAD_TIMEOUT_MS,
  });

  try {
    await page.waitForSelector("article", {
      timeout: ARTICLE_SELECTOR_TIMEOUT_MS,
    });
  } catch (error) {
    logger.debug("No articles found for user", { username, error });
  }

  const tweets: Tweet[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < MAX_USER_SCROLLS && tweets.length < limit; i++) {
    const chunk = (await page.$$eval(
      "article",
      extractTweets,
      LARGE_EXTRACTION_LIMIT
    )) as Tweet[];

    for (const t of chunk) {
      if (t.datetime && !seen.has(t.datetime)) {
        seen.add(t.datetime);
        tweets.push(t);
      }
    }

    if (tweets.length >= limit) break;

    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight);
    });
    await new Promise((r) => setTimeout(r, SCROLL_DELAY_MS));
  }

  await page.close();
  tweets.sort(
    (a, b) =>
      new Date(b.datetime || 0).getTime() - new Date(a.datetime || 0).getTime()
  );

  logger.info("User tweets scrape completed", {
    username,
    found: tweets.length,
  });

  return tweets.slice(0, limit);
}
