# Integrations

Руководство по интеграции внешних сервисов и систем.

---

## 📱 Social Integrations (Telegram + Twitter)

**Статус:** ✅ Production Ready  
**Port:** 3018  
**Purpose:** Sentiment analysis из Telegram и Twitter

Полная документация: **[SOCIAL_INTEGRATIONS.md](SOCIAL_INTEGRATIONS.md)**

### Краткое описание

- ✅ **Telegram**: Real-time парсинг сигналов через NATS
- ✅ **Twitter**: Периодический сбор (каждые 10 мин) → ClickHouse
- ✅ **15 KOL** мониторинг на Twitter
- ✅ **Русский + английский** парсинг для Telegram
- ✅ **Weighted aggregation** для sentiment scoring

### API

```bash
# Single symbol sentiment
GET /api/sentiment/BTCUSDT

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

### NATS Events

```typescript
// Published every 5 minutes
nats.publish("sentiment.analysis", {
  symbol: "BTCUSDT",
  overall: 0.65,
  telegram: { score: 0.8, signals: 13 },
  twitter: { score: 0.5, tweets: 50 },
  confidence: 0.75,
})

// On significant change (>30%)
nats.publish("sentiment.shift", {
  symbol: "BTCUSDT",
  shift: "BULLISH",
  magnitude: 0.45,
})
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
