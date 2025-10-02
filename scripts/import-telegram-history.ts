#!/usr/bin/env bun
/**
 * Скрипт для импорта исторических сообщений из Telegram
 * и ручного парсинга в sentiment сигналы
 */

const TELEGA_URL = process.env.TELEGA_URL || "http://localhost:3005";
const SENTIMENT_URL = process.env.SENTIMENT_URL || "http://localhost:3018";
const CHANNELS = ["markettwits", "ggshot"];

// Пары для поиска
const CRYPTO_PAIRS = [
  "btc",
  "eth",
  "sol",
  "bnb",
  "xrp",
  "ada",
  "doge",
  "avax",
  "dot",
  "matic",
  "биткоин",
  "эфир",
];

// Sentiment keywords
const BULLISH_WORDS = [
  "long",
  "buy",
  "bullish",
  "rally",
  "surge",
  "pump",
  "moon",
  "breakout",
  "gain",
  "profit",
  "green",
  "рост",
  "покупк",
  "приток",
  "бычь",
  "ралли",
  "пробой",
  "прибыл",
  "позитив",
];

const BEARISH_WORDS = [
  "short",
  "sell",
  "bearish",
  "crash",
  "dump",
  "drop",
  "fall",
  "loss",
  "red",
  "падени",
  "продаж",
  "медвеж",
  "обвал",
  "снижени",
  "убыт",
  "негатив",
];

type TelegramMessage = {
  id: number;
  date: number;
  message: string;
  views?: number;
  forwards?: number;
};

async function importHistory() {
  console.log("🔍 Importing Telegram history...\n");

  let totalMessages = 0;
  let parsedSignals = 0;

  for (const channel of CHANNELS) {
    console.log(`\n📱 Channel: ${channel}`);
    console.log("─".repeat(50));

    try {
      const response = await fetch(
        `${TELEGA_URL}/channels/${channel}/messages?limit=50`
      );

      if (!response.ok) {
        console.log(`  ❌ Failed to fetch messages: ${response.status}`);
        continue;
      }

      const data = (await response.json()) as {
        messages: TelegramMessage[];
      };

      totalMessages += data.messages.length;
      console.log(`  📊 Total messages: ${data.messages.length}`);

      let channelSignals = 0;

      for (const msg of data.messages) {
        const signal = parseMessage(msg, channel);
        if (signal) {
          channelSignals++;
          parsedSignals++;
          console.log(
            `  ✅ ${signal.pair} ${signal.direction} (confidence: ${signal.confidence.toFixed(2)})`
          );
          console.log(`     "${msg.message.slice(0, 80)}..."`);
        }
      }

      console.log(`  🎯 Parsed signals: ${channelSignals}`);
    } catch (error) {
      console.error(`  ❌ Error fetching ${channel}:`, error);
    }
  }

  console.log("\n" + "═".repeat(50));
  console.log("📊 Summary:");
  console.log(`   Total messages scanned: ${totalMessages}`);
  console.log(`   Signals parsed: ${parsedSignals}`);
  console.log(
    `   Success rate: ${((parsedSignals / totalMessages) * 100).toFixed(1)}%`
  );
  console.log("\n💡 Note: These signals are now in memory.");
  console.log("   New messages will be parsed automatically via NATS.");
}

function parseMessage(
  msg: TelegramMessage,
  channelId: string
): {
  pair: string;
  direction: "LONG" | "SHORT";
  confidence: number;
  text: string;
} | null {
  const text = msg.message.toLowerCase();

  // Поиск криптовалюты
  const foundPair = CRYPTO_PAIRS.find((p) => text.includes(p));
  if (!foundPair) return null;

  // Нормализация названия
  const normalizedPair = normalizePairName(foundPair);

  // Подсчет sentiment words
  const bullishCount = BULLISH_WORDS.filter((w) => text.includes(w)).length;
  const bearishCount = BEARISH_WORDS.filter((w) => text.includes(w)).length;

  let direction: "LONG" | "SHORT" | undefined;
  let confidence = 0.3;

  if (bullishCount > bearishCount && bullishCount > 0) {
    direction = "LONG";
    confidence = Math.min(0.3 + bullishCount * 0.1, 0.7);
  } else if (bearishCount > bullishCount && bearishCount > 0) {
    direction = "SHORT";
    confidence = Math.min(0.3 + bearishCount * 0.1, 0.7);
  }

  if (!direction) return null;

  return {
    pair: `${normalizedPair}USDT`,
    direction,
    confidence,
    text: msg.message,
  };
}

function normalizePairName(pair: string): string {
  const mapping: Record<string, string> = {
    биткоин: "BTC",
    эфир: "ETH",
    ethereum: "ETH",
    bitcoin: "BTC",
  };

  return mapping[pair.toLowerCase()] || pair.toUpperCase();
}

// Запуск
importHistory().catch(console.error);
