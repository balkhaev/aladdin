# Social Integrations: Telegram & Twitter

**Статус:** ✅ Production Ready  
**Сервис:** social-integrations (порт 3018)  
**Последнее обновление:** 5 октября 2025

## 🎯 Обзор

Сервис `social-integrations` объединяет анализ социальных данных из Telegram и Twitter для формирования sentiment scores по криптовалютам.

### Архитектура

```
┌─────────────────────┐         ┌──────────────────┐
│  Telegram Channels  │         │  Twitter (15 KOL)│
│  (@markettwits,     │         │  Crypto          │
│   @ggshot)          │         │  Influencers     │
└──────────┬──────────┘         └────────┬─────────┘
           │                             │
           ▼                             ▼
    ┌──────────────┐          ┌──────────────────┐
    │ Telega       │          │ Twity Scraper    │
    │ (MTProto)    │          │ (Puppeteer)      │
    └──────┬───────┘          │ Every 10 min     │
           │                  └────────┬──────────┘
           │ NATS                      │ Store
           │ Real-time                 ▼
           │                  ┌──────────────────┐
           │                  │   ClickHouse     │
           │                  │  twitter_tweets  │
           │                  └────────┬──────────┘
           │                           │ Read
           └────────┬──────────────────┘
                    ▼
         ┌──────────────────────┐
         │  Social Integrations │
         │  (Sentiment Service) │
         │  - TelegramClient    │
         │  - TwitterClient     │
         │  - Aggregator        │
         └──────────┬───────────┘
                    │ NATS Events
                    ▼
         ┌──────────────────────┐
         │  Trading Services    │
         │  (Strategy Executor) │
         └──────────────────────┘
```

## 📱 Telegram Integration

### Возможности

- ✅ **Real-time парсинг** сигналов через NATS
- ✅ **Поддержка русского и английского** языка
- ✅ **Автозагрузка истории** при старте (последние 100 сообщений)
- ✅ **Гибкий алгоритм** - работает с новостными и торговыми каналами

### Подключенные каналы

- **@markettwits** - Новостной канал (~6% conversion rate)
- **@ggshot** - Торговые сигналы (~18% conversion rate)

### Парсинг сигналов

**Bullish keywords:**
- English: long, buy, bullish, rally, surge, pump, moon, breakout, gain, profit, green
- Русский: рост, покупк, приток, бычь, ралли, пробой, прибыл, позитив

**Bearish keywords:**
- English: short, sell, bearish, crash, dump, drop, fall, loss, red
- Русский: падени, продаж, медвеж, обвал, снижени, убыт, негатив

### Примеры

```
Сообщение: "Cryptoquant отмечает резкий всплеск покупок в BTC"
→ Symbol: BTCUSDT
→ Direction: LONG
→ Confidence: 0.6 (найдено: "покупок")
```

```
Сообщение: "Притоки в спотовые BTC ETF усилились за неделю"
→ Symbol: BTCUSDT
→ Direction: LONG
→ Confidence: 0.4 (найдено: "притоки")
```

### API

```bash
# Проверить статус Telega
curl http://localhost:3005/status | jq

# Получить недавние сообщения
curl http://localhost:3005/channels/messages/recent?limit=100 | jq
```

## 🐦 Twitter Integration

### Возможности

- ✅ **Периодический сбор** (каждые 10 минут)
- ✅ **ClickHouse storage** с TTL 30 дней
- ✅ **Автоматическое извлечение** symbols и sentiment keywords
- ✅ **Мгновенные запросы** (50-200ms вместо 5-30 сек)

### Мониторинг 15 KOL

1. VitalikButerin - Ethereum founder
2. APompliano - Crypto analyst
3. CryptoCobain - Trader
4. CryptoWhale - Analyst
5. saylor - MicroStrategy CEO
6. novogratz - Galaxy Digital CEO
7. RaoulGMI - Macro investor
8. CryptosRUs - Educator
9. IvanOnTech - Educator
10. TheCryptoDog - Trader
11. WClementeThird - On-chain analyst
12. PeterLBrandt - Veteran trader
13. KoroushAK - On-chain analyst
14. TheBlockCrypto - News
15. CoinDesk - News

### ClickHouse таблицы

**twitter_tweets:**
```sql
CREATE TABLE aladdin.twitter_tweets (
  tweet_id String,
  username LowCardinality(String),
  text String,
  datetime DateTime,
  likes UInt32,
  retweets UInt32,
  symbols Array(String),          -- ["BTC", "ETH"]
  sentiment_keywords Array(String) -- ["bullish", "moon"]
) ENGINE = ReplacingMergeTree()
PARTITION BY toYYYYMM(datetime)
ORDER BY (username, datetime, tweet_id)
TTL datetime + INTERVAL 30 DAY
```

**twitter_scrape_runs:**
```sql
CREATE TABLE aladdin.twitter_scrape_runs (
  run_id UUID,
  started_at DateTime,
  finished_at Nullable(DateTime),
  status LowCardinality(String),
  tweets_collected UInt32,
  influencers_scraped UInt8,
  error_message Nullable(String)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(started_at)
ORDER BY (status, started_at)
TTL started_at + INTERVAL 90 DAY
```

### Symbol extraction

Автоматически распознает:
- Тикеры: BTC, ETH, SOL
- Полные названия: Bitcoin, Ethereum, Solana
- С символами: $BTC, #ETH
- Регистронезависимо

## 🧠 Sentiment Aggregation

### Weighted scoring

```typescript
// Веса источников
const weights = {
  telegram: min(signals_count / 10, 1),
  twitter: min(tweets_count / 50, 1)
}

// Общий score
overall = (telegram_score * telegram_weight + twitter_score * twitter_weight) 
          / (telegram_weight + twitter_weight)

// Confidence
confidence = (telegram_weight + twitter_weight) / 2
```

