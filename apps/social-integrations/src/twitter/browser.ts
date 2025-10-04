import fs from "node:fs/promises";
import path from "node:path";
import { getLogger } from "@aladdin/shared/logger";
import dotenv from "dotenv";
import puppeteer, { type Browser, type Page, type Protocol } from "puppeteer";
import { isLoggedUrl } from "./utils.js";

dotenv.config();

const logger = getLogger("twity");

const COOKIE_EXPIRY_BUFFER_SECONDS = 60;
const LOGIN_TIMEOUT_MS = 60_000;
const LOGIN_NETWORK_IDLE_TIMEOUT_MS = 60_000;
const USERNAME_SELECTOR_TIMEOUT_MS = 30_000;
const PASSWORD_SELECTOR_TIMEOUT_MS = 30_000;
const TYPING_DELAY_MS = 50;

const USER_AGENT =
  process.env.USER_AGENT ||
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const TW_USER =
  process.env.TWITTER_USERNAME ||
  process.env.TW_USERNAME ||
  process.env.USERNAME;
const TW_EMAIL = process.env.TWITTER_EMAIL || process.env.EMAIL;
const TW_PASS = process.env.TWITTER_PASSWORD || process.env.PASSWORD;

let loginDone = false;

const COOKIE_PATH =
  process.env.TWITTER_COOKIE_PATH ||
  path.resolve(process.cwd(), "twitter_cookies.json");

let browser: Browser | null = null;

export async function initBrowser(): Promise<Browser> {
  if (!browser) {
    const isHeadless = process.env.HEADLESS !== "false";
    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
      ],
      headless: isHeadless,
    });
    await loginIfNeeded();
  }
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

export async function preparePage(page: Page): Promise<void> {
  await page.setUserAgent(USER_AGENT);
  await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => false,
    });
  });
}

// ---------- cookie management ----------
async function restoreCookies(page: Page): Promise<boolean> {
  try {
    const data = await fs.readFile(COOKIE_PATH, "utf-8");
    const cookies = JSON.parse(data) as Protocol.Network.Cookie[];
    const SECONDS_PER_MS = 1000;
    const now = Date.now() / SECONDS_PER_MS;
    const validCookies = cookies.filter(
      (c) =>
        !c.expires ||
        c.expires === -1 ||
        c.expires > now + COOKIE_EXPIRY_BUFFER_SECONDS
    );
    if (validCookies.length) {
      await page.setCookie(...validCookies);
      return true;
    }
  } catch (error) {
    logger.debug("Failed to restore cookies", { error });
  }
  return false;
}

async function saveCookies(page: Page): Promise<void> {
  try {
    const cookies = await page.cookies();
    await fs.writeFile(COOKIE_PATH, JSON.stringify(cookies, null, 2));
  } catch (error) {
    logger.error("Failed to save cookies", error);
  }
}
// ---------------------------------------

async function loginIfNeeded(): Promise<void> {
  if (loginDone) return;

  const haveCreds = TW_PASS && (TW_USER || TW_EMAIL);
  const page = await (browser as Browser).newPage();
  await preparePage(page);

  const cookiesRestored = await restoreCookies(page);
  try {
    await page.goto("https://twitter.com/home", {
      waitUntil: "domcontentloaded",
      timeout: LOGIN_TIMEOUT_MS,
    });
    if (cookiesRestored && isLoggedUrl(page.url())) {
      loginDone = true;
      logger.info("Session restored from cookies");
      await page.close();
      return;
    }
  } catch (error) {
    logger.debug("Failed to restore session", { error });
  }

  if (!haveCreds) {
    await page.close();
    logger.warn("No credentials provided and cookies invalid");
    return;
  }

  try {
    await page.goto("https://twitter.com/i/flow/login", {
      waitUntil: "networkidle2",
      timeout: LOGIN_NETWORK_IDLE_TIMEOUT_MS,
    });

    await page.waitForSelector('input[autocomplete="username"]', {
      timeout: USERNAME_SELECTOR_TIMEOUT_MS,
    });
    await page.type(
      'input[autocomplete="username"]',
      TW_USER || TW_EMAIL || "",
      {
        delay: TYPING_DELAY_MS,
      }
    );
    await page.keyboard.press("Enter");

    await page.waitForSelector('input[autocomplete="current-password"]', {
      timeout: PASSWORD_SELECTOR_TIMEOUT_MS,
    });
    await page.type('input[autocomplete="current-password"]', TW_PASS || "", {
      delay: TYPING_DELAY_MS,
    });
    await page.keyboard.press("Enter");

    await page.waitForNavigation({
      waitUntil: "networkidle2",
      timeout: LOGIN_NETWORK_IDLE_TIMEOUT_MS,
    });

    if (isLoggedUrl(page.url())) {
      loginDone = true;
      logger.info("Logged in and saving cookies");
      await saveCookies(page);
    } else {
      logger.warn("Login flow ended without reaching home page");
    }
  } catch (error) {
    logger.error("Twitter login failed", error);
  } finally {
    await page.close();
  }
}
