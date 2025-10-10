import { getLogger } from "@aladdin/logger";
import type { Page } from "puppeteer";
import { initBrowser, preparePage } from "../twitter/browser";
import type { RedditComment, RedditPost, RedditSearchResult } from "./types";

const logger = getLogger("reddit-scraper");

const PAGE_LOAD_TIMEOUT_MS = 60_000;
const POST_SELECTOR_TIMEOUT_MS = 20_000;
const AUTO_SCROLL_ITERATIONS = 5;
const SCROLL_DELAY_MS = 1000;

const REDDIT_BASE_URL = "https://www.reddit.com";
const DEFAULT_USER_AGENT =
  process.env.USER_AGENT ||
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Regex patterns (defined at module level for performance)
const POST_ID_MATCH_REGEX = /\/comments\/([a-z0-9]+)\//;

const POST_SELECTOR = 'div[data-testid="post-container"], shreddit-post';

async function extractPostsFromPage(page: Page): Promise<RedditPost[]> {
  const extractionScript = `
    const POST_SELECTOR = ${JSON.stringify(POST_SELECTOR)};
    const SUBREDDIT_REGEX = /\\/r\\/([^/]+)/i;
    const POST_ID_REGEX = /\\/comments\\/([a-z0-9]+)\\//i;
    const NON_DIGIT_REGEX = /[^0-9]/g;

    function normalizeNumber(value) {
      if (!value) return 0;
      const trimmed = value.trim().toLowerCase();
      if (!trimmed) return 0;
      const digits = trimmed.replace(/[^0-9.]/g, "");
      if (!digits) return 0;
      if (trimmed.indexOf("m") >= 0) {
        const num = parseFloat(digits);
        return Number.isNaN(num) ? 0 : Math.round(num * 1000000);
      }
      if (trimmed.indexOf("k") >= 0) {
        const num = parseFloat(digits);
        return Number.isNaN(num) ? 0 : Math.round(num * 1000);
      }
      const parsed = parseInt(digits, 10);
      return Number.isNaN(parsed) ? 0 : parsed;
    }

    function getSlotElements(host, slotName) {
      if (!host.shadowRoot) return [];
      const slot = host.shadowRoot.querySelector('slot[name="' + slotName + '"]');
      if (!slot || typeof slot.assignedElements !== "function") return [];
      return slot.assignedElements({ flatten: true });
    }

    function getSlotText(host, slotName) {
      const nodes = getSlotElements(host, slotName);
      for (const node of nodes) {
        const text = node.textContent
          ? node.textContent.replace(/\\s+/g, " ").trim()
          : "";
        if (text) return text;
      }
      return "";
    }

    function getSlotAttribute(host, slotName, attribute) {
      const nodes = getSlotElements(host, slotName);
      for (const node of nodes) {
        if (node instanceof HTMLElement) {
          const value = node.getAttribute(attribute);
          if (value) return value;
        }
      }
      return "";
    }

    function extractFromShredditPost(element) {
      function attr(name) {
        const value = element.getAttribute(name);
        return value === null ? "" : value;
      }

      const title = attr("post-title") || getSlotText(element, "title") || "";
      if (!title) return null;

      const permalink =
        attr("content-href") ||
        attr("permalink") ||
        getSlotAttribute(element, "title", "href") ||
        "";

      const url = permalink
        ? permalink.startsWith("http")
          ? permalink
          : "https://www.reddit.com" + permalink
        : "";

      let id = attr("id") || "";
      if (id.startsWith("t3_")) {
        id = id.slice(3);
      }
      if (!id && permalink) {
        const idMatch = permalink.match(POST_ID_REGEX);
        if (idMatch && idMatch[1]) {
          id = idMatch[1];
        }
      }
      if (!id) return null;

      const createdAttr = attr("created-timestamp");
      let created = Math.floor(Date.now() / 1000);
      if (createdAttr) {
        const ts = Date.parse(createdAttr);
        if (!Number.isNaN(ts)) {
          created = Math.floor(ts / 1000);
        }
      }

      const score = normalizeNumber(attr("score"));
      const numComments = normalizeNumber(attr("comment-count"));

      const subredditAttr =
        attr("subreddit-name") || attr("subreddit-prefixed-name");
      let subreddit = "unknown";
      if (subredditAttr) {
        subreddit = subredditAttr.replace(/^r\\//i, "");
      } else if (url) {
        const match = url.match(SUBREDDIT_REGEX);
        if (match && match[1]) {
          subreddit = match[1];
        }
      }

      const author =
        attr("author") || getSlotText(element, "credit-bar") || "unknown";
      const text = getSlotText(element, "text-body") || "";
      const flairText = getSlotText(element, "post-flair");

      const itemState = (attr("item-state") || "").toLowerCase();
      const isStickied =
        element.hasAttribute("highlighted") || itemState.indexOf("stickied") >= 0;
      const isLocked = itemState.indexOf("locked") >= 0;

      return {
        id,
        title,
        text,
        author,
        subreddit,
        score,
        upvoteRatio: 0.5,
        numComments,
        created,
        url,
        flair: flairText || null,
        isStickied,
        isLocked,
      };
    }

    function extractFromLegacyPost(element) {
      const titleEl = element.querySelector(
        'h3, [data-click-id="body"] h3, a[data-click-id="body"]'
      );
      const title = titleEl && titleEl.textContent
        ? titleEl.textContent.trim()
        : "";
      if (!title) return null;

      const authorEl = element.querySelector(
        'a[href*="/user/"], [data-click-id="user"]'
      );
      const author =
        authorEl && authorEl.textContent ? authorEl.textContent.trim() : "unknown";

      const subredditEl = element.querySelector('a[href*="/r/"]');
      let subreddit = "unknown";
      if (subredditEl) {
        const href = subredditEl.getAttribute("href") || "";
        const match = href.match(SUBREDDIT_REGEX);
        if (match && match[1]) {
          subreddit = match[1];
        }
      }

      const postLink = element.querySelector('a[data-click-id="body"]');
      const url = postLink?.getAttribute("href") || "";
      const fullUrl = url.startsWith("http") ? url : "https://reddit.com" + url;

      const idMatch = url.match(POST_ID_REGEX);
      const id = idMatch && idMatch[1] ? idMatch[1] : "";
      if (!id) return null;

      const scoreEl =
        element.querySelector('[id^="vote-arrows"] span') ||
        element.querySelector('[slot="vote-count"]') ||
        element.querySelector("faceplate-number");
      const scoreText =
        scoreEl && scoreEl.textContent ? scoreEl.textContent.trim() : "0";
      const score = scoreText.indexOf("k") >= 0
        ? parseFloat(scoreText) * 1000
        : parseInt(scoreText, 10) || 0;

      const commentsEl = element.querySelector('a[href*="/comments/"] span');
      const commentsText =
        commentsEl && commentsEl.textContent ? commentsEl.textContent.trim() : "0";
      const numComments =
        parseInt(commentsText.replace(NON_DIGIT_REGEX, ""), 10) || 0;

      const textEl = element.querySelector('[data-click-id="text"]');
      const text =
        textEl && textEl.textContent ? textEl.textContent.trim() : "";

      const timeEl = element.querySelector("time");
      const datetime = timeEl?.getAttribute("datetime") || "";
      const created = datetime
        ? Math.floor(new Date(datetime).getTime() / 1000)
        : Math.floor(Date.now() / 1000);

      const flairEl = element.querySelector('[data-testid="post-flair"]');
      const flair =
        flairEl && flairEl.textContent ? flairEl.textContent.trim() : null;

      const className = element.className || "";
      const isStickied =
        element.getAttribute("data-stickied") === "true" ||
        className.indexOf("pinned") >= 0;
      const isLocked =
        element.getAttribute("data-locked") === "true" ||
        className.indexOf("locked") >= 0;

      return {
        id,
        title,
        text,
        author,
        subreddit,
        score,
        upvoteRatio: 0.5,
        numComments,
        created,
        url: fullUrl,
        flair,
        isStickied,
        isLocked,
      };
    }

    const elements = Array.from(document.querySelectorAll(POST_SELECTOR));
    const parsed = [];

    for (const element of elements) {
      const tagName = element.tagName ? element.tagName.toLowerCase() : "";
      let post = null;

      if (tagName === "shreddit-post") {
        post = extractFromShredditPost(element);
      } else {
        post = extractFromLegacyPost(element);
      }

      if (post) {
        parsed.push(post);
      }
    }

    return parsed;
  `;

  const extractor = Function(extractionScript) as () => unknown;
  const posts = (await page.evaluate(extractor)) as RedditPost[];

  return posts;
}

