# Telega Channels API - Bruno Collection

Эта коллекция содержит все запросы для работы с API управления каналами в Telega.

## Структура

### Channel Management

1. **Get All Channels** - получить список всех подписок
2. **Subscribe to Channel** - подписаться на канал
3. **Unsubscribe from Channel** - отписаться от канала
4. **Activate Channel** - активировать подписку
5. **Deactivate Channel** - деактивировать подписку

### Messages

6. **Get Channel Messages** - получить последние N сообщений из конкретного канала
7. **Get Recent Messages** - получить последние сообщения из всех подписанных каналов

### Service

8. **Get Service Status** - получить статус сервиса и список активных каналов

## Использование

### 1. Настройте окружение

В `environments/local.bru`:

```
vars {
  baseUrl: http://localhost:3005
}
```

В `environments/production.bru`:

```
vars {
  baseUrl: https://your-production-url.com
}
```

### 2. Базовый workflow

```bash
# 1. Проверьте статус
GET /status

# 2. Получите список каналов
GET /channels

# 3. Подпишитесь на канал
POST /channels/subscribe
{
  "channelId": "cryptosignalschannel"
}

# 4. Получите сообщения из канала
GET /channels/cryptosignalschannel/messages?limit=10

# 5. Получите сообщения из всех каналов
GET /channels/messages/recent?limit=5
```

### 3. Управление подписками

```bash
# Деактивировать (без удаления)
POST /channels/cryptosignalschannel/deactivate

# Активировать снова
POST /channels/cryptosignalschannel/activate

# Полностью удалить
POST /channels/unsubscribe
{
  "channelId": "cryptosignalschannel"
}
```

## Примеры ответов

### GET /channels

```json
{
  "subscriptions": [
    {
      "channelId": "cryptosignalschannel",
      "addedAt": "2025-10-04T12:00:00.000Z",
      "active": true
    }
  ],
  "activeChannels": ["cryptosignalschannel"],
  "total": 1,
  "active": 1
}
```

### GET /channels/messages/recent?limit=5

```json
{
  "channels": [
    {
      "channelId": "cryptosignalschannel",
      "count": 5,
      "messages": [
        {
          "id": 12345,
          "date": 1696411200,
          "message": "📩 #BTCUSDT 1h | Short-Term...",
          "views": 1234
        }
      ]
    }
  ],
  "total": 1,
  "limitPerChannel": 5
}
```

## Notes

- Имена каналов указываются без символа `@`
- Максимальный лимит сообщений: 100 на запрос
- Сообщения возвращаются от новых к старым
- При получении сообщений из всех каналов используется `Promise.allSettled`, поэтому ошибки в одном канале не блокируют другие
