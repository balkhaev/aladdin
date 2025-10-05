# AI Analyzed Content Feed

Система сохранения и отображения всех текстов, проанализированных через GPT.

## 📋 Обзор

AI Feed автоматически сохраняет все тексты (твиты, посты Reddit, сообщения Telegram, новости), которые были проанализированы через GPT-4, и отображает их в виде ленты на странице Social.

## 🗄️ База данных

### Таблица `ai_analyzed_content`

Основная таблица для хранения проанализированного контента:

```sql
CREATE TABLE IF NOT EXISTS aladdin.ai_analyzed_content (
    -- Идентификация
    id String,
    content_type String,  -- tweet, reddit_post, telegram_message, news
    source String,        -- twitter, reddit, telegram, news source

    -- Оригинальный контент
    title Nullable(String),
    text String,
    url Nullable(String),
    author Nullable(String),

    -- Метаданные
    symbols Array(String),
    published_at DateTime,
    engagement Int32 DEFAULT 0,  -- likes, upvotes, etc

    -- Результаты AI анализа
    ai_sentiment_score Float32,  -- -1 to 1
    ai_confidence Float32,       -- 0 to 1
    ai_method String,            -- keyword, gpt, hybrid
    ai_positive Int32,
    ai_negative Int32,
    ai_neutral Int32,
    ai_magnitude Float32,

    -- Дополнительные поля для новостей
    ai_market_impact Nullable(String),  -- bullish, bearish, neutral, mixed
    ai_summary Nullable(String),
    ai_key_points Array(String),
    ai_affected_coins Array(String),

    -- Системные поля
    analyzed_at DateTime DEFAULT now(),
    created_at DateTime DEFAULT now(),

    PRIMARY KEY (id, analyzed_at)
) ENGINE = ReplacingMergeTree(created_at)
PARTITION BY toYYYYMM(analyzed_at)
ORDER BY (id, analyzed_at, content_type)
TTL analyzed_at + INTERVAL 30 DAY;
```

### Индексы

```sql
-- Быстрый поиск по типу контента
ALTER TABLE aladdin.ai_analyzed_content
ADD INDEX idx_analyzed_content_type content_type
TYPE bloom_filter GRANULARITY 1;

-- Поиск по символам
ALTER TABLE aladdin.ai_analyzed_content
ADD INDEX idx_analyzed_symbols symbols
TYPE bloom_filter GRANULARITY 1;

-- Фильтрация по sentiment score
ALTER TABLE aladdin.ai_analyzed_content
ADD INDEX idx_analyzed_sentiment ai_sentiment_score
TYPE minmax GRANULARITY 1;
```

### Materialized View для статистики

```sql
CREATE MATERIALIZED VIEW aladdin.ai_analyzed_stats
ENGINE = SummingMergeTree()
AS SELECT
    content_type,
    toStartOfHour(analyzed_at) as hour,
    count() as total_count,
    countIf(ai_method = 'gpt') as gpt_count,
    countIf(ai_method = 'keyword') as keyword_count,
    avgIf(ai_sentiment_score, ai_sentiment_score IS NOT NULL) as avg_sentiment,
    sum(engagement) as total_engagement
FROM aladdin.ai_analyzed_content
GROUP BY content_type, hour;
```

## 🔄 Backend: Автоматическое сохранение

### Метод `saveToAnalyzedFeed` в Scraper Service

Автоматически вызывается после анализа любого контента:

```typescript
await scraperService.saveToAnalyzedFeed({
  id: "tweet_unique_id",
  contentType: "tweet",
  source: "twitter",
  text: "Bitcoin to the moon! 🚀",
  author: "@cryptotrader",
  url: "https://twitter.com/...",
  symbols: ["BTC"],
  publishedAt: new Date(),
  engagement: 1250, // likes + retweets
  sentiment: {
    score: 0.85,
    confidence: 0.92,
    positive: 10,
    negative: 2,
    neutral: 3,
    magnitude: 0.8,
  },
  method: "gpt", // или "keyword", "hybrid"
  // Для новостей:
  marketImpact: "bullish",
  summary: "Breaking: Bitcoin ETF approved...",
  keyPoints: ["ETF approval", "Institutional adoption"],
  affectedCoins: ["BTC", "ETH"],
})
```

### Интеграция в Twitter анализ

```typescript
// В analyzeTwitterSentiment автоматически сохраняется:
Promise.all(
  tweets.map(async (tweet, i) => {
    const result = hybridResults[i]
    await this.saveToAnalyzedFeed({
      id: `tweet_${tweet.datetime}_${random}`,
      contentType: "tweet",
      source: "twitter",
      text: tweet.text,
      author: tweet.username,
      url: tweet.url,
      symbols: extractSymbols(tweet.text),
      publishedAt: new Date(tweet.datetime),
      engagement: tweet.likes + tweet.retweets,
      sentiment: result.sentiment,
      method: result.method,
    })
  })
)
```

## 📡 API Endpoints

### GET `/api/social/feed`

Получить ленту проанализированного контента.

**Query Parameters:**

