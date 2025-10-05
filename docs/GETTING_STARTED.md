# Быстрый старт

Руководство по запуску и начальной настройке платформы Aladdin.

---

## ⚡ Минимальная установка (5 минут)

### Требования

- Bun >= 1.0
- Node.js >= 20 (для совместимости)
- Git

### Установка

```bash
# Клонировать репозиторий
git clone <repo-url> coffee
cd coffee

# Установить зависимости
bun install

# Настроить базу данных
bun db:push

# Запустить все сервисы
bun dev
```

Откройте http://localhost:3001 - готово! 🎉

---

## 🔧 Настройка инфраструктуры

### Переменные окружения

Все сервисы работают с **удаленной инфраструктурой** (PostgreSQL, ClickHouse, NATS, Redis).

**Основные переменные** (уже настроены):

```bash
# PostgreSQL (Supabase)
DATABASE_URL=postgresql://...

# ClickHouse
CLICKHOUSE_HOST=49.13.216.63
CLICKHOUSE_PORT=8123

# NATS
NATS_URL=nats://nats.balkhaev.com:4222

# Redis
REDIS_URL=redis://49.13.216.63:6379
```

> 💡 Docker НЕ требуется - вся инфраструктура на удаленных серверах!

---

## 🚀 Запуск сервисов

### Все сразу

```bash
bun dev
```

Запускает все 8 сервисов одновременно через Turbo.

### Отдельные сервисы

```bash
bun dev:web          # Frontend (3001)
bun dev:server       # Gateway (3000)
bun dev:market-data  # Market Data (3010)
bun dev:trading      # Trading (3011)
bun dev:portfolio    # Portfolio (3012)
bun dev:analytics    # Analytics (3014)
bun dev:screener     # Screener (3017)
bun dev:scraper      # Scraper (3018)
```

### Проверка запуска

```bash
# Health checks
curl http://localhost:3000/health  # Gateway
curl http://localhost:3010/health  # Market Data
curl http://localhost:3011/health  # Trading
curl http://localhost:3012/health  # Portfolio
curl http://localhost:3014/health  # Analytics

# Логи
tail -f logs/market-data.log
tail -f logs/trading.log
```

---

## 📊 Первые шаги с API

### 1. Получить рыночные данные

```bash
# Текущая цена BTC
curl http://localhost:3010/api/market-data/aggregated/BTCUSDT

# Список всех символов
curl http://localhost:3010/api/market-data/symbols

# Арбитражные возможности
curl 'http://localhost:3010/api/market-data/arbitrage?minSpread=0.1'
```

### 2. Создать портфолио

```bash
curl -X POST http://localhost:3012/api/portfolio \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Portfolio",
    "userId": "user_123",
    "currency": "USD"
  }'
```

### 3. Добавить позиции

```bash
# Вручную
curl -X POST http://localhost:3012/api/portfolio/<id>/import \
  -H "Content-Type: application/json" \
  -d '{
    "assets": [
      {"symbol": "BTC", "quantity": 0.5, "currentPrice": 50000},
      {"symbol": "ETH", "quantity": 5.0, "currentPrice": 3000}
    ],
    "exchange": "binance"
  }'
```

### 4. Получить технические индикаторы

```bash
# RSI
curl 'http://localhost:3014/api/analytics/indicators/BTCUSDT?indicator=RSI&period=14&interval=1h'

# MACD
curl 'http://localhost:3014/api/analytics/indicators/BTCUSDT?indicator=MACD&interval=1h'

# Bollinger Bands
curl 'http://localhost:3014/api/analytics/indicators/BTCUSDT?indicator=BOLLINGER&period=20&interval=1h'
```

### 5. Анализ рисков

```bash
# Value at Risk
curl 'http://localhost:3012/api/portfolio/<id>/risk/var?confidenceLevel=95'

# Стресс-тесты
curl -X POST http://localhost:3012/api/portfolio/<id>/risk/stress-test \
  -H "Content-Type: application/json" \
  -d '{
    "scenarios": [
      {"name": "Crash", "btc": -30, "eth": -40},
      {"name": "Bull", "btc": 50, "eth": 60}
    ]
  }'
```

---

## 🤖 Автоматическая торговля (Paper Trading)

### Быстрый старт

> ⚠️ **Важно:** Начинайте только с Paper Trading! Тестируйте минимум 2 недели.

**1. Запустить основные сервисы:**

```bash
# В отдельных терминалах или через turbo
bun dev:market-data
bun dev:trading
bun dev:portfolio
bun dev:analytics
bun dev:screener
bun dev:scraper
```

**2. Проверить скринер:**

```bash
curl http://localhost:3017/api/screener/scan
```

**3. Мониторинг сигналов:**

```bash
# Через NATS (требуется nats-cli)
nats sub "screener.signal.>" --server nats://nats.balkhaev.com:4222
```

**4. Проверить статистику:**

```bash
# Paper trades
curl http://localhost:3011/api/trading/history?mode=PAPER
```

### Конфигурация Paper Trading

По умолчанию все настроено консервативно:

- **Max risk per trade:** 2% от баланса
- **Stop-loss:** 5% (обязателен)
- **Take-profit:** 10%
- **Max positions:** 5 одновременно
- **Min confidence:** 60%

### Ожидаемая производительность

**Conservative (Paper):**

- Win Rate: 50-55%
- Trades/Day: 3-5
- Monthly Return: 10-15%

**With Sentiment:**

- Win Rate: 60-65%
- Trades/Day: 5-10
- Monthly Return: 20-30%

---

## 🎨 Frontend

### Доступные страницы

После запуска `bun dev:web` доступны:

