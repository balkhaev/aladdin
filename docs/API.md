# API Reference

Полное руководство по REST API и WebSocket эндпоинтам платформы Aladdin.

**Base URL:** `http://localhost:3000` (Gateway) или напрямую к сервисам

---

## 🎯 Общие правила

### Response Format

**Success:**

```json
{
  "success": true,
  "data": { ... },
  "timestamp": 1696248000000
}
```

**Error:**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found",
    "details": {}
  },
  "timestamp": 1696248000000
}
```

### Error Codes

- `NOT_FOUND` (404) - ресурс не найден
- `VALIDATION_ERROR` (400) - ошибка валидации
- `UNAUTHORIZED` (401) - не авторизован
- `FORBIDDEN` (403) - нет доступа
- `INTERNAL_ERROR` (500) - внутренняя ошибка

### Rate Limits

- **100 запросов/минуту** на IP
- **1000 запросов/час** на пользователя

Headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1696248060
```

### Authentication

Для защищенных эндпоинтов используйте JWT токен:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/...
```

---

## 🔌 Market Data Service (3010)

### REST API

```bash
# Агрегированные цены (VWAP)
GET /api/market-data/aggregated/:symbol

# Арбитражные возможности
GET /api/market-data/arbitrage?minSpread=0.1&limit=20

# Список символов
GET /api/market-data/symbols
```

### WebSocket

```javascript
const ws = new WebSocket("ws://localhost:3010/ws")

// Подписка
ws.send(
  JSON.stringify({
    type: "subscribe",
    symbols: ["BTCUSDT", "ETHUSDT"],
  })
)

// Отписка
ws.send(
  JSON.stringify({
    type: "unsubscribe",
    symbols: ["BTCUSDT"],
  })
)
```

**Response:**

```json
{
  "symbol": "BTCUSDT",
  "price": 45123.45,
  "timestamp": 1696248000000,
  "exchange": "binance"
}
```

## 💰 Trading Service (3011)

```bash
# Создать ордер
POST /api/trading/orders
Body: {
  "symbol": "BTCUSDT",
  "type": "LIMIT",           # MARKET, LIMIT, STOP_LOSS, TAKE_PROFIT
  "side": "BUY",             # BUY, SELL
  "quantity": 0.01,
  "price": 45000             # для LIMIT
}

# Список ордеров
GET /api/trading/orders
GET /api/trading/orders?status=OPEN

# Получить ордер
GET /api/trading/orders/:orderId

# Изменить ордер
PUT /api/trading/orders/:orderId
Body: { "price": 46000 }

# Отменить ордер
DELETE /api/trading/orders/:orderId
```

## 💼 Portfolio Service (3012)

```bash
# Портфолио
POST   /api/portfolio              # Создать
GET    /api/portfolio              # Список
GET    /api/portfolio/:id          # Получить
PATCH  /api/portfolio/:id          # Обновить
DELETE /api/portfolio/:id          # Удалить

# Позиции
GET /api/portfolio/positions
GET /api/portfolio/positions/:portfolioId

# Импорт позиций
POST /api/portfolio/:id/import
Body: {
  "assets": [
    { "symbol": "BTC", "quantity": 0.5, "currentPrice": 45000 }
  ],
  "exchange": "binance",
  "exchangeCredentialsId": "cm123..."
}

# Обновить цены
POST /api/portfolio/:id/update-prices

# P&L метрики
GET /api/portfolio/pnl/summary
GET /api/portfolio/:id/performance?days=30

# История сделок
GET /api/portfolio/trades?from=<ts>&to=<ts>

# Снапшоты
POST /api/portfolio/:id/snapshot
GET  /api/portfolio/:id/snapshots?from=<ts>&to=<ts>
```

## ⚠️ Risk Service (3013)

```bash
# Value at Risk
GET /api/risk/var?portfolioId=<id>&confidenceLevel=99&timeHorizon=30

Response: {
  "var95": 2500,
  "var99": 3200,
  "portfolioValue": 50000,
  "sharpeRatio": 1.8,
  "maxDrawdown": -15.2
}

# Risk check
POST /api/risk/check
Body: {
  "symbol": "BTCUSDT",
  "side": "BUY",
  "quantity": 1.0,
  "price": 45000
}

Response: {
  "approved": true,
  "checks": {
    "positionLimit": "PASS",
    "exposureLimit": "PASS",
    "varLimit": "PASS"
  }
}

# Exposure
GET /api/risk/exposure
```

## 📊 Analytics Service (3014)

### Технические индикаторы

```bash
# Общий формат
GET /api/analytics/indicators/:symbol?indicator=<IND>&period=<N>&interval=<T>

# Поддерживаемые индикаторы
- RSI (period: 14)
- MACD (fast: 12, slow: 26, signal: 9)
- EMA (period: 20, 50, 200)
- SMA (period: 20, 50, 200)
- BOLLINGER (period: 20, stdDev: 2)

