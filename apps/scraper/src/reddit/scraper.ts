import { getLogger } from "@aladdin/shared/logger";
import { initBrowser, preparePage } from "../twitter/browser";
import type { RedditComment, RedditPost, RedditSearchResult } from "./types";

const logger = getLogger("reddit-scraper");

const PAGE_LOAD_TIMEOUT_MS = 60_000;
const POST_SELECTOR_TIMEOUT_MS = 20_000;
const AUTO_SCROLL_ITERATIONS = 5;
const SCROLL_DELAY_MS = 1000;

// Regex patterns (defined at module level for performance)
const SUBREDDIT_REGEX = /\/r\/([^/]+)/;
const POST_ID_REGEX = /\/comments\/([a-z0-9]+)\//;
const POST_ID_MATCH_REGEX = /\/comments\/([a-z0-9]+)\//;
const DEPTH_CLASS_REGEX = /depth-(\d+)/;
const NON_DIGIT_REGEX = /[^0-9]/g;

/**
 * Extract Reddit posts from DOM
 */
function extractRedditPosts(elements: Element[]): RedditPost[] {
  const posts: RedditPost[] = [];

  for (const el of elements) {
    const post = extractSinglePost(el);
    if (post) {
      posts.push(post);
    }
  }

  return posts;
}

/**
 * Extract a single post from element (helper to reduce complexity)
 */
function extractSinglePost(el: Element): RedditPost | null {
  try {
    // Title
    const titleEl = el.querySelector(
      'h3, [data-click-id="body"] h3, a[data-click-id="body"]'
    );
    const title = titleEl?.textContent?.trim() || "";

    // Author
    const authorEl = el.querySelector(
      'a[href*="/user/"], [data-click-id="user"]'
    );
    const author = authorEl?.textContent?.trim() || "unknown";

    // Subreddit
    const subredditEl = el.querySelector('a[href*="/r/"]');
    const subredditMatch = subredditEl?.getAttribute("href")?.match(SUBREDDIT_REGEX);
    const subreddit = subredditMatch?.[1] || "unknown";

    // Post URL
    const postLink = el.querySelector('a[data-click-id="body"]');
    const url = postLink?.getAttribute("href") || "";
    const fullUrl = url.startsWith("http") ? url : `https://reddit.com${url}`;

    // Post ID from URL
    const idMatch = url.match(POST_ID_REGEX);
    const id = idMatch?.[1] || "";

    // Score (upvotes)
    const scoreEl = el.querySelector('[id^="vote-arrows"] span');
    const scoreText = scoreEl?.textContent?.trim() || "0";
    const score = scoreText.includes("k")
      ? Number.parseFloat(scoreText) * 1000
      : Number.parseInt(scoreText, 10) || 0;

    // Comments count
    const commentsEl = el.querySelector('a[href*="/comments/"] span');
    const commentsText = commentsEl?.textContent?.trim() || "0";
    const numComments =
      Number.parseInt(commentsText.replace(NON_DIGIT_REGEX, ""), 10) || 0;

    // Text (from preview or post body)
    const textEl = el.querySelector('[data-click-id="text"]');
    const text = textEl?.textContent?.trim() || "";

    // Time
    const timeEl = el.querySelector("time");
    const datetime = timeEl?.getAttribute("datetime") || "";
    const created = datetime
      ? new Date(datetime).getTime() / 1000
      : Date.now() / 1000;

    // Flair
    const flairEl = el.querySelector('[data-testid="post-flair"]');
    const flair = flairEl?.textContent?.trim() || null;

    if (id && title) {
      return {
        id,
        title,
        text,
        author,
        subreddit,
        score,
        upvoteRatio: 0.5, // Can't get from listing page easily
        numComments,
        created: Math.floor(created),
        url: fullUrl,
        flair,
        isStickied: false, // Can add detection if needed
        isLocked: false,
      };
    }

    return null;
  } catch (error) {
    logger.error("Failed to extract Reddit post", { error });
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

  logger.info("Starting Reddit search", { query, limit, sortBy });

  const br = await initBrowser();
  const page = await br.newPage();
  await preparePage(page);

  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: PAGE_LOAD_TIMEOUT_MS,
  });

  try {
    // Wait for posts to load
    await page.waitForSelector('div[data-testid="post-container"]', {
      timeout: POST_SELECTOR_TIMEOUT_MS,
    });
  } catch (error) {
    logger.debug("No posts found initially", { error });
  }

  // Scroll to load more posts
  for (let i = 0; i < AUTO_SCROLL_ITERATIONS; i++) {
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight);
    });
    await new Promise((r) => setTimeout(r, SCROLL_DELAY_MS));
  }

  // Extract posts
  const posts = (await page.$$eval(
    'div[data-testid="post-container"], shreddit-post',
    extractRedditPosts
  )) as RedditPost[];

  await page.close();

  // Sort by score (most upvoted first)
  posts.sort((a, b) => b.score - a.score);

  const result: RedditSearchResult = {
    posts: posts.slice(0, limit),
    totalFound: posts.length,
    searchQuery: query,
    timestamp: Date.now(),
  };

  logger.info("Reddit search completed", {
    query,
    found: result.posts.length,
  });

  return result;
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

  logger.info("Starting subreddit scrape", { subreddit, limit, sortBy });

  const br = await initBrowser();
  const page = await br.newPage();
  await preparePage(page);

  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: PAGE_LOAD_TIMEOUT_MS,
  });

  try {
    await page.waitForSelector('div[data-testid="post-container"]', {
      timeout: POST_SELECTOR_TIMEOUT_MS,
    });
  } catch (error) {
    logger.debug("No posts found in subreddit", { subreddit, error });
  }

  // Scroll to load more posts
  for (let i = 0; i < AUTO_SCROLL_ITERATIONS; i++) {
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight);
    });
    await new Promise((r) => setTimeout(r, SCROLL_DELAY_MS));
  }

  const posts = (await page.$$eval(
    'div[data-testid="post-container"], shreddit-post',
    extractRedditPosts
  )) as RedditPost[];

  await page.close();

  logger.info("Subreddit scrape completed", {
    subreddit,
    found: posts.length,
  });

  return posts.slice(0, limit);
}

