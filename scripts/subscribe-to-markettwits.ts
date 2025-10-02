#!/usr/bin/env bun

/**
 * Скрипт для подписки telega на канал markettwits
 *
 * Использование:
 * bun scripts/subscribe-to-markettwits.ts
 */

const TELEGA_URL = process.env.TELEGA_URL || "http://localhost:3005";
const MARKETTWITS_CHANNEL = "@markettwits";

async function subscribeToMarketTwits(): Promise<void> {
  try {
    console.log("Подписываемся на канал:", MARKETTWITS_CHANNEL);
    console.log("Telega URL:", TELEGA_URL);

    const response = await fetch(`${TELEGA_URL}/channels/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channelId: MARKETTWITS_CHANNEL,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to subscribe: ${response.status} ${response.statusText}\n${errorText}`
      );
    }

    const result = await response.json();
    console.log("✅ Успешно подписались на канал:", result);
  } catch (error) {
    console.error("❌ Ошибка при подписке:", error);
    process.exit(1);
  }
}

async function checkSubscriptions(): Promise<void> {
  try {
    console.log("\nПроверяем список подписок...");

    const response = await fetch(`${TELEGA_URL}/channels`);

    if (!response.ok) {
      throw new Error(`Failed to fetch subscriptions: ${response.statusText}`);
    }

    const result = await response.json();
    console.log("\nТекущие подписки:");
    console.log(`Всего: ${result.total}`);
    console.log(`Активных: ${result.active}`);
    console.log("\nСписок каналов:");
    for (const sub of result.subscriptions as Array<{
      channelId: string;
      active: boolean;
      addedAt: string;
    }>) {
      console.log(`  - ${sub.channelId} (активен: ${sub.active})`);
    }
  } catch (error) {
    console.error("Ошибка при проверке подписок:", error);
  }
}

// Main
console.log("=== Подписка на канал MarketTwits ===\n");

subscribeToMarketTwits()
  .then(() => checkSubscriptions())
  .then(() => {
    console.log("\n✅ Готово!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Ошибка:", error);
    process.exit(1);
  });
