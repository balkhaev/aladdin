# Reddit и News Парсинг - Руководство

## Обзор

Добавлены:

- ✅ Парсинг новостей CoinDesk через Puppeteer
- ✅ Периодический автоматический парсинг Reddit каждые 15 минут
- ✅ Периодический парсинг новостей каждые 10 минут
- ✅ Улучшенное логирование во всех скраперах
- ✅ Новые API эндпоинты для управления парсингом

## Структура файлов

```
apps/scraper/src/
├── news/                      # НОВАЯ ДИРЕКТОРИЯ
│   ├── index.ts              # Экспорты
│   ├── types.ts              # Типы для новостей
│   ├── service.ts            # NewsService с периодическим парсингом
│   └── sources/              # Источники новостей
│       ├── base.ts           # Базовый класс NewsSource
│       ├── coindesk.ts       # CoinDesk парсер с Puppeteer
│       └── index.ts          # Экспорты источников
├── reddit/
│   └── service.ts            # ✅ Добавлен периодический парсинг
├── twitter/
│   └── scraper.ts            # ✅ Улучшено логирование
├── telegram/
│   └── userbot.ts            # ✅ Улучшено логирование
└── service.ts                # ✅ Интегрированы NewsService и периодический Reddit
```

## Environment переменные

Добавьте в `.env`:

```bash
# Периодичность парсинга (в миллисекундах)
REDDIT_SCRAPE_INTERVAL=900000  # 15 минут
NEWS_SCRAPE_INTERVAL=600000    # 10 минут

# Лимиты парсинга
REDDIT_POSTS_LIMIT=25
NEWS_ARTICLES_LIMIT=20
```

## Запуск

```bash
# Режим разработки с hot reload
bun --watch apps/scraper/src/index.ts

# Production
bun apps/scraper/dist/index.js
```

## API Endpoints

### News Endpoints

#### GET `/api/social/news/health`

Проверка состояния news парсера.

```bash
curl http://localhost:3018/api/social/news/health
```

**Response:**

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "news"
  }
}
```

---

#### POST `/api/social/news/scrape`

Ручной запуск парсинга новостей.

```bash
# Парсить все источники
curl -X POST http://localhost:3018/api/social/news/scrape \
  -H "Content-Type: application/json"

# Парсить конкретный источник
curl -X POST http://localhost:3018/api/social/news/scrape \
  -H "Content-Type: application/json" \
  -d '{"source": "coindesk"}'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "articlesScraped": 15,
    "source": "all",
    "timestamp": "2025-10-09T12:00:00Z"
  }
}
```

---

#### GET `/api/social/news/latest`

Получить последние новости.

```bash
# Получить 50 последних новостей
curl http://localhost:3018/api/social/news/latest

# Фильтровать по источнику
curl "http://localhost:3018/api/social/news/latest?source=coindesk&limit=20"

# Фильтровать по символу
curl "http://localhost:3018/api/social/news/latest?symbol=BTC&limit=30"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "articles": [
      {
        "id": "coindesk_article123_1234567890",
        "title": "Bitcoin Surges Past $50,000",
        "content": "...",
        "source": "coindesk",
        "url": "https://www.coindesk.com/...",
        "publishedAt": "2025-10-09T10:30:00Z",
        "scrapedAt": "2025-10-09T10:35:00Z",
        "symbols": ["BTC"],
        "categories": ["market", "bitcoin"]
      }
    ],
    "count": 15,
    "limit": 50
  }
}
```

---

#### GET `/api/social/news/status`

Статус news сервиса.

```bash
curl http://localhost:3018/api/social/news/status
```

**Response:**

```json
{
  "success": true,
  "data": {
    "running": true,
    "sources": [
      {
        "name": "coindesk",
        "enabled": true
      }
    ],
    "articlesLimit": 20
  }
}
```

---

### Reddit Endpoints

#### GET `/api/social/reddit/status`

Статус Reddit мониторинга.

```bash
curl http://localhost:3018/api/social/reddit/status
```

**Response:**

```json
{
  "success": true,
  "data": {
    "running": true,
    "postsLimit": 25,
    "subreddits": 8
  }
}
```

---

#### POST `/api/social/reddit/scrape`

Ручной парсинг Reddit для конкретного символа (существующий endpoint).

```bash
curl -X POST http://localhost:3018/api/social/reddit/scrape \
  -H "Content-Type: application/json" \
  -d '{"symbol": "BTCUSDT", "limit": 25}'
