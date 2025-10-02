# Быстрый старт: Sentiment Analysis Integration

## Что реализовано

✅ **Telegram Integration**

- Подписка на сообщения через NATS topic `telega.message`
- Автоматический парсинг торговых сигналов (LONG/SHORT)
- Поддержка 10 основных криптовалют
- Real-time обработка сообщений

✅ **Twitter Integration**

- Мониторинг 15 крипто-инфлюенсеров
- Keyword-based sentiment analysis
- Поиск по символам и хештегам

✅ **Sentiment Aggregation**

- Объединение данных из обоих источников
- Weighted scoring (на основе объема данных)
- Автоматическое обнаружение sentiment shifts
- Публикация в NATS для других сервисов

## Быстрый запуск

### 1. Подписка на MarketTwits канал

```bash
# Запустите telega сервис
cd apps/telega
bun dev

# В другом терминале подпишитесь на канал
bun scripts/subscribe-to-markettwits.ts
```

### 2. Запуск Twity (Twitter scraper)

```bash
cd apps/twity
bun dev

# Twity автоматически начнет собирать твиты каждые 10 минут
# Первый сбор запустится сразу при старте
```

### 3. Запуск Sentiment сервиса

```bash
cd apps/sentiment
bun dev
```

### 4. Проверка работы

```bash
# Проверка здоровья сервисов
curl http://localhost:3018/api/sentiment/services/health

# Получить sentiment для BTC
curl http://localhost:3018/api/sentiment/BTCUSDT

# Получить историю
curl http://localhost:3018/api/sentiment/BTCUSDT/history
```

## Структура ответа

```json
{
  "success": true,
  "data": {
    "symbol": "BTCUSDT",
    "overall": 0.65, // -1 (bearish) to 1 (bullish)
    "telegram": {
      "score": 0.8,
      "bullish": 12,
      "bearish": 3,
      "signals": 15
    },
    "twitter": {
      "score": 0.5,
      "positive": 25,
      "negative": 15,
      "neutral": 10,
      "tweets": 50
    },
    "confidence": 0.75, // 0 to 1
    "timestamp": "2025-10-04T..."
  }
}
```

## NATS Events

Sentiment сервис публикует два типа событий:

**`sentiment.analysis`** - Результаты анализа (каждые 5 минут)

- BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT

**`sentiment.shift`** - Значительные изменения sentiment

- Триггер: изменение > 30%
- Типы: BULLISH, BEARISH, NEUTRAL

## Monitored Twitter Accounts

- **VitalikButerin** - Ethereum founder
- **APompliano** - Crypto analyst
- **saylor** - MicroStrategy CEO
- **CryptoCobain** - Trader
- **WClementeThird** - On-chain analyst
- **TheBlockCrypto** - News
- **CoinDesk** - News
- и другие (всего 15)

## Telegram Signal Parsing

Автоматически парсятся:

- **Пары**: BTC, ETH, SOL, BNB, XRP, ADA, DOGE, AVAX, DOT, MATIC
- **Направления**: long/buy/bullish → LONG, short/sell/bearish → SHORT
- **Цены**: entry, targets, stop loss

**Пример:**

```
BTC long setup
Entry: 42000
Targets: 43000, 44000
Stop: 41000
```

→ Парсится в структурированный сигнал

## Troubleshooting

### Telega не подключается

```bash
# Проверьте переменные окружения
echo $TELEGRAM_API_ID
echo $TELEGRAM_API_HASH

# Проверьте статус
curl http://localhost:3005/status
```

### Twitter scraper не работает

```bash
# Проверьте cookies
cat apps/twity/twitter_cookies.json

# Проверьте логи
tail -f logs/twity*.log
```

### Sentiment не получает данные

```bash
# Проверьте NATS
curl http://localhost:4222/health

# Проверьте подключение к сервисам
curl http://localhost:3018/api/sentiment/services/health
```

## Архитектура

```
┌─────────────────┐         ┌──────────────┐
│  Telegram       │         │  Twitter     │
│  (@markettwits) │         │  (15 accts)  │
└────────┬────────┘         └──────┬───────┘
         │                         │
         ▼                         ▼
   ┌──────────┐            ┌──────────────┐
   │  Telega  │            │    Twity     │
   │ (userbot)│            │  (scraper)   │
   └─────┬────┘            │ Every 10 min │
         │                 └──────┬───────┘
         │ NATS                   │
         │ (real-time)            │ Store
         │                        ▼
         │                 ┌─────────────┐
         │                 │ ClickHouse  │
         │                 │   (cache)   │
         │                 └──────┬──────┘
         │                        │ Read
         │                        │
         └────────┬───────────────┘
                  ▼
         ┌─────────────────┐
         │   Sentiment     │
         │  (aggregator)   │
         └────────┬────────┘
                  │
                  │ NATS publish
                  ▼
         ┌─────────────────┐
         │ Other Services  │
         │  (trading, etc) │
         └─────────────────┘
```

## Следующие шаги

1. **Добавьте больше Telegram каналов**

   ```bash
   curl -X POST http://localhost:3005/channels/subscribe \
     -H "Content-Type: application/json" \
     -d '{"channelId": "@your_channel"}'
   ```

2. **Используйте sentiment в торговых стратегиях**

   - Подпишитесь на NATS topic `sentiment.shift`
   - Интегрируйте с trading сервисом

3. **Сохраняйте historical data**
   - Настройте сохранение в ClickHouse
   - Анализируйте корреляцию с ценовыми движениями

## Документация

Подробная документация: [`docs/SENTIMENT_INTEGRATION.md`](docs/SENTIMENT_INTEGRATION.md)