type RedditApiChild = {
  data?: Record<string, unknown>;
};

type RedditApiListing = {
  data?: {
    children?: RedditApiChild[];
  };
};

function mapJsonPostToRedditPost(data: Record<string, unknown>): RedditPost | null {
  const rawId = typeof data.id === "string" ? data.id : "";
  const name = typeof data.name === "string" ? data.name : "";
  const id =
    rawId || (typeof name === "string" && name.startsWith("t3_")
      ? name.slice(3)
      : "");
  const title = typeof data.title === "string" ? data.title : "";

  if (!id || !title) {
    return null;
  }

  const text = typeof data.selftext === "string" ? data.selftext : "";
  const author = typeof data.author === "string" ? data.author : "unknown";

  const subreddit =
    typeof data.subreddit === "string"
      ? data.subreddit
      : typeof data.subreddit_name_prefixed === "string"
      ? data.subreddit_name_prefixed.replace(/^r\//i, "")
      : "unknown";

  const score =
    typeof data.score === "number"
      ? data.score
      : Number(data.score) || 0;

  const upvoteRatio =
    typeof data.upvote_ratio === "number"
      ? Math.max(0, Math.min(1, data.upvote_ratio))
      : 0.5;

  const numComments =
    typeof data.num_comments === "number"
      ? data.num_comments
      : Number(data.num_comments) || 0;

  const createdUtc =
    typeof data.created_utc === "number"
      ? data.created_utc
      : Number(data.created_utc) || Math.floor(Date.now() / 1000);

  const permalink =
    typeof data.permalink === "string" ? data.permalink : "";
  const url =
    typeof data.url === "string" && data.url
      ? data.url
      : permalink
      ? `${REDDIT_BASE_URL}${permalink}`
      : "";

  const flair =
    typeof data.link_flair_text === "string" && data.link_flair_text
      ? data.link_flair_text
      : null;

  const isStickied = Boolean(data.stickied);
  const isLocked = Boolean(data.locked);

  return {
    id,
    title,
    text,
    author,
    subreddit,
    score,
    upvoteRatio,
    numComments,
    created: Math.floor(createdUtc),
    url,
    flair,
    isStickied,
    isLocked,
  };
}

async function fetchSearchResultsFromApi(
  query: string,
  limit: number,
  sortBy: "relevance" | "hot" | "top" | "new" | "comments"
): Promise<RedditPost[] | null> {
  try {
    const startTime = Date.now();
    const params = new URLSearchParams({
      q: query,
      sort: sortBy,
      type: "link",
      limit: String(Math.min(limit * 2, 100)),
    });

    const response = await fetch(`${REDDIT_BASE_URL}/search.json?${params.toString()}`, {
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      logger.warn("Reddit search API request failed", {
        query,
        status: response.status,
        durationMs: Date.now() - startTime,
      });
      return null;
    }

    const json = (await response.json()) as RedditApiListing;
    const children = json?.data?.children ?? [];
    if (children.length === 0) {
      logger.debug("Reddit search API returned empty list", {
        query,
        sortBy,
        durationMs: Date.now() - startTime,
      });
      return [];
    }

    const posts: RedditPost[] = [];
    for (const child of children) {
      const rawData = child?.data;
      if (!rawData) continue;
      const post = mapJsonPostToRedditPost(rawData);
      if (post) {
        posts.push(post);
      }
    }

    logger.debug("Reddit search API parsed posts", {
      query,
      sortBy,
      received: children.length,
      parsed: posts.length,
      durationMs: Date.now() - startTime,
    });

    if (posts.length === 0) {
      logger.warn("Reddit search API produced no parsable posts", {
        query,
        sortBy,
        children: children.length,
      });
    }

    posts.sort((a, b) => b.score - a.score);

    return posts;
  } catch (error) {
    logger.warn("Reddit search API fetch failed", { query, error });
    return null;
  }
}

/**
 * Scrape Reddit posts by search query
 */
export async function scrapeRedditBySearch(
  query: string,
  limit = 25,
  sortBy: "relevance" | "hot" | "top" | "new" | "comments" = "relevance"
): Promise<RedditSearchResult> {
  const url = `https://www.reddit.com/search/?q=${encodeURIComponent(
    query
  )}&sort=${sortBy}`;

  logger.info("Starting Reddit search", { query, limit, sortBy, url });

  const startTime = Date.now();

  const apiPosts = await fetchSearchResultsFromApi(query, limit, sortBy);
  if (apiPosts !== null) {
    const posts = apiPosts.slice(0, limit);
    const duration = Date.now() - startTime;

    logger.info("Reddit search completed successfully", {
      query,
      found: posts.length,
      totalExtracted: apiPosts.length,
      durationMs: duration,
      source: "api",
    });

    return {
      posts,
      totalFound: apiPosts.length,
      searchQuery: query,
      timestamp: Date.now(),
    };
  }

  const br = await initBrowser();
  const page = await br.newPage();
  await preparePage(page);

  logger.debug("Browser and page initialized", {
    query,
    timeMs: Date.now() - startTime,
  });

  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: PAGE_LOAD_TIMEOUT_MS,
    });

    logger.debug("Page loaded", {
      query,
      timeMs: Date.now() - startTime,
    });

    try {
      // Wait for posts to load
      await page.waitForSelector(POST_SELECTOR, {
        timeout: POST_SELECTOR_TIMEOUT_MS,
      });
      logger.debug("Posts container found", { query });
    } catch (error) {
      logger.warn("No posts found initially", { query, error });
    }

    // Scroll to load more posts
    logger.debug("Starting scroll to load more posts", {
      query,
      iterations: AUTO_SCROLL_ITERATIONS,
    });

    for (let i = 0; i < AUTO_SCROLL_ITERATIONS; i++) {
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });
      await new Promise((r) => setTimeout(r, SCROLL_DELAY_MS));
    }

    logger.debug("Scroll completed", { query });

    // Extract posts
    const posts = await extractPostsFromPage(page);

    logger.debug("Posts extracted from DOM", {
      query,
      extracted: posts.length,
      selector: POST_SELECTOR,
    });

    if (posts.length === 0) {
      logger.warn("Reddit browser scrape produced zero posts", {
        query,
        sortBy,
        url,
      });
    }

    // Sort by score (most upvoted first)
    posts.sort((a, b) => b.score - a.score);

    const result: RedditSearchResult = {
      posts: posts.slice(0, limit),
      totalFound: posts.length,
      searchQuery: query,
      timestamp: Date.now(),
    };

    const duration = Date.now() - startTime;

    logger.info("Reddit search completed successfully", {
      query,
      found: result.posts.length,
      totalExtracted: posts.length,
      durationMs: duration,
      source: "browser",
      avgScorePerPost:
        result.posts.length > 0
          ? Math.round(
              result.posts.reduce((sum, p) => sum + p.score, 0) /
                result.posts.length
            )
          : 0,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("Reddit search failed", {
      query,
      error,
      durationMs: duration,
      source: "browser",
    });
    throw error;
  } finally {
    await page.close();
    logger.debug("Page closed", { query });
  }
}