- `limit` - Количество записей (default: 50)
- `offset` - Смещение для пагинации (default: 0)
- `contentType` - Фильтр по типу: `tweet`, `reddit_post`, `telegram_message`, `news`
- `symbol` - Фильтр по символу (например, `BTC`)
- `minSentiment` - Минимальный sentiment score (-1 to 1)
- `maxSentiment` - Максимальный sentiment score (-1 to 1)

**Примеры:**

```bash
# Все записи
GET /api/social/feed?limit=50

# Только твиты
GET /api/social/feed?contentType=tweet&limit=100

# Только положительные твиты про BTC
GET /api/social/feed?contentType=tweet&symbol=BTC&minSentiment=0.5

# Только новости
GET /api/social/feed?contentType=news
```

**Response:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "tweet_123",
        "contentType": "tweet",
        "source": "twitter",
        "title": null,
        "text": "Bitcoin to the moon! 🚀",
        "url": "https://twitter.com/...",
        "author": "@cryptotrader",
        "symbols": ["BTC"],
        "publishedAt": "2025-10-05T12:00:00Z",
        "engagement": 1250,
        "sentiment": {
          "score": 0.85,
          "confidence": 0.92,
          "positive": 10,
          "negative": 2,
          "neutral": 3,
          "magnitude": 0.8
        },
        "method": "gpt",
        "marketImpact": null,
        "summary": null,
        "keyPoints": [],
        "affectedCoins": [],
        "analyzedAt": "2025-10-05T12:01:00Z"
      }
    ],
    "count": 1,
    "limit": 50,
    "offset": 0
  }
}
```

## 🎨 Frontend: Компонент AI Feed

### Расположение

Страница: **Social → AI Feed** (`/sentiment#ai-feed`)

Компонент: `apps/web/src/components/ai-analyzed-feed.tsx`

### Возможности

1. **Фильтрация по типу контента:**

   - All - все типы
   - Tweets - только Twitter
   - Reddit - только Reddit посты
   - Telegram - только Telegram сообщения
   - News - только новости

2. **Отображение информации:**

   - Оригинальный текст или summary (для новостей)
   - Sentiment badge (Bullish/Bearish/Neutral)
   - GPT badge (если анализировался через GPT)
   - Confidence score
   - Символы (BTC, ETH, etc.)
   - Engagement metrics
   - Key points (для новостей)

3. **Автообновление:**
   - Обновляется каждые 30 секунд
   - Показывает новый контент в реальном времени

### Использование в React

```typescript
import { AIAnalyzedFeed } from "@/components/ai-analyzed-feed"

function MyPage() {
  return (
    <div>
      <AIAnalyzedFeed />
    </div>
  )
}
```

## 📊 Примеры использования

### 1. Мониторинг настроений в реальном времени

Откройте страницу Social → AI Feed, чтобы видеть все новые твиты и новости с их GPT-анализом в режиме реального времени.

### 2. Фильтрация высококонфидентных сигналов

```bash
# API: Только высококонфидентные положительные сигналы
GET /api/social/feed?minSentiment=0.7&contentType=tweet
```

### 3. Анализ влияния новостей

```bash
# API: Все новости с рыночным влиянием
GET /api/social/feed?contentType=news
```

### 4. Отслеживание конкретной монеты

```bash
# API: Весь контент про Bitcoin
GET /api/social/feed?symbol=BTC&limit=100
```

## 🔍 Мониторинг

### Проверка записей в ClickHouse

```sql
-- Количество записей по типам
SELECT
    content_type,
    count() as total,
    countIf(ai_method = 'gpt') as gpt_analyzed,
    avg(ai_sentiment_score) as avg_sentiment
FROM aladdin.ai_analyzed_content
GROUP BY content_type;

-- Последние записи
SELECT
    content_type,
    text,
    ai_sentiment_score,
    ai_method,
    analyzed_at
FROM aladdin.ai_analyzed_content
ORDER BY analyzed_at DESC
LIMIT 10;

-- Статистика по символам
SELECT
    arrayJoin(symbols) as symbol,
    count() as mentions,
    avg(ai_sentiment_score) as avg_sentiment
FROM aladdin.ai_analyzed_content
WHERE has(symbols, 'BTC')
GROUP BY symbol
ORDER BY mentions DESC;
```

## 🎯 Best Practices

1. **TTL настроен на 30 дней** - старые записи автоматически удаляются
2. **ReplacingMergeTree** - дедупликация по `id` + `analyzed_at`
3. **Партиционирование по месяцам** - оптимизация запросов
4. **Индексы bloom_filter** - быстрый поиск по типу и символам
5. **Асинхронное сохранение** - не замедляет основной анализ

## 🚀 Будущие улучшения

- [ ] Поиск по тексту (full-text search)
- [ ] Экспорт в CSV/JSON
- [ ] Email уведомления о важных событиях
- [ ] Агрегация sentiment по временным интервалам
- [ ] Графики распределения sentiment
- [ ] Сравнение AI vs Keyword анализа

## 📝 Заметки

- Сохраняются **ВСЕ** проанализированные тексты, независимо от метода (GPT, keyword, hybrid)
- Для новостей сохраняются дополнительные поля: `summary`, `keyPoints`, `marketImpact`
- Frontend автоматически обновляется каждые 30 секунд
- Используется React Query для кэширования на клиенте
