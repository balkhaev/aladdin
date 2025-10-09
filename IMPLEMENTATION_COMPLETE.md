# Реализация Системы Очередей и Админки для Скраперов ✅

## Что было сделано

### 1. ✅ Система Очередей NATS JetStream

**Файлы:**

- `apps/scraper/src/queue/types.ts` - Типы для задач и результатов
- `apps/scraper/src/queue/scraper-queue-manager.ts` - Менеджер очередей
- `apps/scraper/src/queue/index.ts` - Экспорты

**Возможности:**

- ✅ Управление очередями для всех скраперов
- ✅ Retry механизм с экспоненциальным backoff (3 попытки)
- ✅ Приоритеты задач (1-10)
- ✅ Статистика в реальном времени
- ✅ Периодический парсинг через очереди
- ✅ Хранение истории в ClickHouse

### 2. ✅ ClickHouse Таблицы

**Файл:** `docs/migrations/scraper-jobs.sql`

**Таблицы:**

- `aladdin.scraper_jobs` - История всех задач
- `aladdin.scraper_job_results` - Результаты выполнения
- `aladdin.scraper_job_stats` - Материализованное представление со статистикой

**Создание таблиц:**

```bash
docker compose exec clickhouse clickhouse-client --query "$(cat docs/migrations/scraper-jobs.sql)"
```

### 3. ✅ Интеграция в Scraper Service

**Файл:** `apps/scraper/src/service.ts`

**Изменения:**

- ✅ Добавлен `ScraperQueueManager`
- ✅ Регистрация handlers для Reddit и News
- ✅ Планирование периодических задач
- ✅ Fallback на старый метод если очереди недоступны
- ✅ Методы для ручного запуска задач

### 4. ✅ API Endpoints

**Файл:** `apps/scraper/src/index.ts`

**Новые endpoints:**

- ✅ `GET /api/social/queues/stats` - Статистика всех очередей
- ✅ `GET /api/social/queues/:queueName/stats` - Статистика конкретной очереди
- ✅ `POST /api/social/queues/trigger` - Ручной запуск парсинга
- ✅ `GET /api/social/scrapers/overview` - Полный обзор всех скраперов

### 5. ✅ Админская Страница

**Файл:** `apps/web/app/(auth)/admin/scrapers/page.tsx`

**Доступ:** `/admin/scrapers` (только для admin)

**Компоненты страницы:**

- Queue Statistics - Статистика очередей в реальном времени
- Scraper Control Panel - Ручное управление скраперами
- About Section - Информация о системе очередей

### 6. ✅ React Компоненты

**Файлы:**

- `apps/web/components/scrapers/scraper-stats-card.tsx` - Карточки статистики
- `apps/web/components/scrapers/scraper-control-panel.tsx` - Панель управления

**Возможности:**

- ✅ Auto-refresh каждые 10 секунд
- ✅ Ручной запуск парсинга
- ✅ Визуализация статусов (Running/Idle)
- ✅ Success Rate прогресс-бар
- ✅ Красивый UI с индикаторами

### 7. ✅ Навигация

**Файлы:**

- `apps/web/components/app-sidebar.tsx` - Добавлена ссылка "Скраперы" в админ раздел
- `apps/web/app/(auth)/layout.tsx` - Добавлен заголовок страницы

### 8. ✅ Документация

**Файлы:**

- `apps/scraper/QUEUE_SYSTEM_GUIDE.md` - Полная документация по системе очередей
- `apps/web/ADMIN_SCRAPERS_GUIDE.md` - Руководство по админской панели
- `IMPLEMENTATION_COMPLETE.md` - Этот файл

## Как использовать

### 1. Создать ClickHouse таблицы

```bash
# Убедитесь что docker запущен
docker compose up -d

# Создать таблицы
docker compose exec clickhouse clickhouse-client --query "$(cat docs/migrations/scraper-jobs.sql)"
```

### 2. Запустить Scraper Service

```bash
cd apps/scraper
bun run dev
```

Скрапер автоматически:

- Инициализирует очереди
- Запустит периодический парсинг Reddit (каждые 15 минут)
- Запустит периодический парсинг News (каждые 10 минут)

### 3. Открыть Админку

1. Войдите как администратор
2. Перейдите на `/admin/scrapers`
3. Наблюдайте статистику в реальном времени
4. Используйте кнопки для ручного запуска парсинга

## Environment Variables

```bash
# Периодичность парсинга (в миллисекундах)
REDDIT_SCRAPE_INTERVAL=900000  # 15 минут
NEWS_SCRAPE_INTERVAL=600000    # 10 минут

# Лимиты парсинга
REDDIT_POSTS_LIMIT=25
NEWS_ARTICLES_LIMIT=20
```

## Архитектура