/**
 * Extract comments from a Reddit post
 */
function extractComments(elements: Element[], postId: string): RedditComment[] {
  const comments: RedditComment[] = [];

  for (const el of elements) {
    try {
      const id = el.getAttribute("id") || "";
      const author =
        el.querySelector('a[href*="/user/"]')?.textContent?.trim() || "unknown";
      const textEl = el.querySelector('[data-testid="comment"] p, .md');
      const text = textEl?.textContent?.trim() || "";
      const scoreEl = el.querySelector('[id^="vote-arrows"] span');
      const score = Number.parseInt(scoreEl?.textContent?.trim() || "0", 10);

      const timeEl = el.querySelector("time");
      const datetime = timeEl?.getAttribute("datetime") || "";
      const created = datetime
        ? new Date(datetime).getTime() / 1000
        : Date.now() / 1000;

      // Determine depth from indentation or nesting
      const depthMatch = el.className.match(DEPTH_CLASS_REGEX);
      const depth = depthMatch?.[1] ? Number.parseInt(depthMatch[1], 10) : 0;

      if (id && text) {
        comments.push({
          id,
          author,
          text,
          score,
          created: Math.floor(created),
          postId,
          depth,
          isSubmitter: false, // Can detect if needed
        });
      }
    } catch (error) {
      logger.error("Failed to extract comment", { error });
    }
  }

  return comments;
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
    await page.waitForSelector('[data-testid="comment"]', {
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

  const comments = (await page.$$eval(
    'shreddit-comment, [data-testid="comment"]',
    extractComments,
    postId
  )) as RedditComment[];

  await page.close();

  logger.info("Comment scrape completed", {
    postUrl,
    found: comments.length,
  });

  return comments.slice(0, limit);
}