- `/` - Dashboard (обзор рынка)
- `/terminal` - Trading Terminal (графики + ордера)
- `/portfolio` - Управление портфелями
- `/analytics` - Технический анализ
- `/screener` - Скринер активов
- `/ml` - ML модели и бэктестинг

### WebSocket подключение

```typescript
const ws = new WebSocket("ws://localhost:3010/ws")

// Подписка на цены
ws.send(
  JSON.stringify({
    type: "subscribe",
    symbols: ["BTCUSDT", "ETHUSDT"],
  })
)

// Получение данных
ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  console.log(data) // { symbol, price, timestamp, exchange }
}
```

---

## 📚 Практические примеры

### Пример 1: Бэктестинг стратегии RSI

```bash
curl -X POST http://localhost:3014/api/analytics/backtest \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTCUSDT",
    "strategy": "RSI",
    "params": {
      "period": 14,
      "oversold": 30,
      "overbought": 70
    },
    "from": "2024-01-01",
    "to": "2024-10-01",
    "initialCapital": 10000
  }'
```

**Ответ:**

```json
{
  "totalReturn": 25.5,
  "trades": 45,
  "winRate": 62.2,
  "sharpeRatio": 1.8,
  "maxDrawdown": -15.2,
  "finalCapital": 12550
}
```

### Пример 2: Оптимизация портфеля

```bash
curl -X POST http://localhost:3012/api/portfolio/<id>/risk/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "method": "MARKOWITZ",
    "targetReturn": 0.15,
    "constraints": {
      "minWeight": 0.05,
      "maxWeight": 0.30
    }
  }'
```

**Ответ:**

```json
{
  "weights": {
    "BTCUSDT": 0.3,
    "ETHUSDT": 0.25,
    "SOLUSDT": 0.2,
    "ADAUSDT": 0.15,
    "DOGEUSDT": 0.1
  },
  "expectedReturn": 0.152,
  "expectedRisk": 0.18,
  "sharpeRatio": 0.84
}
```

### Пример 3: Sentiment анализ

```bash
# Комбинированный sentiment (все источники)
curl http://localhost:3014/api/analytics/sentiment/BTCUSDT/combined

# Batch анализ
curl 'http://localhost:3014/api/analytics/sentiment/batch/combined?symbols=BTCUSDT,ETHUSDT,SOLUSDT'
```

**Ответ:**

```json
{
  "symbol": "BTCUSDT",
  "combinedScore": 45.2,
  "combinedSignal": "BULLISH",
  "confidence": 0.87,
  "strength": "MODERATE",
  "components": {
    "analytics": { "score": 52.1, "confidence": 0.92 },
    "futures": { "score": 38.5, "confidence": 0.81 },
    "orderBook": { "score": 41.2, "confidence": 0.75 },
    "social": { "score": 48.0, "confidence": 0.8 }
  },
  "recommendation": {
    "action": "BUY",
    "reasoning": "Strong bullish consensus across all metrics",
    "riskLevel": "LOW"
  }
}
```

### Пример 4: ML предсказания

```bash
# LSTM предсказание цены
curl 'http://localhost:3014/api/ml/predict/lstm?symbol=BTCUSDT&horizon=24h'

# Ensemble (LSTM + Hybrid)
curl 'http://localhost:3014/api/ml/predict/ensemble?symbol=BTCUSDT&horizon=24h&strategy=stacking'

# Обнаружение аномалий
curl 'http://localhost:3014/api/ml/anomalies/detect?symbol=BTCUSDT'
```

---

## 🐛 Troubleshooting

### Порты заняты

```bash
# Проверить занятые порты
lsof -i :3000
lsof -i :3001
lsof -i :3010

# Изменить порт в .env
PORT=3002 bun dev:web
```

### Сервис не запускается

```bash
# Проверить логи
tail -f logs/<service-name>.log

# Проверить health
curl http://localhost:<port>/health

# Перезапустить
pkill -f "bun.*<service-name>"
bun dev:<service-name>
```

### Нет данных в ClickHouse

```bash
# Импортировать исторические данные
bun scripts/quick-import-candles.ts

# Проверить подключение
curl http://49.13.216.63:8123/ping
```

### WebSocket не подключается

```bash
# Проверить Market Data сервис
curl http://localhost:3010/health

# Проверить URL в коде
const ws = new WebSocket("ws://localhost:3010/ws") // Не wss://
```

---

## 📖 Следующие шаги

После успешного запуска:

1. **Изучите API** → [API_REFERENCE.md](./API_REFERENCE.md)
2. **Узнайте о возможностях** → [FEATURES.md](./FEATURES.md)
3. **Настройте автоматическую торговлю** → Раздел "Автоматическая торговля" выше
4. **Оптимизируйте производительность** → [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 💡 Best Practices

### Разработка

1. **Hot Reload**: Все изменения применяются автоматически - НЕ убивайте процессы!
2. **Логи**: Всегда проверяйте `/logs/<service>.log` при ошибках
3. **Health Checks**: Используйте `/health` эндпоинты для диагностики
4. **NATS Events**: Подписывайтесь на события для debugging

### Production

1. **Мониторинг**: Настройте алерты на критические метрики
2. **Backup**: Регулярные бэкапы PostgreSQL и ClickHouse
3. **Rate Limiting**: Настройте лимиты на API Gateway
4. **Security**: Используйте HTTPS, JWT токены, шифрование API ключей

---

**Поддержка:** Проверяйте логи в `/logs/` при возникновении проблем.  
**Документация:** [README.md](./README.md) | [API_REFERENCE.md](./API_REFERENCE.md) | [FEATURES.md](./FEATURES.md)
