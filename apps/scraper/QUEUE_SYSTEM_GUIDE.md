# Система Очередей для Скраперов

## Обзор

Все скраперы (Reddit, News, Twitter, Telegram) теперь используют NATS JetStream очереди для надежной обработки задач с автоматическими retry и мониторингом.

## Архитектура

### Компоненты

1. **ScraperQueueManager** (`apps/scraper/src/queue/scraper-queue-manager.ts`)

   - Управляет всеми очередями
   - Обрабатывает задачи (jobs)
   - Хранит статистику
   - Поддерживает retry с экспоненциальным backoff

2. **NATS JetStream**

   - Персистентное хранилище сообщений
   - Гарантированная доставка
   - Поддержка приоритетов

3. **ClickHouse Tables**
   - `aladdin.scraper_jobs` - история всех задач
   - `aladdin.scraper_job_results` - результаты выполнения
   - `aladdin.scraper_job_stats` - агрегированная статистика

## Очереди

### Список Очередей

- `scraper.reddit` - Парсинг Reddit постов
- `scraper.news` - Парсинг новостей (CoinDesk)
- `scraper.twitter` - Парсинг твитов (будет добавлен)
- `scraper.telegram` - Обработка Telegram сообщений (будет добавлен)

### Структура Job

```typescript
type ScraperJob = {
  id: string
  type: "reddit" | "twitter" | "news" | "telegram"
  priority: number // 1-10 (10 = highest)
  data: Record<string, unknown>
  createdAt: Date
  attempts: number
  maxAttempts: number
}
```

### Структура Result

```typescript
type ScraperJobResult = {
  jobId: string
  success: boolean
  itemsProcessed: number
  durationMs: number
  error?: string
  completedAt: Date
}
```

## Конфигурация

### Environment Variables

```bash
# Периодичность парсинга (в миллисекундах)
REDDIT_SCRAPE_INTERVAL=900000  # 15 минут
NEWS_SCRAPE_INTERVAL=600000    # 10 минут

# Лимиты парсинга
REDDIT_POSTS_LIMIT=25
NEWS_ARTICLES_LIMIT=20
```

## API Endpoints

### Статистика Очередей

#### GET `/api/social/queues/stats`

Получить статистику по всем очередям.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "name": "scraper.reddit",
      "pending": 0,
      "active": 1,
      "completed": 145,
      "failed": 3
    }
  ]
}
```

#### GET `/api/social/queues/:queueName/stats`

Получить статистику конкретной очереди.

**Example:** `GET /api/social/queues/reddit/stats`

**Response:**

```json
{
  "success": true,
  "data": {
    "name": "scraper.reddit",
    "pending": 0,
    "active": 1,
    "completed": 145,
    "failed": 3,
    "lastProcessedAt": "2025-01-09T10:30:00Z"
  }
}
```

### Управление Задачами

#### POST `/api/social/queues/trigger`

Ручной запуск парсинга.

**Request:**

```json
{
  "type": "reddit",
  "data": {}
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "jobId": "manual_reddit_1704789000_abc123",
    "queued": true
  }
}
```

### Обзор Всех Скраперов

#### GET `/api/social/scrapers/overview`

Получить полный обзор всех скраперов.

**Response:**

```json
{
  "success": true,
  "data": {
    "queues": [
      {
        "name": "scraper.reddit",
        "pending": 0,
        "active": 1,
        "completed": 145,
        "failed": 3
      },
      {
        "name": "scraper.news",
        "pending": 1,
        "active": 0,
        "completed": 98,
        "failed": 1
      }
    ],
    "reddit": {
      "running": true,
      "postsLimit": 25,
      "subreddits": 8
    },
    "news": {
      "running": true,
      "articlesLimit": 20,
      "sources": [{ "name": "coindesk", "enabled": true }]
    },
    "timestamp": "2025-01-09T10:30:00Z"
  }
}
```

## Админский Интерфейс

### Страница: `/admin/scrapers`

Доступна только для администраторов. Показывает:

1. **Queue Statistics**

   - Статистика по всем очередям в реальном времени
   - Pending, Active, Completed, Failed задачи
   - Success Rate

2. **Scraper Control Panel**
   - Ручной запуск парсинга
   - Статус каждого скрапера
   - Лимиты и конфигурация

### Компоненты

- `ScraperStatsCard` - Статистика очередей
- `ScraperControlPanel` - Панель управления

## Retry Механизм

### Настройки

- **Max Attempts:** 3 попытки
- **Backoff:** Экспоненциальный (5s, 10s, 15s)
- **Auto-retry:** Автоматический при неудаче

### Пример

```
Attempt 1: Job fails → retry after 5s
Attempt 2: Job fails → retry after 10s
Attempt 3: Job fails → marked as failed permanently
```

## ClickHouse Queries

### Статистика по часам

```sql
SELECT
  queue_name,
  toStartOfHour(completed_at) as hour,
  count() as total,
  countIf(success = 1) as successful,
  countIf(success = 0) as failed,
  avgIf(duration_ms, success = 1) as avg_duration,
  sum(items_processed) as total_items