/**
 * Scrape Reddit posts from a subreddit
 */
export async function scrapeRedditSubreddit(
  subreddit: string,
  limit = 25,
  sortBy: "hot" | "new" | "top" | "rising" = "hot",
  timeFilter?: "hour" | "day" | "week" | "month" | "year" | "all"
): Promise<RedditPost[]> {
  let url = `https://www.reddit.com/r/${subreddit}/${sortBy}/`;
  if (sortBy === "top" && timeFilter) {
    url += `?t=${timeFilter}`;
  }

  logger.info("Starting subreddit scrape", {
    subreddit,
    limit,
    sortBy,
    timeFilter,
    url,
  });

  const startTime = Date.now();
  const br = await initBrowser();
  const page = await br.newPage();
  await preparePage(page);

  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: PAGE_LOAD_TIMEOUT_MS,
    });

    logger.debug("Subreddit page loaded", {
      subreddit,
      timeMs: Date.now() - startTime,
    });

    try {
      await page.waitForSelector(POST_SELECTOR, {
        timeout: POST_SELECTOR_TIMEOUT_MS,
      });
      logger.debug("Posts found", { subreddit });
    } catch (error) {
      logger.warn("No posts found in subreddit", { subreddit, error });
    }

    // Scroll to load more posts
    logger.debug("Scrolling subreddit", {
      subreddit,
      iterations: AUTO_SCROLL_ITERATIONS,
    });

    for (let i = 0; i < AUTO_SCROLL_ITERATIONS; i++) {
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });
      await new Promise((r) => setTimeout(r, SCROLL_DELAY_MS));
    }

    const posts = await extractPostsFromPage(page);

    logger.debug("Posts extracted", {
      subreddit,
      extracted: posts.length,
      selector: POST_SELECTOR,
    });

    if (posts.length === 0) {
      logger.warn("Subreddit scrape returned zero posts", {
        subreddit,
        sortBy,
        url,
      });
    }

    const result = posts.slice(0, limit);
    const duration = Date.now() - startTime;

    logger.info("Subreddit scrape completed successfully", {
      subreddit,
      found: result.length,
      totalExtracted: posts.length,
      durationMs: duration,
      topScore: result.length > 0 ? result[0].score : 0,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("Subreddit scrape failed", {
      subreddit,
      error,
      durationMs: duration,
    });
    throw error;
  } finally {
    await page.close();
    logger.debug("Page closed", { subreddit });
  }
}

