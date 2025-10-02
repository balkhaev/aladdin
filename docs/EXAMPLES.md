# Примеры использования

Практические примеры работы с API платформы Aladdin.

## 📦 Portfolio Import

Импорт позиций из внешних источников (биржевые балансы).

```bash
POST /api/portfolio/:id/import
```

### Базовый импорт

```typescript
const response = await fetch(
  `http://localhost:3000/api/portfolio/${portfolioId}/import`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      assets: [
        { symbol: "BTC", quantity: 0.5, currentPrice: 45000 },
        { symbol: "ETH", quantity: 5.0, currentPrice: 3000 },
      ],
      exchange: "binance",
      exchangeCredentialsId: "cm123456789",
    }),
  }
)

const result = await response.json()
// result.data: Array<Position>
```

### Автоматический импорт с биржи

```typescript
// 1. Получить балансы с биржи
const balances = await fetch(
  "http://localhost:3000/api/trading/binance/balances",
  {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-exchange-credentials-id": exchangeCredentialsId,
    },
  }
).then((r) => r.json())

// 2. Преобразовать в формат для импорта
const assets = balances.data
  .filter((b) => b.free > 0)
  .map((b) => ({
    symbol: b.asset,
    quantity: Number.parseFloat(b.free),
    currentPrice: b.currentPrice || 0,
  }))

// 3. Импортировать в портфолио
await fetch(`http://localhost:3000/api/portfolio/${portfolioId}/import`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    assets,
    exchange: "binance",
    exchangeCredentialsId,
  }),
})
```

### Валидация

- **Symbol**: 1-20 символов
- **Quantity**: > 0
- **Current Price**: ≥ 0 (может быть 0 если неизвестна)
- Минимум 1 актив, максимум 1000

## 🚀 Redis Кэширование

### Market Data Service

Кэшированные эндпоинты:

```typescript
// Aggregated prices (TTL: 5s)
GET /api/market-data/aggregated/:symbol
// Response: 10-20ms (было 150-200ms) ⚡

// Arbitrage opportunities (TTL: 10s)
GET /api/market-data/arbitrage?minSpread=0.1
// Response: 15-25ms (было 200-300ms) ⚡

// Price comparison (TTL: 5s)
GET /api/market-data/comparison/:symbol
```

**Результат:** 10-20x ускорение, 80%+ cache hit rate

### Analytics Service

```typescript
// Technical indicators (TTL: 60s)
GET /api/analytics/indicators/:symbol?indicator=RSI
// Response: 10-30ms (было 200-500ms) ⚡

// Advanced metrics (TTL: 300s)
GET /api/analytics/portfolio/:id/advanced-metrics
// Response: 20-50ms (было 500-1000ms) ⚡

// Market overview (TTL: 120s)
GET /api/analytics/market-overview
// Response: 15-40ms (было 300-600ms) ⚡
```

**Результат:** 15-25x ускорение

### Проверка кэша

```bash
# Первый запрос (cache miss)
time curl http://localhost:3010/api/market-data/aggregated/BTCUSDT
# ~150ms

# Второй запрос (cache hit)
time curl http://localhost:3010/api/market-data/aggregated/BTCUSDT
# ~15ms ⚡
```

### Мониторинг

```bash
# Подключиться к Redis
redis-cli -h 49.13.216.63 -p 6379 -a PASSWORD

# Просмотр ключей
KEYS market-data:*

# Получить значение
GET market-data:aggregated:BTCUSDT:1

# Real-time мониторинг
MONITOR
```

## 😨 Fear & Greed Index

Индикатор рыночных настроений (0-100).

### Текущее значение

```typescript
const response = await fetch("http://localhost:3000/api/macro/feargreed")
const { data } = await response.json()

// data: {
//   timestamp: "2025-10-04T00:00:00Z",
//   value: 71,
//   classification: "Greed"
// }
```

### История

```typescript
const response = await fetch(
  "http://localhost:3000/api/macro/feargreed/history?days=30"
)
const { data } = await response.json()

// data: Array<{ time: number, value: number }>
// Используйте для графиков
```

### Интерпретация

| Значение | Классификация | Рекомендация                        |
| -------- | ------------- | ----------------------------------- |
| 0-24     | Extreme Fear  | Возможна покупка (рынок перепродан) |
| 25-44    | Fear          | Осторожность                        |
| 45-55    | Neutral       | Сбалансированный рынок              |
| 56-75    | Greed         | Возможна коррекция                  |
| 76-100   | Extreme Greed | Высокий риск коррекции              |

### Обратный индикатор

```typescript
function getTradingSignal(fearGreed: number, rsi: number) {
  // Extreme Fear + RSI oversold = BUY signal
  if (fearGreed < 25 && rsi < 30) {
    return { type: "BUY", confidence: "HIGH" }
  }

  // Extreme Greed + RSI overbought = SELL signal
  if (fearGreed > 75 && rsi > 70) {
    return { type: "SELL", confidence: "HIGH" }
  }

  return null
}
```

### Анализ дивергенций

```typescript
async function analyzeDivergence(symbol: string, days = 30) {
  const [fearGreedHistory, priceHistory] = await Promise.all([
    fetch(`/api/macro/feargreed/history?days=${days}`).then((r) => r.json()),
    fetch(`/api/market-data/candles/${symbol}?interval=1d&limit=${days}`).then(
      (r) => r.json()
    ),
  ])

  // Медвежья дивергенция: цена растет, Fear & Greed падает
  // Бычья дивергенция: цена падает, Fear & Greed растет

  return detectDivergence(fearGreedHistory.data, priceHistory.data)
}
```

## 📊 WebSocket Streaming

### Market Data

```typescript
const ws = new WebSocket("ws://localhost:3010/ws")

