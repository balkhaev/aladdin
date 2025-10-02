# Telega Quick Start

## 1. Установка

```bash
cd apps/telega
bun install
```

## 2. Получение Telegram credentials

1. Перейдите на https://my.telegram.org/apps
2. Создайте приложение
3. Скопируйте `API_ID` и `API_HASH`

## 3. Генерация Session String

```bash
bun run scripts/gen-session.ts
```

Следуйте инструкциям:

- Введите номер телефона
- Введите код из Telegram
- Скопируйте Session String

## 4. Настройка .env

Создайте `.env` (скопируйте из `.env.example`):

```bash
PORT=3005

TELEGRAM_API_ID=29080502
TELEGRAM_API_HASH=13d2119c946ad0c874d505ad0845ff03
TELEGRAM_SESSION_STRING="ваш_session_string"

REDIS_URL=redis://localhost:6379
NATS_URL=nats://localhost:4222
```

## 5. Запуск зависимостей

### Redis

```bash
# Docker
docker run -d -p 6379:6379 redis:latest

# Или локально
redis-server
```

### NATS

```bash
# Docker
docker run -d -p 4222:4222 nats:latest

# Или локально
nats-server
```

## 6. Запуск Telega

```bash
bun run dev
```

Вы должны увидеть:

```
✓ Redis initialized
✓ NATS client connected for message publishing
✓ Userbot started successfully
✓ Telega service fully initialized
```

## 7. Подписка на канал

```bash
curl -X POST http://localhost:3005/channels/subscribe \
  -H "Content-Type: application/json" \
  -d '{"channelId": "cryptosignalschannel"}'
```

Ответ:

```json
{
  "message": "Successfully subscribed",
  "subscription": {
    "channelId": "cryptosignalschannel",
    "addedAt": "2025-10-04T12:00:00.000Z",
    "active": true
  }
}
```

## 8. Проверка статуса

```bash
curl http://localhost:3005/status
```

Ответ:

```json
{
  "server": {
    "uptime": 123.45,
    "memory": {...},
    "timestamp": "2025-10-04T12:00:00.000Z"
  },
  "telegram": {
    "connected": true,
    "isConnecting": false,
    "hasClient": true
  },
  "userbot": {
    "running": true,
    "subscribedChannels": ["cryptosignalschannel"]
  }
}
```

## 9. Получение сообщений

```bash
# Последние 10 сообщений из канала
curl http://localhost:3005/channels/cryptosignalschannel/messages?limit=10

# Последние 5 сообщений из всех каналов
curl http://localhost:3005/channels/messages/recent?limit=5
```

## 10. Подписка на NATS (в другом сервисе)

```typescript
import { createNatsClient } from "@aladdin/shared/nats"

const nats = await createNatsClient({
  servers: "nats://localhost:4222",
})

await nats.subscribe("telega.message", (message) => {
  console.log(`[${message.channelId}] ${message.text}`)
  // Ваша логика обработки
})
```

## Готово! 🎉

Теперь:

- ✅ Telega подписан на канал
- ✅ Получает все новые сообщения
- ✅ Публикует их в NATS топик `telega.message`
- ✅ Ваши сервисы могут подписаться и обрабатывать

## Следующие шаги

- Подпишитесь на больше каналов
- Создайте сервис для парсинга сигналов
- Настройте аналитику
- Добавьте уведомления

## Troubleshooting

### Userbot не запускается

```bash
# Проверьте логи
tail -f /logs/telega-*.log

# Пересоздайте session
bun run scripts/gen-session.ts
```

### NATS не подключается

```bash
# Проверьте что NATS запущен
telnet localhost 4222

# Или
nats server ping
```

### Redis не доступен

```bash
# Проверьте Redis
redis-cli ping
# Должно вернуть: PONG
```

## Полезные команды

```bash
# Список всех подписок
curl http://localhost:3005/channels

# Деактивировать канал
curl -X POST http://localhost:3005/channels/cryptosignalschannel/deactivate

# Активировать канал
curl -X POST http://localhost:3005/channels/cryptosignalschannel/activate

# Отписаться полностью
curl -X POST http://localhost:3005/channels/unsubscribe \
  -H "Content-Type: application/json" \
  -d '{"channelId": "cryptosignalschannel"}'

# Health check
curl http://localhost:3005/health
```

## Документация

- [README.md](./README.md) - Полная документация
- [NATS_INTEGRATION.md](./NATS_INTEGRATION.md) - Интеграция с NATS
- [bruno/](./bruno/) - API коллекция для Bruno
