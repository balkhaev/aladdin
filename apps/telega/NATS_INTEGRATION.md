# NATS Integration

## Топик

Все сообщения публикуются в:

```
telega.message
```

## Формат сообщения

```typescript
{
  channelId: string // ID канала (без @)
  messageId: number // ID сообщения в Telegram
  text: string // Текст сообщения
  date: number // Дата сообщения (Unix timestamp)
  views: number | null // Количество просмотров
  forwards: number | null // Количество репостов
  timestamp: number // Время получения сообщения (Unix timestamp в ms)
}
```

## Пример сообщения

```json
{
  "channelId": "cryptosignalschannel",
  "messageId": 12345,
  "text": "📩 #BTCUSDT 1h | Short-Term\n\n🟢 Long Entry Zone: 50000 - 51000\n\nTargets:\n🎯 Target 1: 52000\n🎯 Target 2: 53000\n🎯 Target 3: 54000\n\n🔴 Stop-Loss: 49000",
  "date": 1696411200,
  "views": 1234,
  "forwards": 10,
  "timestamp": 1696411200500
}
```

## Подписка на сообщения

### TypeScript

```typescript
import { createNatsClient } from "@aladdin/shared/nats"

const nats = await createNatsClient({
  servers: process.env.NATS_URL || "nats://localhost:4222",
})

// Подписываемся на все сообщения
await nats.subscribe("telega.message", (message) => {
  console.log(`[${message.channelId}] Message ID: ${message.messageId}`)
  console.log(`Text: ${message.text}`)

  // Здесь ваша логика обработки
  processMessage(message)
})
```

### Фильтрация по каналу

```typescript
await nats.subscribe("telega.message", (message) => {
  // Обрабатывать только определенный канал
  if (message.channelId === "cryptosignalschannel") {
    parsePremiumSignal(message.text)
  }
})
```

### Парсинг сигналов

```typescript
await nats.subscribe("telega.message", (message) => {
  // Проверить что это торговый сигнал
  if (message.text.includes("#") && message.text.includes("Target")) {
    const signal = parseSignal(message.text)

    if (signal) {
      // Сохранить в базу
      await saveSignal({
        ...signal,
        channelId: message.channelId,
        messageId: message.messageId,
        receivedAt: new Date(message.timestamp),
      })
    }
  }
})
```

### Множественные обработчики

```typescript
// Обработчик 1: Логирование
await nats.subscribe("telega.message", (message) => {
  logger.info("New message", {
    channel: message.channelId,
    id: message.messageId,
  })
})

// Обработчик 2: Парсинг и сохранение
await nats.subscribe("telega.message", async (message) => {
  const signal = parseSignal(message.text)
  if (signal) {
    await db.signals.create(signal)
  }
})

// Обработчик 3: Уведомления
await nats.subscribe("telega.message", async (message) => {
  if (isImportantSignal(message.text)) {
    await sendNotification(message)
  }
})
```

## Производительность

- **Latency**: < 1ms для публикации
- **Throughput**: ~10000 msg/sec
- **Fire-and-forget**: Публикация не блокирует получение следующих сообщений
- **Гарантии доставки**: At-most-once (NATS core) или At-least-once (NATS JetStream)

## Мониторинг

### Проверить подключение

```bash
curl http://localhost:3005/status
```

Ответ должен содержать:

```json
{
  "telegram": {
    "connected": true
  },
  "userbot": {
    "running": true,
    "subscribedChannels": ["cryptosignalschannel"]
  }
}
```

### NATS CLI

```bash
# Подписаться на сообщения через CLI
nats sub telega.message

# Посмотреть статистику
nats stream info
```

## Примеры интеграции

### Signal Parser Service

```typescript
// services/signal-parser/src/index.ts
import { createNatsClient } from "@aladdin/shared/nats"
import { parseSignal } from "./parser"
import { saveSignal } from "./database"

const nats = await createNatsClient()

await nats.subscribe("telega.message", async (message) => {
  try {
    const signal = parseSignal(message.text)

    if (signal) {
      await saveSignal({
        ...signal,
        source: message.channelId,
        telegramMessageId: message.messageId,
        receivedAt: new Date(message.timestamp),
      })

      console.log(`Parsed signal: ${signal.pair} ${signal.direction}`)
    }
  } catch (error) {
    console.error("Error parsing signal:", error)
  }
})
```

### Analytics Service

```typescript
// services/analytics/src/index.ts
import { createNatsClient } from "@aladdin/shared/nats"

const nats = await createNatsClient()
const metrics = new Map<string, number>()

await nats.subscribe("telega.message", (message) => {
  // Подсчет сообщений по каналам
  const count = metrics.get(message.channelId) || 0
  metrics.set(message.channelId, count + 1)

  console.log(`Channel ${message.channelId}: ${count + 1} messages`)
})

// Каждую минуту выводить статистику
setInterval(() => {
  console.log("Messages per channel:", Object.fromEntries(metrics))
}, 60000)
```

### Notification Service

```typescript
// services/notifications/src/index.ts
import { createNatsClient } from "@aladdin/shared/nats"
import { sendTelegramNotification } from "./telegram"

const nats = await createNatsClient()

await nats.subscribe("telega.message", async (message) => {
  // Уведомлять только о важных сигналах
  const isImportant =
    message.text.includes("🔥") ||
    message.text.includes("URGENT") ||
    message.channelId === "vip_signals"

  if (isImportant) {
    await sendTelegramNotification({
      text: `New important signal from ${message.channelId}:\n${message.text}`,
      channel: process.env.NOTIFICATION_CHANNEL,
    })
  }
})
```

## Troubleshooting

### Сообщения не приходят

1. Проверьте что Telega запущена и подключена:

```bash
curl http://localhost:3005/status
```

2. Проверьте что NATS работает:

```bash
nats server ping
```

3. Проверьте логи:

```bash
tail -f /logs/telega-*.log
```

### Дубликаты сообщений

NATS Core не гарантирует отсутствие дубликатов. Если нужна защита от дубликатов:

```typescript
const processedMessages = new Set<string>()

await nats.subscribe("telega.message", (message) => {
  const key = `${message.channelId}:${message.messageId}`

  if (processedMessages.has(key)) {
    console.log("Duplicate message, skipping")
    return
  }

  processedMessages.add(key)
  processMessage(message)
})
```

### Потерянные сообщения

Если критична доставка каждого сообщения, используйте NATS JetStream:

```typescript
// В telega добавить:
await natsClient.jetstream().publish("telega.message", message, {
  msgID: `${message.channelId}-${message.messageId}`,
  expect: { lastMsgID: previousMsgID },
})
```

## Best Practices

1. **Идемпотентность**: Делайте обработчики идемпотентными
2. **Error handling**: Всегда оборачивайте в try-catch
3. **Logging**: Логируйте все важные события
4. **Metrics**: Считайте метрики обработки
5. **Backpressure**: Ограничивайте скорость обработки если нужно
