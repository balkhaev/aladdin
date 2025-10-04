# Telega Refactoring Summary

## Что было сделано

Telega был полностью переработан из сервиса парсинга сигналов в простой форвардер сообщений.

## Удалено

### Файлы

- ❌ `src/store.ts` - работа с PostgreSQL
- ❌ `src/parse.ts` - парсинг торговых сигналов
- ❌ `CHANNELS_API.md` - старая документация
- ❌ `MIGRATION_GUIDE.md` - старая миграция
- ❌ `API_QUICK_REFERENCE.md` - старая справка

### Зависимости

- ❌ `@aladdin/database` - больше не работаем с базой
- ❌ `node-telegram-bot-api` - не используется

### Переменные окружения

- ❌ `DATABASE_URL` - база данных больше не нужна

### API Endpoints

- ❌ `GET /signals` - парсинг сигналов удален

## Изменено

### `src/userbot.ts`

**Было:**

- Получал сообщения из Telegram
- Парсил сигналы через `parseSignalMessage()`
- Сохранял в базу через `addSignal()`
- Вызывал callback для webhook

**Стало:**

- Получает сообщения из Telegram
- Публикует сырые сообщения в NATS (`telega.message`)
- Без парсинга, без базы данных
- Простой форвардер

### `src/service.ts`

**Было:**

- Инициализировал PostgreSQL
- Работал с базой данных
- Закрывал соединение с базой

**Стало:**

- Только Redis и NATS
- Никакой работы с базой
- Упрощенная инициализация

### `src/index.ts`

**Было:**

- Эндпоинт `/signals` для получения сохраненных сигналов
- Зависимость от PostgreSQL
- Импорт `store.ts`

**Стало:**

- Убран `/signals`
- Только управление каналами и получение сообщений
- Зависимость только от NATS и Redis

### `package.json`

**Было:**

```json
{
  "dependencies": {
    "@aladdin/database": "workspace:*",
    "node-telegram-bot-api": "^0.61.0"
  }
}
```

**Стало:**

```json
{
  "dependencies": {
    "ioredis": "^5.3.2",
    "telegram": "^2.26.22"
  }
}
```

### `.env`

**Было:**

```bash
DATABASE_URL=postgres://...
TELEGRAM_CHANNEL_ID=...
```

**Стало:**

```bash
REDIS_URL=redis://...
NATS_URL=nats://...
# TELEGRAM_CHANNEL_ID больше не нужен
```

## Добавлено

### Документация

- ✅ `README.md` - новая документация
- ✅ `NATS_INTEGRATION.md` - интеграция с NATS
- ✅ `QUICKSTART.md` - быстрый старт
- ✅ `REFACTORING_SUMMARY.md` - это файл
- ✅ `.env.example` - обновленный пример

### Функциональность

- ✅ Публикация в NATS топик `telega.message`
- ✅ REST API для получения истории сообщений
- ✅ Поддержка множественных каналов через Redis
- ✅ Автоматическая переподписка при перезапуске

## Архитектура

### Было

```
Telegram → Telega → Parse → Database → Webhook
                      ↓
                   Signals
```

### Стало

```
Telegram → Telega → NATS → [Any Service]
            ↓                    ↓
         Redis            Parse/Store/Analyze
```

## NATS Message Format

### Было (через webhook)

```json
{
  "pair": "BTCUSDT",
  "timeframe": "1h",
  "entry": {...},
  "targets": [...],
  "stop_loss": 49000
}
```

### Стало (сырое сообщение)

```json
{
  "channelId": "cryptosignalschannel",
  "messageId": 12345,
  "text": "📩 #BTCUSDT 1h | Short-Term...",
  "date": 1696411200,
  "views": 1234,
  "forwards": 10,
  "timestamp": 1696411200500
}
```

## Преимущества

### 1. Разделение ответственности

- Telega: только получение и пересылка
- Другие сервисы: парсинг, анализ, сохранение

### 2. Гибкость

- Любой сервис может подписаться на `telega.message`
- Каждый парсит/обрабатывает по-своему
- Множество обработчиков одновременно

### 3. Простота

- Меньше кода
- Меньше зависимостей
- Проще поддерживать

### 4. Масштабируемость

- NATS обрабатывает 10000+ msg/sec
- Множество подписчиков без нагрузки на Telega
- Легко добавлять новые обработчики

### 5. Надежность

- Если обработчик упал - Telega продолжает работать
- NATS автоматически переподключается
- Redis сохраняет подписки при перезапуске

## Миграция существующих сервисов

### Если у вас был webhook

**Было:**

```typescript
app.post("/webhook/telega", async (req, res) => {
  const signal = req.body
  await processSignal(signal)
})
```

**Стало:**

```typescript
import { createNatsClient } from "@aladdin/shared/nats"

const nats = await createNatsClient()
await nats.subscribe("telega.message", async (message) => {
  const signal = parseSignal(message.text)
  if (signal) {
    await processSignal(signal)
  }
})
```

### Если читали из базы

**Было:**

```typescript
const signals = await prisma.signal.findMany({
  where: { pair: "BTCUSDT" },
})
```

**Стало:**
Создайте свой сервис, который:

1. Подписывается на `telega.message`
2. Парсит сигналы
3. Сохраняет в свою базу
4. Читает оттуда

## Что делать дальше

### 1. Создать Signal Parser Service

```typescript
// services/signal-parser/src/index.ts
import { createNatsClient } from "@aladdin/shared/nats"
import { parseSignal } from "./parser"
import { saveSignal } from "./database"

const nats = await createNatsClient()

await nats.subscribe("telega.message", async (message) => {
  const signal = parseSignal(message.text)
  if (signal) {
    await saveSignal({
      ...signal,
      source: message.channelId,
    })
  }
})
```

### 2. Создать Analytics Service

```typescript
// services/analytics/src/index.ts
await nats.subscribe("telega.message", (message) => {
  metrics.increment(`messages.${message.channelId}`)

  if (isSignal(message.text)) {
    metrics.increment(`signals.${message.channelId}`)
  }
})
```

### 3. Создать Notification Service

```typescript
// services/notifications/src/index.ts
await nats.subscribe("telega.message", async (message) => {
  if (isImportant(message.text)) {
    await sendNotification(message)
  }
})
```

## Проверка работы

```bash
# 1. Запустить Telega
cd apps/telega
bun run dev

# 2. Подписаться на канал
curl -X POST http://localhost:3005/channels/subscribe \
  -d '{"channelId": "cryptosignalschannel"}'

# 3. Подписаться на NATS (в другом терминале)
nats sub telega.message

# 4. Отправить тестовое сообщение в канал
# Должны увидеть в NATS CLI

# 5. Проверить историю
curl http://localhost:3005/channels/cryptosignalschannel/messages?limit=5
```

## Итоги

✅ Telega стал простым форвардером сообщений  
✅ Вся логика вынесена в отдельные сервисы  
✅ NATS обеспечивает pub/sub архитектуру  
✅ Redis хранит подписки  
✅ Простота, гибкость, масштабируемость

Теперь Telega делает одну вещь и делает её хорошо: получает сообщения из Telegram и отправляет в NATS. Всё остальное - задача других сервисов.
