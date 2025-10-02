import type { Page } from "puppeteer";

const DELAY_MS = 1000;
const SCROLL_DELAY_MS = 800;
const LOGIN_PATTERN = /\/login|\/flow\/login/;

export function delay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

export async function autoScroll(page: Page, maxScroll = 5): Promise<void> {
  for (let i = 0; i < maxScroll; i++) {
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight);
    });
    await delay(DELAY_MS);
  }
}

export async function scrollUntilEnough(
  page: Page,
  limit: number,
  maxScrolls = 15
): Promise<void> {
  for (let i = 0; i < maxScrolls; i++) {
    const count = await page.$$eval("article", (els) => els.length);
    if (count >= limit) break;
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight);
    });
    await delay(SCROLL_DELAY_MS);
  }
}

export function isLoggedUrl(url: string): boolean {
  return !LOGIN_PATTERN.test(url);
}
