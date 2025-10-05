# Scraper Service (formerly Social Integrations)

**Статус:** ✅ Production Ready  
**Порт:** 3018  
**Назначение:** Сбор и анализ сентимента из социальных сетей (Twitter, Reddit, Telegram)

---

## 🎯 Обзор

Scraper Service — это микросервис для сбора данных из социальных сетей и анализа настроений криптосообщества. Поддерживает Twitter, Reddit и Telegram.

### Основные возможности:

- 🐦 **Twitter Scraping** - сбор твитов с упоминаниями криптовалют
- 🔴 **Reddit Scraping** - парсинг постов из крипто-сабреддитов
- 💬 **Telegram Integration** - мониторинг каналов и групп
- 🧠 **Sentiment Analysis** - NLP-анализ тональности текста
- 📊 **Aggregated Sentiment** - комбинированный сентимент со всех источников

---

## 📦 Архитектура

```
apps/scraper/
├── src/
│   ├── index.ts                 # Главный файл с API endpoints
│   ├── service.ts               # Основной сервис
│   ├── reddit/                  # Reddit scraper
│   │   ├── scraper.ts          # Puppeteer scraping logic
│   │   ├── service.ts          # Reddit service
│   │   └── types.ts            # TypeScript типы
│   ├── twitter/                 # Twitter scraper
│   │   ├── scraper.ts          # Puppeteer scraping logic
│   │   ├── service.ts          # Twitter service
│   │   └── types.ts            # TypeScript типы
│   ├── telegram/                # Telegram integration
│   │   └── ...                 # Telegram logic
│   └── sentiment/               # Sentiment Analysis
│       ├── analyzer.ts         # NLP sentiment analyzer
│       └── types.ts            # Sentiment types
└── package.json
```

---

## 🚀 API Endpoints

### Social Sentiment

**GET** `/api/social/sentiment/:symbol`

Получить комбинированный сентимент для символа из всех источников.

**Response:**

```json
{
  "success": true,
  "data": {
    "symbol": "BTCUSDT",
    "overall": 0.45,
    "telegram": {
      "score": 0.3,
      "bullish": 15,
      "bearish": 5,
      "signals": 20
    },
    "twitter": {
      "score": 0.6,
      "positive": 45,
      "negative": 15,
      "neutral": 10,
      "tweets": 70
    },
    "reddit": {
      "score": 0.4,
      "positive": 20,
      "negative": 10,
      "neutral": 5,
      "posts": 35
    },
    "confidence": 0.85,
    "timestamp": "2025-10-05T12:00:00Z"
  }
}
```

**POST** `/api/social/sentiment/analyze-batch`

Batch-анализ сентимента для нескольких символов.

**Request:**

```json
{
  "symbols": ["BTCUSDT", "ETHUSDT", "BNBUSDT"]
}
```

---

### Reddit

**POST** `/api/social/reddit/scrape`

Запустить скрапинг Reddit для конкретного символа.

**Request:**

```json
{
  "symbol": "BTCUSDT",
  "limit": 25
}
```

**POST** `/api/social/reddit/monitor`

Мониторинг популярных крипто-сабреддитов.

**Request:**

```json
{
  "limit": 10
}
```

**GET** `/api/social/reddit/health`

Health check для Reddit scraper.

---

### Twitter

**GET** `/api/social/twitter/health`

Health check для Twitter scraper.

---

### Telegram

**GET** `/api/social/telegram/health`

Health check для Telegram integration.

---

## 🧠 Sentiment Analysis

### Алгоритм

Используется **лексиконный подход** с крипто-специфичными ключевыми словами:

#### Bullish Keywords (вес):

- Strong: `moon`, `lambo`, `to the moon`, `🚀` (2.0)
- Moderate: `bullish`, `pump`, `rally`, `breakout` (1.0-1.5)
- Positive: `gains`, `profit`, `winning`, `strong` (0.5-1.0)

#### Bearish Keywords (вес):

- Strong: `crash`, `scam`, `rug pull`, `rekt` (-2.0)
- Moderate: `bearish`, `dump`, `sell`, `short` (-1.0 to -1.5)
- Negative: `drop`, `fall`, `decline`, `loss` (-0.5 to -1.0)

#### Модификаторы:

- **Intensifiers**: `very`, `extremely`, `super` (1.5-2.0x)
- **Negators**: `not`, `no`, `never` (флип сентимента)

### Нормализация

