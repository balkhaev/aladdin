# Integrations

Руководство по интеграции внешних сервисов и систем.

---

## 📱 Telegram Integration (Telega)

**Статус:** ✅ Integrated  
**Port:** 3000  
**Purpose:** Parsing торговых сигналов из Telegram каналов

### Architecture

```
Telegram Channels
    ↓
Telega Service (userbot)
    ↓
PostgreSQL Storage
    ↓
REST API + Webhooks
    ↓
Sentiment Service (aggregation)
```

### Setup

**1. Install & Configure:**

```bash
cd apps/telega
npm install
```

**2. Environment (.env):**

```bash
PORT=3000
DATABASE_URL=postgresql://...
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
TELEGRAM_SESSION=your_session_string
```

**3. Start:**

```bash
npm run dev
```

### API

```bash
# Get signals
GET http://localhost:3000/signals

# Get signals by symbol
GET http://localhost:3000/signals?symbol=BTC

# Health check
GET http://localhost:3000/health
```

**Response:**

```json
{
  "signals": [
    {
      "symbol": "BTCUSDT",
      "type": "LONG",
      "source": "channel_name",
      "confidence": 0.8,
      "timestamp": "2025-10-04T..."
    }
  ]
}
```

### Sentiment Calculation

```typescript
// Telega signals → sentiment score
const score = (bullishCount - bearishCount) / totalSignals
// Range: -1 (all bearish) to +1 (all bullish)
```

### Database Schema

```sql
CREATE TABLE telegram_signals (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20),
  type VARCHAR(10),      -- LONG/SHORT
  channel VARCHAR(100),
  raw_text TEXT,
  confidence DECIMAL(3,2),
  created_at TIMESTAMP
);
```

---

## 🐦 Twitter Integration (Twity)

**Статус:** ✅ Integrated  
**Port:** 8000  
**Purpose:** Twitter scraping без API ключей

### Architecture

```
Twitter
    ↓
Twity Service (scraper)
    ↓
Cookie-based auth
    ↓
REST API
    ↓
Sentiment Service (keyword analysis)
```

### Setup

**1. Install:**

```bash
cd apps/twity
pnpm install
```

**2. Configure Cookies:**

```bash
# twitter_cookies.json
{
  "cookies": [
    {
      "name": "auth_token",
      "value": "your_token",
      "domain": ".twitter.com"
    }
  ]
}
```

**3. Start:**

```bash
pnpm dev:api
```

### API

```bash
# Search tweets
GET http://localhost:8000/twitter/search?query=BTC&limit=20

# Search by user
GET http://localhost:8000/twitter/user/elonmusk?limit=10

# Health check
GET http://localhost:8000/health
```

**Response:**

```json
{
  "tweets": [
    {
      "id": "123456789",
      "text": "Bitcoin looking bullish! 🚀",
      "author": "@cryptotrader",
      "likes": 150,
      "retweets": 45,
      "timestamp": "2025-10-04T..."
    }
  ]
}
```

### Sentiment Analysis

**Keyword-based scoring:**

Bullish keywords: `bullish`, `moon`, `pump`, `buy`, `long`, `🚀`, `📈`, `💎`  
Bearish keywords: `bearish`, `dump`, `sell`, `short`, `📉`, `⚠️`, `crash`

```typescript
const sentiment = {
  positive: tweets.filter((t) => hasBullishKeywords(t.text)).length,
  negative: tweets.filter((t) => hasBearishKeywords(t.text)).length,
  neutral: tweets.length - positive - negative,
}

const score = (positive - negative) / tweets.length
// Range: -1 to +1
```

### Monitored Accounts

- Crypto influencers
- Trading signal providers
- Market analysts
- Exchange announcements

---

## 🧠 Sentiment Service Integration

**Статус:** ✅ Production Ready  
**Port:** 3018  
**Purpose:** Aggregation Telega + Twity

### Architecture

```
┌──────────┐        ┌──────────┐
│  Telega  │        │  Twity   │
│  :3000   │        │  :8000   │
└────┬─────┘        └────┬─────┘
     │                   │
     └────────┬──────────┘
              ▼
     ┌────────────────────┐
     │ Sentiment Service  │
     │      :3018         │
     │                    │
     │ • TelegramClient   │
     │ • TwitterClient    │
     │ • Aggregator       │
     └─────────┬──────────┘
               │ NATS Events
               ▼
     ┌─────────────────────┐
     │ Strategy Executor   │
     │      :3019          │
     └─────────────────────┘
```

### Components

**1. TelegramClient**

```typescript
class TelegramClient {
  async getSignals(symbol: string) {
    const response = await fetch(`${TELEGA_URL}/signals?symbol=${symbol}`)
    return this.calculateSentiment(response.signals)
  }
}
```

**2. TwitterClient**

```typescript
class TwitterClient {
  async searchTweets(query: string) {
    const response = await fetch(`${TWITY_URL}/twitter/search?query=${query}`)
    return this.analyzeSentiment(response.tweets)
  }
}
```

**3. SentimentAggregator**

```typescript
class SentimentAggregator {
  async analyze(symbol: string) {
    const telegram = await this.telegramClient.getSignals(symbol)
    const twitter = await this.twitterClient.searchTweets(symbol)

    // Weighted aggregation (Telegram: 60%, Twitter: 40%)
    const overall = telegram.score * 0.6 + twitter.score * 0.4
    const confidence = this.calculateConfidence(telegram, twitter)

    return { overall, telegram, twitter, confidence }
  }
}
```