### Интерпретация

**Score:**
- `> 0.3` = BULLISH 🟢
- `-0.3 to 0.3` = NEUTRAL ⚪
- `< -0.3` = BEARISH 🔴

**Strength:**
- `|score| > 0.7` = STRONG 💪
- `|score| > 0.4` = MODERATE 🤝
- `|score| ≤ 0.4` = WEAK 👌

### API

```bash
# Single symbol
GET /api/sentiment/BTCUSDT

Response:
{
  "symbol": "BTCUSDT",
  "telegram": {
    "score": 0.69,      // -1 to 1
    "bullish": 11,
    "bearish": 2,
    "signals": 13
  },
  "twitter": {
    "score": 0.5,
    "positive": 25,
    "negative": 15,
    "neutral": 10,
    "tweets": 50
  },
  "overall": 0.65,
  "confidence": 0.72,
  "timestamp": "2025-10-04T..."
}

# Batch analysis
POST /api/sentiment/analyze-batch
{
  "symbols": ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
}

# Debug stats
GET /api/sentiment/debug

# Health check
GET /health
```

## 🚀 Быстрый старт

### 1. Запуск всех сервисов

```bash
# Из корня проекта
bun dev

# Или отдельно:
bun dev:social  # Social Integrations (3018)
```

### 2. Проверка статусов

```bash
# Telega
curl http://localhost:3005/status

# Social Integrations
curl http://localhost:3018/health

# Twitter data в ClickHouse
curl "http://49.13.216.63:8123/?query=SELECT count() FROM aladdin.twitter_tweets&database=aladdin"
```

### 3. Получение sentiment

```bash
# BTC sentiment
curl http://localhost:3018/api/sentiment/BTCUSDT | jq

# Debug информация
curl http://localhost:3018/api/sentiment/debug | jq
```

## 📊 Мониторинг

### SQL запросы для ClickHouse

```sql
-- Количество твитов по KOL
SELECT
  username,
  count() as tweets,
  max(datetime) as last_tweet
FROM aladdin.twitter_tweets
WHERE datetime >= now() - INTERVAL 24 HOUR
GROUP BY username
ORDER BY tweets DESC

-- Топ упоминаемых криптовалют
SELECT
  arrayJoin(symbols) as symbol,
  count() as mentions
FROM aladdin.twitter_tweets
WHERE datetime >= now() - INTERVAL 24 HOUR
GROUP BY symbol
ORDER BY mentions DESC
LIMIT 20

-- Статус scraper runs
SELECT
  started_at,
  status,
  tweets_collected,
  influencers_scraped,
  error_message
FROM aladdin.twitter_scrape_runs
ORDER BY started_at DESC
LIMIT 5
```

### Логи

```bash
# Social integrations
tail -f logs/social-integrations-2025-10-05.log

# Только ошибки
tail -f logs/social-integrations-error-2025-10-05.log
```

## 🔄 NATS Events

### Публикуемые события

**sentiment.analysis** - Каждые 5 минут для основных пар

```json
{
  "symbol": "BTCUSDT",
  "overall": 0.65,
  "telegram": { "score": 0.8, "signals": 13 },
  "twitter": { "score": 0.5, "tweets": 50 },
  "confidence": 0.75,
  "timestamp": 1728077123456
}
```

**sentiment.shift** - При изменении > 30%

```json
{
  "symbol": "BTCUSDT",
  "shift": "BULLISH",
  "magnitude": 0.45,
  "previousScore": 0.2,
  "currentScore": 0.65,
  "timestamp": 1728077123456
}
```

## 🐛 Troubleshooting

### Telegram данных нет

1. **Проверьте Telega подключение:**
```bash
curl http://localhost:3005/status | jq '.telegram.connected'
# Должно быть: true
```

2. **Проверьте подписки на каналы:**
```bash
curl http://localhost:3005/status | jq '.userbot.subscribedChannels'
# Должно быть: ["markettwits", "ggshot"]
```

3. **Проверьте debug stats:**
```bash
curl http://localhost:3018/api/sentiment/debug | jq '.data.telegram'
# Должно быть: totalSignals > 0
```

### Twitter данных нет

1. **Проверьте данные в ClickHouse:**
```bash
curl "http://49.13.216.63:8123/?query=SELECT count() FROM aladdin.twitter_tweets&database=aladdin"
# Должно быть > 0 после первого scrape
```

2. **Проверьте последний scrape:**
```sql
SELECT * FROM aladdin.twitter_scrape_runs ORDER BY started_at DESC LIMIT 1
```

3. **Дождитесь следующего scrape** (каждые 10 минут)

### Low conversion rate

**Это нормально!**
- Новостные каналы: 5-15% conversion rate
- Торговые каналы: 15-30% conversion rate
- Многие сообщения про макроэкономику, не про конкретные монеты

## 📈 Performance

| Метрика                 | До миграции | После          |
| ----------------------- | ----------- | -------------- |
| **Response Time**       | 5-30 сек    | 50-200ms       |
| **Success Rate**        | 60-80%      | 99%+           |
| **Concurrent Requests** | 1-2         | 1000+          |
| **Data Freshness**      | On-demand   | Every 10 min   |

## 🔮 Next Steps

- [ ] WebSocket real-time updates для фронтенда
- [ ] ML sentiment analysis вместо keywords
- [ ] Больше источников (Reddit, Discord)
- [ ] Historical sentiment charts
- [ ] Корреляция sentiment vs price движения
- [ ] Автоматические alerts на sentiment shifts