// Подписка на символы
ws.onopen = () => {
  ws.send(
    JSON.stringify({
      type: "subscribe",
      symbols: ["BTCUSDT", "ETHUSDT"],
    })
  )
}

// Получение обновлений
ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  console.log(`${data.symbol}: ${data.price}`)
}

// Отписка
ws.send(
  JSON.stringify({
    type: "unsubscribe",
    symbols: ["BTCUSDT"],
  })
)
```

### Screener Signals

```typescript
const ws = new WebSocket("ws://localhost:3017/signals")

ws.onmessage = (event) => {
  const signal = JSON.parse(event.data)
  // {
  //   symbol: "ADAUSDT",
  //   signal: "BUY",
  //   strategy: "RSI_OVERSOLD",
  //   confidence: 0.85,
  //   price: 0.502
  // }

  if (signal.confidence > 0.8) {
    notify(`${signal.signal} ${signal.symbol}`)
  }
}
```

## 🧪 Бэктестинг

```typescript
const response = await fetch("http://localhost:3000/api/analytics/backtest", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    symbol: "BTCUSDT",
    strategy: "RSI",
    params: {
      period: 14,
      oversold: 30,
      overbought: 70,
    },
    from: "2024-01-01",
    to: "2024-10-01",
    initialCapital: 10000,
  }),
})

const result = await response.json()
// result.data: {
//   totalReturn: 25.5,
//   trades: 45,
//   winRate: 62.2,
//   sharpeRatio: 1.8,
//   maxDrawdown: -15.2,
//   finalCapital: 12550
// }
```

## ⚠️ Risk Check

```typescript
const response = await fetch("http://localhost:3000/api/risk/check", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    symbol: "BTCUSDT",
    side: "BUY",
    quantity: 1.0,
    price: 45000,
  }),
})

const result = await response.json()

if (result.data.approved) {
  // Разрешено создать ордер
  await createOrder(...)
} else {
  // Отклонено
  console.warn("Risk check failed:", result.data.checks)
}
```

## 🔗 On-Chain Metrics

```typescript
// Whale транзакции и exchange flows
const response = await fetch(
  "http://localhost:3000/api/on-chain/metrics/latest/BTC"
)
const { data } = await response.json()

// data: {
//   blockchain: "BTC",
//   timestamp: 1696248000000,
//   whaleTransactions: {
//     count: 15,
//     totalVolume: 1250.5
//   },
//   exchangeFlow: {
//     inflow: 500.2,
//     outflow: 750.8,
//     netFlow: -250.6  // negative = bullish (вывод с бирж)
//   },
//   activeAddresses: 850000,
//   nvtRatio: 45.2,  // <50 = недооценен
//   marketCap: 580000000000
// }

// Интерпретация
if (data.exchangeFlow.netFlow < 0) {
  console.log("Bullish: Вывод с бирж (ходл)")
} else {
  console.log("Bearish: Приток на биржи (продажа)")
}
```

## 🔍 Screener Стратегии

### Использование встроенной стратегии

```typescript
const response = await fetch("http://localhost:3000/api/screener/scan")
const { data } = await response.json()

// data: Array<{
//   symbol: "ADAUSDT",
//   signal: "BUY",
//   strategy: "RSI_OVERSOLD",
//   confidence: 0.85,
//   price: 0.502
// }>

// Фильтруем сигналы с высокой уверенностью
const highConfidenceSignals = data.filter((s) => s.confidence > 0.8)
```

### Создание кастомной стратегии

```typescript
const response = await fetch("http://localhost:3000/api/screener/strategies", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: "My RSI + Volume Strategy",
    conditions: [
      {
        indicator: "RSI",
        operator: "<",
        value: 35,
      },
      {
        indicator: "VOLUME",
        operator: ">",
        value: "SMA_20",
      },
    ],
  }),
})

const strategy = await response.json()
```

## 📚 Дополнительно

- [API.md](./API.md) - полная документация API
- [README.md](./README.md) - обзор платформы
- [PERFORMANCE.md](./PERFORMANCE.md) - производительность и оптимизация
- [SECURITY.md](./SECURITY.md) - безопасность

---

**Happy Coding! 🚀**
