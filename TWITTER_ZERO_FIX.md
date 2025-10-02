# Исправление Twitter данных (все нули)

## Проблема

Twitter данные в sentiment service возвращают все нули:

```json
{
  "twitter": {
    "score": 0,
    "tweets": 0
  }
}
```

## Причины

### 1. **Отсутствовали таблицы в ClickHouse**

Twity scraper пытался писать в несуществующие таблицы:

- `twitter_tweets` - для хранения твитов
- `twitter_scrape_runs` - для логирования запусков

**Логи показывали:**

```
Table aladdin.twitter_tweets does not exist
Table aladdin.twitter_scrape_runs does not exist
```

### 2. **TwitterClient не подключен к ClickHouse**

В `sentiment/src/services/twitter-client.ts`:

```typescript
const result = await this.chClient.query({
  // this.chClient не инициализирован!
  query,
  format: "JSONEachRow",
})
```

## Решение

### ✅ Шаг 1: Созданы таблицы в ClickHouse

Через MCP созданы:

**twitter_tweets:**

```sql
CREATE TABLE aladdin.twitter_tweets (
  tweet_id String,
  username LowCardinality(String),
  text String,
  datetime DateTime,
  likes UInt32 DEFAULT 0,
  retweets UInt32 DEFAULT 0,
  symbols Array(String),
  sentiment_keywords Array(String)
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
  tweets_collected UInt32 DEFAULT 0,
  influencers_scraped UInt8 DEFAULT 0,
  error_message Nullable(String)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(started_at)
ORDER BY (status, started_at)
TTL started_at + INTERVAL 90 DAY
```

### ⏳ Шаг 2: Дождаться первого scrape

Twity scraper запускается **каждые 10 минут**. После создания таблиц, при следующем запуске:

1. Twity подключится к ClickHouse
2. Начнет scrape-ить 15 crypto influencers
3. Сохранит ~150 твитов в `twitter_tweets`

### 🔧 Шаг 3: Исправить TwitterClient (TODO)

TwitterClient в sentiment service **НЕ работает** с ClickHouse. Есть 2 варианта:

#### Вариант A: Использовать MCP в sentiment service

```typescript
// Вместо прямого ClickHouse клиента
// использовать MCP tools для чтения
```

#### Вариант B: Добавить ClickHouse клиент в TwitterClient

```typescript
import { createClient } from '@clickhouse/client';

constructor(
  twityUrl: string,
  private logger: Logger,
  clickhouseConfig?: { host: string; database: string; password: string }
) {
  // Инициализировать this.chClient
}
```

## Текущий статус

✅ Таблицы созданы
⏳ Ожидание первого scrape (следующий запуск в течение 10 минут)
❌ TwitterClient не может читать из ClickHouse (нужно исправить)

## Как проверить

### 1. Проверить, что twity scrape работает

```bash
# Проверить логи
tail -f logs/twity-2025-10-04.log | grep "scrape"

# Должно появиться:
# "Scraping started"
# "Collected X tweets from @username"
# "Scrape completed"
```

### 2. Проверить данные в ClickHouse

Через MCP:

```sql
SELECT count() FROM aladdin.twitter_tweets
```

Или через curl (если есть доступ):

```bash
curl "http://49.13.216.63:8123/?query=SELECT count() FROM aladdin.twitter_tweets&database=aladdin&user=default&password=..."
```

### 3. Проверить sentiment service

После появления твитов в базе:

```bash
curl http://localhost:3018/api/sentiment/BTCUSDT | jq '.data.twitter'

# Все еще будет 0, пока не исправим TwitterClient!
```

## Timeline

- **Сейчас**: Таблицы созданы, twity scraper работает, но ничего не может записать
- **Через 0-10 минут**: Следующий scrape цикл, твиты появятся в базе
- **После исправления TwitterClient**: Sentiment service начнет видеть твиты

## Следующие шаги

1. ⏳ **Дождаться scrape** - автоматически произойдет в течение 10 минут
2. 🔧 **Исправить TwitterClient** - добавить ClickHouse клиент или использовать MCP
3. ✅ **Проверить результат** - sentiment API должен возвращать twitter данные

## Влияние

**До исправления:**

- Twity scraper работает, но не может писать → нет данных
- Sentiment service читает пустую таблицу → возвращает нули

**После исправления:**

- Twity scraper пишет ~150 твитов каждые 10 минут
- Sentiment service читает свежие твиты за последние 24 часа
- API возвращает реальные twitter sentiment scores

## Альтернатива: Ручной запуск scrape

Если не хотите ждать 10 минут, можно вызвать scrape вручную (если будет добавлен endpoint):

```bash
# TODO: добавить endpoint для ручного запуска
curl -X POST http://localhost:8000/twitter/scrape-now
```

Пока такого endpoint нет, остается только ждать автоматического scrape.