async function extractCommentsFromPage(
  page: Page,
  postId: string
): Promise<RedditComment[]> {
  const script = `
    const POST_ID = ${JSON.stringify(postId)};
    const elements = Array.from(
      document.querySelectorAll('shreddit-comment, [data-testid="comment"]')
    );
    const NON_DIGIT_REGEX = /[^0-9]/g;
    const results = [];

    for (const element of elements) {
      const tagName = element.tagName ? element.tagName.toLowerCase() : "";

      if (tagName === "shreddit-comment") {
        const attr = (name) => element.getAttribute(name) || "";

        let id = attr("thingid") || "";
        if (id.startsWith("t1_")) {
          id = id.slice(3);
        }

        const commentSlot = element.shadowRoot
          ? element.shadowRoot.querySelector('slot[name="comment"]')
          : null;

        let text = "";
        if (commentSlot && typeof commentSlot.assignedElements === "function") {
          const assigned = commentSlot.assignedElements({ flatten: true });
          for (const node of assigned) {
            if (!node || !node.textContent) continue;
            const value = node.textContent.replace(/\\s+/g, " ").trim();
            if (value) {
              text = value;
              break;
            }
          }
        }

        if (!id || !text) {
          continue;
        }

        const author = attr("author") || "unknown";
        const score = parseInt(attr("score") || "0", 10) || 0;
        const depth = parseInt(attr("depth") || "0", 10) || 0;

        let created = Date.now() / 1000;
        const metaSlot = element.shadowRoot
          ? element.shadowRoot.querySelector('slot[name="commentMeta"]')
          : null;
        if (metaSlot && typeof metaSlot.assignedElements === "function") {
          const assignedMeta = metaSlot.assignedElements({ flatten: true });
          for (const node of assignedMeta) {
            const timeEl = node.querySelector ? node.querySelector("time") : null;
            const datetime = timeEl ? timeEl.getAttribute("datetime") : null;
            if (datetime) {
              const ts = Date.parse(datetime);
              if (!Number.isNaN(ts)) {
                created = ts / 1000;
                break;
              }
            }
          }
        }

        results.push({
          id,
          author,
          text,
          score,
          created: Math.floor(created),
          postId: POST_ID,
          depth,
          isSubmitter: false,
        });
        continue;
      }

      const id = element.getAttribute("id") || "";
      const textEl = element.querySelector('[data-testid="comment"] p, .md');
      const text =
        textEl && textEl.textContent
          ? textEl.textContent.replace(/\\s+/g, " ").trim()
          : "";

      if (!id || !text) {
        continue;
      }

      const authorEl = element.querySelector(
        'a[href*="/user/"], [data-click-id="user"]'
      );
      const author =
        authorEl && authorEl.textContent
          ? authorEl.textContent.trim()
          : "unknown";

      const scoreEl =
        element.querySelector('[id^="vote-arrows"] span') ||
        element.querySelector("faceplate-number");
      const scoreText =
        scoreEl && scoreEl.textContent ? scoreEl.textContent.trim() : "0";
      const score =
        scoreText.indexOf("k") >= 0
          ? parseFloat(scoreText) * 1000
          : parseInt(scoreText, 10) || 0;

      const timeEl = element.querySelector("time");
      const datetime = timeEl ? timeEl.getAttribute("datetime") : "";
      const created = datetime
        ? Math.floor(new Date(datetime).getTime() / 1000)
        : Math.floor(Date.now() / 1000);

      const depthMatch = (element.className || "").match(/depth-(\\d+)/);
      const depth =
        depthMatch && depthMatch[1] ? parseInt(depthMatch[1], 10) : 0;

      results.push({
        id,
        author,
        text,
        score,
        created,
        postId: POST_ID,
        depth,
        isSubmitter: false,
      });
    }

    return results;
  `;

  const extractor = Function(script) as () => unknown;
  return (await page.evaluate(extractor)) as RedditComment[];
}

