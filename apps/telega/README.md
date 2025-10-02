# Telega - Telegram Channel Message Forwarder

Простой сервис для подписки на Telegram каналы и пересылки сообщений в NATS.

## Что делает

- ✅ Подписывается на множественные Telegram каналы
- ✅ Получает все сообщения из каналов в реальном времени
- ✅ Публикует сырые сообщения в NATS топик `telega.message`
- ✅ Хранит подписки в Redis (автоматическая переподписка при перезапуске)
- ✅ REST API для управления подписками и получения истории сообщений

## Что НЕ делает

- ❌ НЕ парсит сигналы
- ❌ НЕ работает с базой данных
- ❌ НЕ анализирует содержимое сообщений

Это просто форвардер сообщений из Telegram в NATS. Всю обработку делают другие сервисы.

## Требования

- **Redis** - для хранения подписок на каналы
- **NATS** - для публикации сообщений
- **Telegram API credentials** - API_ID и API_HASH

## Установка

```bash
cd apps/telega
bun install
```

## Конфигурация

Создайте `.env`:

```bash
# Server
PORT=3005

# Telegram
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
TELEGRAM_SESSION_STRING=your_session_string

# Redis (для хранения подписок)
REDIS_URL=redis://localhost:6379

# NATS (для публикации сообщений)
NATS_URL=nats://localhost:4222
```

### Получение SESSION_STRING

```bash
bun run scripts/gen-session.ts
```

Следуйте инструкциям для авторизации через Telegram.

## Запуск

```bash
# Development
bun run dev

# Production
bun run start
```

## API Endpoints

### Channel Management

```bash
# Подписаться на канал
POST /channels/subscribe
{
  "channelId": "cryptosignalschannel"
}

# Отписаться от канала
POST /channels/unsubscribe
{
  "channelId": "cryptosignalschannel"
}

# Список всех подписок
GET /channels

# Активировать подписку
POST /channels/:channelId/activate

# Деактивировать подписку
POST /channels/:channelId/deactivate
```

### Messages

```bash
# Получить последние N сообщений из канала
GET /channels/:channelId/messages?limit=10

# Получить последние сообщения из всех каналов
GET /channels/messages/recent?limit=5
```

### Service Status

```bash
# Детальный статус
GET /status

# Health check
GET /health
```

## NATS Integration

Все сообщения публикуются в топик: **`telega.message`**

### Формат сообщения

```json
{
  "channelId": "cryptosignalschannel",
  "messageId": 12345,
  "text": "📩 #BTCUSDT 1h | Short-Term...",
  "date": 1696411200,
  "views": 1234,
  "forwards": 10,
  "timestamp": 1696411200000
}
```

### Подписка на сообщения

```typescript
import { createNatsClient } from "@aladdin/shared/nats"

const nats = await createNatsClient({
  servers: "nats://localhost:4222",
})

await nats.subscribe("telega.message", (message) => {
  console.log(`[${message.channelId}] ${message.text}`)
  // Здесь можете парсить, анализировать, сохранять и т.д.
})
```

## Workflow

```
1. Подписаться на канал через API
   ↓
2. Telega подписывается на канал в Telegram
   ↓
3. При получении нового сообщения → публикует в NATS
   ↓
4. Другие сервисы получают сообщение из NATS
   ↓
5. Обрабатывают по своей логике
```

## Архитектура

```
┌─────────────────┐
│  Telegram API   │
│    (channels)   │
└────────┬────────┘
         │
         ↓
┌─────────────────┐      ┌──────────┐
│     Telega      │←────→│  Redis   │
│   (userbot)     │      │ (subs)   │
└────────┬────────┘      └──────────┘
         │
         ↓
┌─────────────────┐
│      NATS       │
│  telega.message │
└────────┬────────┘
         │
         ↓
    ┌────┴─────┬─────────┬──────────┐
    │          │         │          │
┌───▼───┐ ┌───▼───┐ ┌──▼────┐ ┌───▼────┐
│Parser │ │Logger │ │Storage│ │Analytics│
└───────┘ └───────┘ └───────┘ └────────┘
```

## Примеры

### Подписка на канал

```bash
curl -X POST http://localhost:3005/channels/subscribe \
  -H "Content-Type: application/json" \
  -d '{"channelId": "cryptosignalschannel"}'
```

### Получение последних сообщений

```bash
curl http://localhost:3005/channels/cryptosignalschannel/messages?limit=10
```

### Получение сообщений из всех каналов

```bash
curl http://localhost:3005/channels/messages/recent?limit=5
```

## Bruno Collection

REST API запросы доступны в папке `bruno/`. Откройте её в [Bruno](https://www.usebruno.com/).

## Особенности

- 🔄 **Автоматическая переподписка** - при перезапуске загружает подписки из Redis
- 🔌 **Auto-reconnect** - мониторинг соединения с Telegram каждые 30 секунд
- 📡 **Fire-and-forget** - NATS публикация асинхронная, не блокирует обработку
- 💾 **Persistent subscriptions** - подписки сохраняются в Redis
- 🚀 **Простота** - никакой логики обработки, только форвардинг

## Troubleshooting

### Userbot не подключается

- Проверьте `TELEGRAM_API_ID` и `TELEGRAM_API_HASH`
- Сгенерируйте новый SESSION_STRING: `bun run scripts/gen-session.ts`

### Сообщения не публикуются в NATS

- Проверьте `NATS_URL` в `.env`
- Проверьте что NATS сервер запущен
- Посмотрите логи: `tail -f /logs/telega-*.log`

### Подписки не сохраняются

- Проверьте `REDIS_URL` в `.env`
- Проверьте что Redis сервер запущен: `redis-cli ping`

## Ports

- **3005** - HTTP API (по умолчанию)

## Links

- [Bruno Collection](./bruno/) - API requests
- [Scripts](./scripts/) - Utility scripts