```
┌─────────────────┐
│  User/Admin UI  │
│  /admin/scrapers│
└────────┬────────┘
         │
         │ HTTP
         ↓
┌─────────────────┐
│   Gateway API   │
│  /api/social/*  │
└────────┬────────┘
         │
         │ HTTP
         ↓
┌─────────────────────────────────┐
│      Scraper Service            │
│                                 │
│  ┌──────────────────────────┐  │
│  │ ScraperQueueManager      │  │
│  │  - Register handlers     │  │
│  │  - Schedule jobs         │  │
│  │  - Process jobs          │  │
│  │  - Retry mechanism       │  │
│  └──────┬───────────────────┘  │
└─────────┼──────────────────────┘
          │
          ↓
┌─────────────────────┐
│   NATS JetStream    │
│  - scraper.reddit   │
│  - scraper.news     │
│  - scraper.twitter  │
│  - scraper.telegram │
└─────────┬───────────┘
          │
          ↓
┌─────────────────────┐
│    ClickHouse       │
│  - scraper_jobs     │
│  - job_results      │
│  - job_stats        │
└─────────────────────┘
```

## Очереди

### scraper.reddit

- **Интервал:** 15 минут
- **Лимит:** 25 постов
- **Subreddits:** 8 (CryptoCurrency, Bitcoin, ethereum, etc.)
- **Priority:** 5 (автоматические), 10 (ручные)

### scraper.news

- **Интервал:** 10 минут
- **Лимит:** 20 статей
- **Источники:** CoinDesk
- **Priority:** 5 (автоматические), 10 (ручные)

### scraper.twitter (будет добавлен)

- **Интервал:** 10 минут
- **Лимит:** 10 твитов
- **Influencers:** VitalikButerin, cz_binance, etc.

### scraper.telegram (будет добавлен)

- **Тип:** Event-driven (не периодический)
- **Каналы:** Crypto channels

## Мониторинг

### Real-time обновления

- ✅ Статистика обновляется каждые 10 секунд
- ✅ WebSocket для live обновлений
- ✅ Toast уведомления при ручном запуске

### Метрики

- **Pending** - Задачи в очереди
- **Active** - Задачи в процессе
- **Completed** - Успешные задачи
- **Failed** - Задачи с ошибками
- **Success Rate** - Процент успешности

### ClickHouse Queries

```sql
-- Статистика за последний час
SELECT
  queue_name,
  count() as total,
  countIf(success = 1) as successful,
  countIf(success = 0) as failed,
  avgIf(duration_ms, success = 1) as avg_duration
FROM aladdin.scraper_job_results
WHERE completed_at >= now() - INTERVAL 1 HOUR
GROUP BY queue_name;

-- Последние failed задачи
SELECT
  job_id,
  queue_name,
  error,
  completed_at
FROM aladdin.scraper_job_results
WHERE success = 0
ORDER BY completed_at DESC
LIMIT 10;
```

## Retry Механизм

- **Max attempts:** 3
- **Backoff:** Экспоненциальный
  - Attempt 1 fails → retry after 5s
  - Attempt 2 fails → retry after 10s
  - Attempt 3 fails → marked as failed

## Логирование

Все операции логируются:

```
[INFO] Queue initialized {queue: "scraper.reddit"}
[INFO] Handler registered {queue: "scraper.reddit"}
[INFO] Job added to queue {queue: "scraper.reddit", jobId: "xxx"}
[INFO] Processing job {queue: "scraper.reddit", jobId: "xxx", attempt: 1}
[INFO] Job completed {jobId: "xxx", itemsProcessed: 15, durationMs: 5234}
```

## Расширение системы

### Добавление нового скрапера

1. Создать handler:

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

2. Запланировать периодический запуск:

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

3. Добавить в UI (опционально):

- Добавить карточку в `ScraperControlPanel`
- Добавить статистику в `ScraperStatsCard`

## Связанная документация

- [Queue System Guide](apps/scraper/QUEUE_SYSTEM_GUIDE.md)
- [Admin Scrapers Guide](apps/web/ADMIN_SCRAPERS_GUIDE.md)
- [News & Reddit Scraping Guide](apps/scraper/NEWS_REDDIT_GUIDE.md)

## Чек-лист

✅ NATS JetStream очереди настроены
✅ ScraperQueueManager создан и интегрирован
✅ ClickHouse таблицы и миграции готовы
✅ API endpoints для управления и статистики
✅ Админская страница /admin/scrapers
✅ React компоненты для UI
✅ Retry механизм с exponential backoff
✅ Периодический парсинг через очереди
✅ Логирование всех операций
✅ Документация полная
✅ Линтер ошибки исправлены

## Следующие шаги (опционально)

1. **Twitter Queue** - Добавить Twitter в систему очередей
2. **Telegram Queue** - Добавить Telegram в систему очередей
3. **Alerts** - Добавить email/slack алерты при проблемах
4. **Dashboard** - Графики и аналитика в админке
5. **Rate Limiting** - Умное управление rate limits
6. **Health Checks** - Endpoint для проверки здоровья очередей

---

**Статус:** ✅ Готово к использованию
**Дата:** 2025-01-09
**Версия:** 1.0.0
