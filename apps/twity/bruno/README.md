# Twity Twitter API - Bruno Collection

Эта коллекция содержит все запросы для работы с API сервиса Twity для скрейпинга Twitter.

## Структура

### Service

1. **Health Check** - проверка состояния сервиса

### Twitter Scraping

2. **Search Tweets** - поиск твитов по запросу
3. **Get User Tweets** - получить твиты конкретного пользователя

## Использование

### 1. Настройте окружение

В `environments/local.bru`:

```
vars {
  host: localhost
  port: 8000
  base_url: http://{{host}}:{{port}}
}
```

В `environments/production.bru`:

```
vars {
  host: your-production-host.com
  port: 8000
  base_url: http://{{host}}:{{port}}
}
```

### 2. Базовый workflow

```bash
# 1. Проверьте статус сервиса
GET /health

# 2. Поиск твитов по запросу
GET /twitter/search?query=bitcoin&limit=10

# 3. Получить твиты конкретного пользователя
GET /twitter/user/elonmusk?limit=10
```

## Примеры запросов

### Поиск твитов

```bash
# Простой поиск
GET /twitter/search?query=bitcoin

# Поиск с лимитом
GET /twitter/search?query=ethereum&limit=50

# Поиск фразы (URL encoded)
GET /twitter/search?query=crypto%20market&limit=20
```

### Твиты пользователя

```bash
# Последние твиты пользователя
GET /twitter/user/elonmusk

# С лимитом
GET /twitter/user/VitalikButerin?limit=30

# Другие пользователи
GET /twitter/user/cz_binance?limit=50
```

## Примеры ответов

### GET /health

```json
{
  "status": "ok",
  "service": "twity",
  "timestamp": "2025-10-04T12:00:00.000Z"
}
```

### GET /twitter/search?query=bitcoin&limit=2

```json
[
  {
    "id": "1234567890",
    "text": "Bitcoin is breaking all-time high! 🚀",
    "author": "cryptotrader",
    "date": "2025-10-04T10:30:00.000Z",
    "likes": 1234,
    "retweets": 567,
    "url": "https://twitter.com/cryptotrader/status/1234567890"
  },
  {
    "id": "1234567891",
    "text": "Analysis of Bitcoin market trends...",
    "author": "bitcoinanalyst",
    "date": "2025-10-04T10:15:00.000Z",
    "likes": 892,
    "retweets": 234,
    "url": "https://twitter.com/bitcoinanalyst/status/1234567891"
  }
]
```

### GET /twitter/user/elonmusk?limit=2

```json
[
  {
    "id": "9876543210",
    "text": "Working on something exciting at Tesla",
    "author": "elonmusk",
    "date": "2025-10-04T11:00:00.000Z",
    "likes": 50000,
    "retweets": 15000,
    "url": "https://twitter.com/elonmusk/status/9876543210"
  },
  {
    "id": "9876543209",
    "text": "SpaceX launch successful! 🚀",
    "author": "elonmusk",
    "date": "2025-10-04T09:30:00.000Z",
    "likes": 75000,
    "retweets": 25000,
    "url": "https://twitter.com/elonmusk/status/9876543209"
  }
]
```

## Технические детали

### Лимиты

- **Дефолтный лимит**: 20 твитов
- **Максимальный лимит**: 100 твитов
- При превышении максимума будет использовано значение 100

### Обработка ошибок

#### 400 Bad Request

```json
{
  "error": "query parameter required"
}
```

#### 500 Internal Server Error

```json
{
  "error": "Failed to search tweets"
}
```

или

```json
{
  "error": "Failed to scrape user tweets"
}
```

### Требования

- Сервис использует Puppeteer для скрейпинга Twitter
- Необходимы корректные cookies Twitter (файл `twitter_cookies.json`)
- Браузер должен быть доступен в системе

## Notes

- Имена пользователей указываются без символа `@`
- Сервис не использует базы данных (PostgreSQL, ClickHouse, NATS)
- Работает полностью через Puppeteer и Twitter web interface
- Скорость зависит от скорости загрузки страниц Twitter
- Может требоваться периодическое обновление cookies для авторизации