# Примеры
GET /api/analytics/indicators/BTCUSDT?indicator=RSI&period=14&interval=1h
GET /api/analytics/indicators/ETHUSDT?indicator=MACD&interval=4h
GET /api/analytics/indicators/BTCUSDT?indicator=BOLLINGER&period=20&interval=1d
```

### Бэктестинг

```bash
POST /api/analytics/backtest
```

**Body:**

```json
{
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
}
```

**Strategies:**

- `RSI` - RSI oversold/overbought
- `MACD` - MACD cross
- `BOLLINGER` - Bollinger Bands breakout
- `EMA_CROSS` - EMA crossover

**Response:**

```json
{
  "totalReturn": 25.5,
  "trades": 45,
  "winRate": 62.2,
  "sharpeRatio": 1.8,
  "sortinoRatio": 2.1,
  "calmarRatio": 1.5,
  "maxDrawdown": -15.2,
  "finalCapital": 12550,
  "profitFactor": 1.8,
  "avgTrade": 56.7
}
```

### Sentiment Analysis

```bash
# Combined sentiment (все источники)
GET /api/analytics/sentiment/:symbol/combined

# Batch analysis
GET /api/analytics/sentiment/batch/combined?symbols=BTCUSDT,ETHUSDT,SOLUSDT

# Social media sentiment
GET /api/analytics/sentiment/:symbol/social

# Futures sentiment (funding rates + OI)
GET /api/analytics/sentiment/:symbol/futures
```

**Combined Sentiment Response:**

```json
{
  "symbol": "BTCUSDT",
  "combinedScore": 45.2,
  "combinedSignal": "BULLISH",
  "confidence": 0.87,
  "strength": "MODERATE",
  "components": {
    "analytics": {
      "score": 52.1,
      "confidence": 0.92,
      "indicators": {
        "rsi": 58.5,
        "macd": "BULLISH",
        "fearGreed": 68
      }
    },
    "futures": {
      "score": 38.5,
      "confidence": 0.81,
      "fundingRate": 0.008,
      "oiChange": 12.5
    },
    "orderBook": {
      "score": 41.2,
      "confidence": 0.75,
      "bidAskRatio": 1.15
    },
    "social": {
      "score": 48.0,
      "confidence": 0.8,
      "twitter": 0.6,
      "reddit": 0.4,
      "telegram": 0.5
    }
  },
  "recommendation": {
    "action": "BUY",
    "reasoning": "Strong bullish consensus across all metrics",
    "riskLevel": "LOW"
  },
  "insights": [
    "🎯 Strong bullish consensus across all metrics",
    "📈 Futures market showing positive positioning"
  ]
}
```

**Signal Classification:**

| Score Range | Signal  | Strength | Action      |
| ----------- | ------- | -------- | ----------- |
| +60 to +100 | BULLISH | STRONG   | STRONG_BUY  |
| +30 to +59  | BULLISH | MODERATE | BUY         |
| -29 to +29  | NEUTRAL | WEAK     | HOLD        |
| -59 to -30  | BEARISH | MODERATE | SELL        |
| -100 to -60 | BEARISH | STRONG   | STRONG_SELL |

## ⛓️ On-Chain Service (3015)

```bash
# Метрики блокчейна
GET /api/on-chain/metrics/latest/:blockchain    # BTC, ETH

Response: {
  "blockchain": "BTC",
  "timestamp": 1696248000000,
  "whaleTransactions": {
    "count": 15,
    "totalVolume": 1250.5
  },
  "exchangeFlow": {
    "inflow": 500.2,
    "outflow": 750.8,
    "netFlow": -250.6           # negative = bullish (вывод)
  },
  "activeAddresses": 850000,
  "nvtRatio": 45.2,             # <50 = недооценен
  "marketCap": 580000000000
}

# История метрик
GET /api/on-chain/metrics/:blockchain?from=<ts>&to=<ts>

# Whale транзакции
GET /api/on-chain/whale-transactions/:blockchain?limit=20
```

## 🌍 Macro Data Service (3016)

```bash
# Глобальные метрики
GET /api/macro/global

Response: {
  "totalMarketCapUsd": 2450000000000,
  "totalVolume24hUsd": 98000000000,
  "marketCapChange24h": 2.5,
  "btcDominance": 52.3,
  "ethDominance": 16.8,
  "activeCryptocurrencies": 10542
}

# Fear & Greed Index
GET /api/macro/feargreed
GET /api/macro/feargreed/history?days=30

Response: {
  "timestamp": "2025-10-04T00:00:00Z",
  "value": 68,                  # 0-24=Extreme Fear, 25-44=Fear,
  "classification": "Greed"     # 45-55=Neutral, 56-75=Greed, 76-100=Extreme Greed
}

# Трендовые монеты
GET /api/macro/trending

# Топ монеты по категориям
GET /api/macro/top-coins?category=DeFi&limit=50
# Categories: DeFi, Layer 1, Layer 2, Gaming, Meme