```typescript
// Сентимент нормализуется в диапазон -1..1
normalizedScore = clamp(totalScore / 10, -1, 1)

// Confidence основан на количестве найденных sentiment words
confidence = min(sentimentWords / 5, 1)
```

---

## 🔄 Reddit Scraping

### Поддерживаемые сабреддиты:

| Subreddit           | Crypto Relevance | Weight |
| ------------------- | ---------------- | ------ |
| r/CryptoCurrency    | 1.0              | 1.5    |
| r/Bitcoin           | 1.0              | 1.3    |
| r/ethereum          | 1.0              | 1.2    |
| r/CryptoMarkets     | 1.0              | 1.2    |
| r/altcoin           | 1.0              | 1.0    |
| r/binance           | 0.9              | 0.9    |
| r/SatoshiStreetBets | 0.8              | 0.8    |
| r/CryptoMoonShots   | 0.7              | 0.6    |

### Puppeteer Scraping

Используется **headless Chrome** для scraping:

```typescript
// Scrape posts by search query
const posts = await scrapeRedditBySearch("BTC crypto", 25, "relevance")

// Scrape subreddit
const posts = await scrapeRedditSubreddit("CryptoCurrency", 25, "hot")

// Scrape comments
const comments = await scrapeRedditComments(postUrl, 50)
```

---

## 💾 ClickHouse Storage

### reddit_posts table

```sql
CREATE TABLE aladdin.reddit_posts (
    id String,
    title String,
    text String,
    author String,
    subreddit String,
    score Int64,
    upvote_ratio Float64,
    num_comments Int32,
    datetime DateTime,
    url String,
    flair Nullable(String),
    is_stickied UInt8,
    is_locked UInt8,
    symbols Array(String),
    analyzed_symbol Nullable(String),
    created_at DateTime DEFAULT now()
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(datetime)
ORDER BY (subreddit, datetime, score)
TTL datetime + INTERVAL 90 DAY DELETE;
```

### twitter_tweets table

```sql
CREATE TABLE aladdin.twitter_tweets (
    id String,
    text String,
    username String,
    display_name String,
    likes Int32,
    retweets Int32,
    replies Int32,
    datetime DateTime,
    url String,
    symbols Array(String),
    sentiment_keywords Array(String),
    created_at DateTime DEFAULT now()
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(datetime)
ORDER BY (symbols, datetime, likes)
TTL datetime + INTERVAL 90 DAY DELETE;
```

---

## 🔧 Конфигурация

### Environment Variables

```bash
PORT=3018
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_DATABASE=crypto
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=

# Puppeteer settings (optional)
PUPPETEER_HEADLESS=true
PUPPETEER_SLOWMO=0
```

---

## 🧪 Примеры использования

### Analyze sentiment

```bash
curl http://localhost:3018/api/social/sentiment/BTCUSDT
```

### Scrape Reddit

```bash
curl -X POST http://localhost:3018/api/social/reddit/scrape \
  -H "Content-Type: application/json" \
  -d '{"symbol": "BTCUSDT", "limit": 25}'
```

### Monitor subreddits

```bash
curl -X POST http://localhost:3018/api/social/reddit/monitor \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'
```

### Batch sentiment analysis

```bash
curl -X POST http://localhost:3018/api/social/sentiment/analyze-batch \
  -H "Content-Type: application/json" \
  -d '{"symbols": ["BTCUSDT", "ETHUSDT", "BNBUSDT"]}'
```

---

## 📈 Integration с ML Service

Scraper Service предоставляет данные для Machine Learning моделей:

- **Feature Engineering** - сентимент как фича для prediction models
- **Market Regime Detection** - корреляция сентимента с market regimes
- **Anomaly Detection** - выявление pump & dump по социальным сигналам

---

## 🚦 Health Checks

```bash
# General health
curl http://localhost:3018/api/social/telegram/health
curl http://localhost:3018/api/social/twitter/health
curl http://localhost:3018/api/social/reddit/health
```

---

## 🔮 Roadmap

- [ ] Real-time streaming для Twitter/Reddit
- [ ] Telegram bot для автоматических алертов
- [ ] Discord integration
- [ ] YouTube sentiment analysis (комментарии)
- [ ] Advanced NLP models (BERT/GPT для sentiment)
- [ ] Multi-language support
- [ ] Crypto influencer tracking

---

## 📝 Notes

- Reddit scraping может быть медленным из-за Puppeteer
- Rate limiting на Twitter API
- TTL на данные в ClickHouse: 90 дней