```

---

#### POST `/api/social/reddit/monitor`

Ручной запуск мониторинга всех subreddits (существующий endpoint).

```bash
curl -X POST http://localhost:3018/api/social/reddit/monitor \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'
```

---

## Логирование

### Уровни логов

Все скраперы теперь имеют детальное логирование:

- **info**: Начало/конец операций, статистика
- **debug**: Детали процесса (загрузка страниц, скролл, извлечение данных)
- **warn**: Предупреждения (нет данных, проблемы подключения)
- **error**: Ошибки с полным контекстом

### Примеры логов

**Reddit scraping:**

```
[INFO] Starting subreddit scrape {subreddit: "CryptoCurrency", limit: 25, sortBy: "hot"}
[DEBUG] Subreddit page loaded {subreddit: "CryptoCurrency", timeMs: 1234}
[DEBUG] Posts found {subreddit: "CryptoCurrency"}
[DEBUG] Scrolling subreddit {subreddit: "CryptoCurrency", iterations: 5}
[DEBUG] Posts extracted {subreddit: "CryptoCurrency", extracted: 30}
[INFO] Subreddit scrape completed successfully {subreddit: "CryptoCurrency", found: 25, totalExtracted: 30, durationMs: 5432, topScore: 1523}
```

**News scraping:**

```
[INFO] Starting CoinDesk scraping {source: "coindesk", limit: 20}
[DEBUG] Navigating to CoinDesk {url: "https://www.coindesk.com"}
[INFO] Found article links on homepage {count: 35}
[DEBUG] Scraped article {title: "Bitcoin Surges Past...", url: "https://..."}
[INFO] CoinDesk scraping completed {articlesScraped: 18, target: 20}
[INFO] Stored articles in ClickHouse {count: 18}
[INFO] Analyzing articles with AI {count: 18}
```

**Twitter scraping:**

```
[INFO] Starting user tweets scrape {username: "VitalikButerin", limit: 10, url: "https://twitter.com/VitalikButerin"}
[DEBUG] User page loaded {username: "VitalikButerin", timeMs: 2100}
[DEBUG] User tweets found {username: "VitalikButerin"}
[DEBUG] Starting scroll iterations {username: "VitalikButerin", maxScrolls: 20, target: 10}
[DEBUG] Scroll iteration completed {username: "VitalikButerin", iteration: 1, newTweets: 8, totalTweets: 8}
[INFO] User tweets scrape completed successfully {username: "VitalikButerin", found: 10, totalExtracted: 15, durationMs: 12345, avgEngagement: 543}
```

**Telegram:**

```
[INFO] Starting Telegram userbot...
[INFO] Userbot авторизован {timeMs: 1234}
[INFO] Userbot запущен успешно {totalTimeMs: 2345, monitoringInterval: 30000}
[INFO] Subscribing to Telegram channels {totalChannels: 5, activeChannels: 5}
[DEBUG] New message received {channel: "@cryptonews", messageId: 12345, textLength: 234, views: 1500}
[INFO] Message published to NATS {channel: "@cryptonews", messageId: 12345, textPreview: "Bitcoin price reaches..."}
```

---

## Проверка данных в ClickHouse

### Проверить новости

```sql
-- Последние новости
SELECT
    title,
    source,
    published_at,
    symbols,
    categories
FROM aladdin.crypto_news
ORDER BY published_at DESC
LIMIT 10;

-- Статистика по источникам
SELECT
    source,
    count() as articles,
    countIf(ai_analyzed_at IS NOT NULL) as analyzed,
    avgIf(ai_sentiment_score, ai_sentiment_score IS NOT NULL) as avg_sentiment
FROM aladdin.crypto_news
GROUP BY source;
```

### Проверить Reddit посты

```sql
-- Последние посты
SELECT
    subreddit,
    title,
    score,
    num_comments,
    datetime,
    symbols