FROM aladdin.scraper_job_results
WHERE completed_at >= now() - INTERVAL 24 HOUR
GROUP BY queue_name, hour
ORDER BY hour DESC, queue_name;
```

### Последние задачи

```sql
SELECT
  job_id,
  queue_name,
  success,
  items_processed,
  duration_ms,
  error,
  completed_at
FROM aladdin.scraper_job_results
ORDER BY completed_at DESC
LIMIT 100;
```

### Failed задачи за последний час

```sql
SELECT
  job_id,
  queue_name,
  error,
  duration_ms,
  completed_at
FROM aladdin.scraper_job_results
WHERE success = 0
  AND completed_at >= now() - INTERVAL 1 HOUR
ORDER BY completed_at DESC;
```

## Мониторинг

### Real-time Updates

- Статистика обновляется каждые 10 секунд через WebSocket
- NATS публикует события:
  - `jobs.scraper.*` - новые задачи
  - `results.scraper.*` - результаты выполнения
  - `scraper.stats` - статистика очередей

### Логи

Все операции логируются:

```
[INFO] Job added to queue {queue: "scraper.reddit", jobId: "xxx", type: "reddit"}
[INFO] Processing job {queue: "scraper.reddit", jobId: "xxx", attempt: 1}
[INFO] Job completed {queue: "scraper.reddit", jobId: "xxx", itemsProcessed: 15, durationMs: 5234}
```

## Миграция

### Создание таблиц

```bash
# Запустить миграцию
docker compose exec clickhouse clickhouse-client --query "$(cat docs/migrations/scraper-jobs.sql)"
```

## Расширение

### Добавление нового скрапера

1. **Зарегистрировать handler:**

```typescript
queueManager.registerHandler(
  "scraper.myservice",
  async (job: ScraperJob): Promise<ScraperJobResult> => {
    // Ваша логика
    return {
      jobId: job.id,
      success: true,
      itemsProcessed: 10,
      durationMs: 1000,
      completedAt: new Date(),
    }
  }
)
```

2. **Запланировать периодическое выполнение:**

```typescript
await queueManager.schedulePeriodicJob(
  "scraper.myservice",
  {
    type: "myservice",
    priority: 5,
    data: {},
    maxAttempts: 3,
  },
  300_000 // 5 минут
)
```

## Troubleshooting

### Задачи не выполняются

1. Проверьте NATS подключение:

   ```bash
   curl http://localhost:8222/varz
   ```

2. Проверьте логи:

   ```bash
   bun --watch apps/scraper/src/index.ts
   ```

3. Проверьте очереди в админке: `/admin/scrapers`

### Много failed задач

1. Проверьте ClickHouse:

   ```sql
   SELECT * FROM aladdin.scraper_job_results
   WHERE success = 0
   ORDER BY completed_at DESC
   LIMIT 10;
   ```

2. Увеличьте timeout или maxAttempts

3. Проверьте источники данных (Reddit API, CoinDesk доступность)

## Best Practices

1. **Приоритеты:**

   - Manual jobs: 10
   - Scheduled jobs: 5
   - Background tasks: 1

2. **Лимиты:**

   - Не делайте слишком большие батчи (max 50 items)
   - Используйте pagination для больших объемов

3. **Error Handling:**

   - Всегда возвращайте понятные error messages
   - Логируйте детали для отладки

4. **Мониторинг:**
   - Регулярно проверяйте failed задачи
   - Следите за success rate (должен быть > 95%)
   - Используйте alerts для критических ошибок