# Корреляция категорий
GET /api/macro/categories/correlation?days=7
```

## 🔍 Screener Service (3017)

```bash
# Сканирование рынка
GET /api/screener/scan

Response: [
  {
    "symbol": "ADAUSDT",
    "signal": "BUY",
    "strategy": "RSI_OVERSOLD",
    "confidence": 0.85,
    "price": 0.502,
    "indicators": { "rsi": 28.5 }
  }
]

# Кастомные стратегии
POST /api/screener/strategies
GET  /api/screener/strategies
GET  /api/screener/strategies/:id
PUT  /api/screener/strategies/:id
DELETE /api/screener/strategies/:id

Body (создание): {
  "name": "My Strategy",
  "conditions": [
    {
      "indicator": "RSI",
      "operator": "<",
      "value": 35
    }
  ]
}
```

**WebSocket сигналы:**

```javascript
const ws = new WebSocket("ws://localhost:3017/signals")
ws.onmessage = (event) => {
  const signal = JSON.parse(event.data)
  // { symbol, signal, strategy, confidence, price }
}
```

## 🤖 ML Service (3014)

### Price Prediction

```bash
# LSTM prediction
GET /api/ml/predict/lstm?symbol=BTCUSDT&horizon=24h

# Hybrid prediction (linear + exponential smoothing)
GET /api/ml/predict/hybrid?symbol=BTCUSDT&horizon=24h

# Ensemble (LSTM + Hybrid)
GET /api/ml/predict/ensemble?symbol=BTCUSDT&horizon=24h&strategy=stacking
```

**Response:**

```json
{
  "symbol": "BTCUSDT",
  "predictions": [
    {
      "timestamp": "2025-10-06T12:00:00Z",
      "price": 52500,
      "confidence": 0.85,
      "lowerBound": 51000,
      "upperBound": 54000
    }
  ],
  "model": "LSTM",
  "accuracy": 0.75,
  "modelAgreement": 0.92
}
```

### Anomaly Detection

```bash
# Detect anomalies
GET /api/ml/anomalies/detect?symbol=BTCUSDT

# Pump & dump detection
GET /api/ml/anomalies/pump-dump?symbol=BTCUSDT&window=24h

# Flash crash prediction
GET /api/ml/anomalies/flash-crash?symbol=BTCUSDT
```

**Response:**

```json
{
  "symbol": "BTCUSDT",
  "anomalies": [
    {
      "type": "PUMP_DUMP",
      "severity": "HIGH",
      "confidence": 0.85,
      "indicators": {
        "volumeSpike": 150,
        "priceChange": 12.5,
        "rapidityScore": 0.9
      },
      "recommendation": "CAUTION"
    }
  ]
}
```

### Backtesting (ML Models)

```bash
# Simple backtest
POST /api/ml/backtest/simple

# Walk-forward testing
POST /api/ml/backtest/walk-forward

# Model comparison
POST /api/ml/backtest/compare
```

**Body:**

```json
{
  "symbol": "BTCUSDT",
  "model": "LSTM",
  "trainStart": "2024-01-01",
  "trainEnd": "2024-09-01",
  "testStart": "2024-09-01",
  "testEnd": "2024-10-01",
  "features": ["rsi", "macd", "volume"]
}
```

**Response:**

```json
{
  "metrics": {
    "mae": 250.5,
    "rmse": 380.2,
    "mape": 0.5,
    "r2": 0.85,
    "directionalAccuracy": 0.72
  },
  "predictions": [...],
  "backtestDuration": "30 days"
}
```

### Hyperparameter Optimization

```bash
# Start optimization
POST /api/ml/hpo/optimize

# Get optimization results
GET /api/ml/hpo/results/:jobId

# List all optimizations
GET /api/ml/hpo/list
```

---

## 🔐 Protected Endpoints

Требуют JWT токен в header `Authorization: Bearer <token>`:

- `POST /api/trading/orders`
- `PUT /api/trading/orders/:id`
- `DELETE /api/trading/orders/:id`
- `POST /api/portfolio/*`
- `PUT /api/portfolio/*`
- `DELETE /api/portfolio/*`
- `POST /api/screener/strategies`
- `PUT /api/screener/strategies/:id`
- `DELETE /api/screener/strategies/:id`

## 🏥 Health Checks

```bash
GET /health
GET /<service>/health

Response: {
  "status": "healthy",
  "service": "market-data",
  "uptime": 3600,
  "connections": {
    "clickhouse": true,
    "nats": true,
    "exchanges": ["binance", "bybit", "okx"]
  }
}
```

## 📚 Дополнительно

- [README.md](./README.md) - обзор платформы
- [SECURITY.md](./SECURITY.md) - безопасность
- [PERFORMANCE.md](./PERFORMANCE.md) - производительность
- [migrations/](./migrations/) - SQL миграции

---

**Поддержка:** Все логи в `/logs/`, проверяйте их при возникновении проблем.