/**
 * Scrape comments from a Reddit post
 */
export async function scrapeRedditComments(
  postUrl: string,
  limit = 50
): Promise<RedditComment[]> {
  logger.info("Starting comment scrape", { postUrl, limit });

  // Extract post ID from URL
  const postIdMatch = postUrl.match(POST_ID_MATCH_REGEX);
  const postId = postIdMatch?.[1] || "";

  if (!postId) {
    logger.error("Invalid post URL", { postUrl });
    return [];
  }

  const br = await initBrowser();
  const page = await br.newPage();
  await preparePage(page);

  await page.goto(postUrl, {
    waitUntil: "domcontentloaded",
    timeout: PAGE_LOAD_TIMEOUT_MS,
  });

  try {
    await page.waitForSelector('shreddit-comment, [data-testid="comment"]', {
      timeout: POST_SELECTOR_TIMEOUT_MS,
    });
  } catch (error) {
    logger.debug("No comments found", { postUrl, error });
    await page.close();
    return [];
  }

  // Scroll to load more comments
  for (let i = 0; i < AUTO_SCROLL_ITERATIONS; i++) {
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight);
    });
    await new Promise((r) => setTimeout(r, SCROLL_DELAY_MS));
  }

  const comments = await extractCommentsFromPage(page, postId);

  await page.close();

  logger.info("Comment scrape completed", {
    postUrl,
    found: comments.length,
  });

  if (comments.length === 0) {
    logger.warn("Comment scrape returned zero comments", {
      postUrl,
      postId,
    });
  }

  return comments.slice(0, limit);
}