### Weighted Aggregation

```typescript
// Telegram has higher weight (more actionable signals)
const weights = {
  telegram: 0.6, // Trading signals have higher priority
  twitter: 0.4, // Social sentiment for confirmation
}

const overall =
  telegram.score * weights.telegram + twitter.score * weights.twitter

// Confidence based on data quality
const confidence = Math.min(
  telegram.signalCount / 10, // More signals = higher confidence
  twitter.tweetCount / 30 // More tweets = higher confidence
)
```

### NATS Events

**Published by Sentiment Service:**

```typescript
// Every 5 minutes
nats.publish("sentiment.analysis", {
  symbol: "BTCUSDT",
  overall: 0.65,
  telegram: { score: 0.8, bullish: 8, bearish: 2 },
  twitter: { score: 0.5, positive: 15, negative: 5 },
  confidence: 0.75,
  timestamp: Date.now(),
})

// On significant change (>30%)
nats.publish("sentiment.shift", {
  symbol: "BTCUSDT",
  shift: "BULLISH",
  magnitude: 0.45,
  previousScore: 0.2,
  currentScore: 0.65,
})
```

### API

```bash
# Analyze sentiment
GET /api/sentiment/:symbol

# Response:
{
  "symbol": "BTCUSDT",
  "overall": 0.65,
  "telegram": {
    "score": 0.8,
    "bullish": 8,
    "bearish": 2,
    "signals": 10
  },
  "twitter": {
    "score": 0.5,
    "positive": 15,
    "negative": 5,
    "neutral": 10,
    "tweets": 30
  },
  "confidence": 0.75,
  "timestamp": "2025-10-04T..."
}

# Batch analysis
POST /api/sentiment/analyze-batch
{
  "symbols": ["BTCUSDT", "ETHUSDT", "BNBUSDT"]
}

# Service health
GET /api/sentiment/services/health
```

---

## 🔗 Strategy Executor Integration

**Статус:** ✅ Production Ready  
**Port:** 3019

### Integration Flow

```
Sentiment Service
    ↓ NATS: sentiment.analysis
Strategy Executor
    ↓ REST: risk checks
Risk Service
    ↓ REST: order placement
Trading Service
    ↓ WebSocket: price updates
Market Data Service
```

### Configuration

```bash
# .env
PORT=3019
EXECUTOR_MODE=PAPER              # PAPER or LIVE
AUTO_EXECUTE=true                # Enable auto-execution
MAX_OPEN_POSITIONS=5
MIN_CONFIDENCE=0.6               # Minimum signal confidence
SENTIMENT_WEIGHT=0.4             # Sentiment vs Technical weight

# Service URLs
NATS_URL=nats://nats.balkhaev.com:4222
TRADING_SERVICE_URL=http://localhost:3011
RISK_SERVICE_URL=http://localhost:3013
SENTIMENT_SERVICE_URL=http://localhost:3018
```

### Signal Processing

```typescript
// Combine technical + sentiment
const technicalConfidence = signal.confidence // From screener
const sentimentScore = await getSentiment(signal.symbol)

// Weighted combination
const combinedConfidence =
  technicalConfidence * (1 - SENTIMENT_WEIGHT) +
  Math.abs(sentimentScore.overall) * SENTIMENT_WEIGHT

// Filter by minimum confidence
if (combinedConfidence < MIN_CONFIDENCE) {
  logger.info("Signal rejected: low confidence")
  return
}

// Execute if passed all checks
await executeOrder(signal, combinedConfidence)
```

---

## 📊 Redis Integration

**Статус:** ✅ Integrated (Analytics, Market Data)

### Configuration

```bash
# .env (all services)
REDIS_URL=redis://49.13.216.63:6379
```

### Usage

```typescript
import { CacheService } from "@repo/shared/cache"

const cache = new CacheService(process.env.REDIS_URL)

// Set with TTL
await cache.set("key", value, 60) // 60 seconds

// Get
const value = await cache.get("key")

// Multiple keys
await cache.mset({ key1: "val1", key2: "val2" })
const values = await cache.mget(["key1", "key2"])

// Statistics
const stats = cache.getStats()
console.log(`Hit rate: ${stats.hitRate}%`)
```

---

## 🐛 Troubleshooting

### Telega не отвечает

```bash
# Check service
curl http://localhost:3000/health

# Check logs
tail -f logs/telega-*.log

# Restart
cd apps/telega && npm run dev
```

### Twity не отвечает

```bash
# Check cookies
cat apps/twity/twitter_cookies.json

# Re-authenticate
pnpm dev:api

# Check logs
tail -f logs/twity-*.log
```

### Sentiment Service не получает данные

```bash
# Check external services
curl http://localhost:3000/signals
curl http://localhost:8000/twitter/search?query=BTC

# Check .env
cat apps/sentiment/.env

# Check logs
tail -f logs/sentiment-*.log
```

### Strategy Executor не исполняет

```bash
# Check mode
curl http://localhost:3019/api/executor/config

# Enable auto-execute
curl -X POST http://localhost:3019/api/executor/toggle \
  -d '{"autoExecute": true}'

# Check NATS connection
curl http://localhost:3019/health
```

---

_Все интеграции протестированы и готовы к использованию._