FROM aladdin.reddit_posts
ORDER BY datetime DESC
LIMIT 10;

-- Топ постов по subreddit
SELECT
    subreddit,
    count() as posts,
    avg(score) as avg_score,
    sum(num_comments) as total_comments
FROM aladdin.reddit_posts
WHERE datetime >= now() - INTERVAL 24 HOUR
GROUP BY subreddit
ORDER BY posts DESC;
```

### Проверить AI-анализированный контент

```sql
-- Последние AI-анализированные тексты
SELECT
    content_type,
    source,
    title,
    ai_sentiment_score,
    ai_confidence,
    ai_method,
    analyzed_at
FROM aladdin.ai_analyzed_content
ORDER BY analyzed_at DESC
LIMIT 20;

-- Статистика по типам контента
SELECT
    content_type,
    count() as total,
    countIf(ai_method = 'gpt') as gpt_analyzed,
    avg(ai_sentiment_score) as avg_sentiment
FROM aladdin.ai_analyzed_content
WHERE analyzed_at >= now() - INTERVAL 24 HOUR
GROUP BY content_type;
```

---

## Мониторинг

### Проверить что все работает

```bash
# Health checks
curl http://localhost:3018/api/social/news/health
curl http://localhost:3018/api/social/reddit/health
curl http://localhost:3018/api/social/twitter/health
curl http://localhost:3018/api/social/telegram/health

# Статусы
curl http://localhost:3018/api/social/news/status
curl http://localhost:3018/api/social/reddit/status
```

### Смотреть логи

```bash
# Если запущено через pm2/systemd
journalctl -u scraper -f

# Если запущено вручную
# Логи выводятся в консоль
```

---

## Troubleshooting

### Парсинг не работает

1. **Проверьте переменные окружения** - убедитесь что `REDDIT_SCRAPE_INTERVAL` и `NEWS_SCRAPE_INTERVAL` установлены
2. **Проверьте логи** - смотрите на ошибки в консоли
3. **Проверьте ClickHouse** - убедитесь что сервер доступен
4. **Проверьте таблицы** - выполните миграции из `docs/migrations/`

### Puppeteer ошибки

Если Puppeteer не запускается:

```bash
# Установите зависимости для Chrome
# Ubuntu/Debian
sudo apt-get install -y \
  chromium-browser \
  libxss1 \
  libasound2 \
  libgbm1

# macOS
# Chrome устанавливается автоматически
```

### Нет данных в ClickHouse

```bash
# Проверьте что таблицы созданы
clickhouse-client --query "SHOW TABLES FROM aladdin"

# Создайте таблицы если нужно
clickhouse-client --multiquery < docs/migrations/crypto-news.sql
clickhouse-client --multiquery < docs/migrations/reddit-posts.sql
clickhouse-client --multiquery < docs/migrations/ai-analyzed-content.sql
```

---

## Добавление новых источников новостей

Чтобы добавить новый источник (например, Cointelegraph):

1. **Создайте класс источника:**

```typescript
// apps/scraper/src/news/sources/cointelegraph.ts
import type { NewsArticle } from "../types"
import { BaseNewsSource } from "./base"

export class CointelegraphSource extends BaseNewsSource {
  name = "cointelegraph"
  baseUrl = "https://cointelegraph.com"

  async scrape(limit: number): Promise<NewsArticle[]> {
    // Реализация парсинга Cointelegraph
    // Используйте примеры из coindesk.ts
  }
}
```

2. **Зарегистрируйте в NewsService:**

```typescript
// apps/scraper/src/news/service.ts
import { CointelegraphSource } from "./sources/cointelegraph";

constructor(...) {
  // ...
  this.registerSource(new CointelegraphSource(logger));
}
```

3. **Готово!** Источник автоматически будет парситься периодически.

---

## Следующие шаги

- [ ] Добавить больше источников новостей (Cointelegraph, Bitcoin.com, etc.)
- [ ] Реализовать real-time streaming для Twitter
- [ ] Добавить Telegram bot для алертов
- [ ] Discord integration
- [ ] Fine-tune GPT модель на crypto данных
- [ ] Sentiment history tracking
