# Screener Service

Сервис для автоматического технического анализа всех торговых пар Binance.

## Возможности

- 🔍 Автоматический скрининг всех USDT пар на Binance каждые 15 минут
- 📊 Технический анализ с использованием множества индикаторов:
  - RSI (Relative Strength Index)
  - MACD (Moving Average Convergence Divergence)
  - EMA (Exponential Moving Averages: 20, 50, 200)
  - SMA (Simple Moving Averages: 20, 50, 200)
  - Bollinger Bands
  - Stochastic Oscillator
  - ATR (Average True Range)
  - ADX (Average Directional Index)
- 🎯 Генерация торговых сигналов и рекомендаций
- 📈 Определение тренда, силы, моментума и волатильности
- ⚡ Параллельная обработка с помощью BullMQ
- 🔄 Соблюдение rate limits Binance API

## Архитектура

Сервис использует очереди задач (BullMQ) для эффективной обработки большого количества символов:

1. **Scheduler** - каждые 15 минут создает задачи для всех символов
2. **Queue** - распределяет задачи между воркерами
3. **Workers** - обрабатывают символы параллельно (по умолчанию 10 параллельных задач)
4. **API** - предоставляет доступ к результатам анализа

## Установка

```bash
cd apps/screener
bun install
```

## Настройка

Скопируйте `.env.example` в `.env` и настройте параметры:

```bash
cp .env.example .env
```

**Важно:** Убедитесь, что Redis запущен! BullMQ требует Redis для работы очередей.

```bash
# С помощью Docker
docker run -d -p 6379:6379 redis:7-alpine

# Или через docker-compose в корне проекта
docker-compose up -d redis
```

## Запуск

```bash
# Development
bun dev

# Production
bun start
```

## API

### Health Check

```bash
GET /health
```

### Запустить скрининг вручную

```bash
POST /api/screener/run
Content-Type: application/json

{
  "timeframe": "15m"  // опционально, по умолчанию "15m"
}
```

### Получить результаты скрининга

```bash
GET /api/screener/results?limit=100
```

Возвращает результаты анализа, отсортированные по силе сигнала.

### Получить топ сигналов

```bash
GET /api/screener/signals/:recommendation?limit=20
```

Параметр `recommendation` может быть:

- `STRONG_BUY`
- `BUY`
- `SELL`
- `STRONG_SELL`

Примеры:

```bash
# Топ 20 сигналов на покупку
GET /api/screener/signals/STRONG_BUY?limit=20

# Топ 10 сигналов на продажу
GET /api/screener/signals/STRONG_SELL?limit=10
```

### Получить статистику очереди

```bash
GET /api/screener/stats
```

Возвращает количество задач в разных состояниях:

```json
{
  "success": true,
  "data": {
    "waiting": 150,
    "active": 10,
    "completed": 2340,
    "failed": 5,
    "delayed": 0
  }
}
```

### Очистить очередь

```bash
DELETE /api/screener/queue
```

## Пример результата анализа

```json
{
  "symbol": "BTCUSDT",
  "timestamp": 1696348800000,
  "timeframe": "15m",
  "indicators": {
    "rsi": 52.3,
    "macd": {
      "macd": 123.45,
      "signal": 120.32,
      "histogram": 3.13
    },
    "ema20": 43250.5,
    "ema50": 42800.3,
    "ema200": 41500.2,
    "bollingerBands": {
      "upper": 44000.0,
      "middle": 43000.0,
      "lower": 42000.0
    },
    "stochastic": {
      "k": 65.2,
      "d": 62.8
    },
    "atr": 250.5,
    "adx": 28.5
  },
  "signals": {
    "trend": "BULLISH",
    "strength": 68,
    "momentum": "STRONG",
    "volatility": "MEDIUM",
    "recommendation": "BUY"
  },
  "price": {
    "current": 43250.5,
    "change24h": 850.3,
    "changePercent24h": 2.01,
    "volume24h": 15234567.89
  }
}
```

## Интеграция с другими сервисами

Результаты скрининга можно использовать для:

1. **Автоматической торговли** - использовать сигналы для создания ордеров
2. **Уведомлений** - отправлять алерты при появлении сильных сигналов
3. **Аналитики** - сохранять результаты для исторического анализа
4. **UI Dashboard** - отображать результаты в реальном времени

## Производительность

- Анализ ~500 символов занимает примерно 3-5 минут
- С учетом rate limits Binance (1200 requests/minute)
- Параллельная обработка 10 символов одновременно
- Автоматический retry при ошибках (3 попытки)

## Мониторинг

Логи сохраняются в:

- `logs/screener-{date}.log` - основные логи
- `logs/screener-error-{date}.log` - ошибки

## TODO

- [ ] Сохранение результатов в ClickHouse для исторического анализа
- [ ] Публикация сигналов через NATS для других сервисов
- [ ] Добавление пользовательских стратегий анализа
- [ ] Поддержка других бирж (Bybit, OKX, etc.)
- [ ] WebSocket для real-time обновлений результатов
- [ ] Backtesting на исторических данных
