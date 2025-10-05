# Trading Execution Guide

**Версия:** 2.0  
**Статус:** ✅ Production Ready  
**Дата:** 5 октября 2025

Полное руководство по профессиональному исполнению ордеров в Coffee Trading Platform.

---

## 📊 Обзор

Платформа Coffee предоставляет профессиональные инструменты для оптимального исполнения ордеров:

- **Алгоритмическое исполнение** (VWAP, TWAP, Iceberg) для минимизации market impact
- **Smart Order Routing** для выбора лучшей биржи и маршрутизации
- **Market Impact Modeling** для оценки влияния крупных ордеров

---

## 🎯 Алгоритмическое исполнение

### VWAP (Volume Weighted Average Price)

Распределяет исполнение пропорционально историческому объему торгов.

**Преимущества:**

- ✅ Минимизирует market impact для крупных ордеров
- ✅ Следует естественному ритму рынка
- ✅ Оптимально для ордеров на длительный период (1+ час)

**Когда использовать:** Крупные ордера (> 1% дневного объема), период 1+ час

**Пример:**

```typescript
const schedule = executor.calculateVWAPSchedule(
  {
    symbol: "BTCUSDT",
    side: "BUY",
    totalQuantity: 10.0,
    duration: 3600, // 1 hour
    strategy: "VWAP",
    maxSliceSize: 1.0,
  },
  volumeProfile
)
```

### TWAP (Time Weighted Average Price)

Равномерно распределяет исполнение во времени с фиксированными интервалами.

**Преимущества:**

- ✅ Простота и предсказуемость
- ✅ Не требует historical volume data
- ✅ Равномерная нагрузка на рынок

**Когда использовать:** Средние ордера, период 5-60 минут, нет volume data

**Пример:**

```typescript
const schedule = executor.calculateTWAPSchedule({
  symbol: "ETHUSDT",
  side: "SELL",
  totalQuantity: 50.0,
  duration: 600, // 10 minutes
  strategy: "TWAP",
  sliceInterval: 60, // Execute every 60 seconds
})
```

### Iceberg Orders

Скрывает общий размер ордера, показывая только небольшую видимую часть.

**Преимущества:**

- ✅ Скрывает намерения от рынка
- ✅ Предотвращает front-running
- ✅ Защита от манипуляций

**Когда использовать:** Очень крупные ордера, необходимость скрыть размер позиции

**Пример:**

```typescript
const schedule = executor.calculateIcebergSchedule({
  symbol: "BTCUSDT",
  side: "BUY",
  totalQuantity: 100.0,
  visibleQuantity: 5.0, // Show only 5 BTC at a time
  strategy: "ICEBERG",
  refreshThreshold: 0.8,
})
```

### Сравнение стратегий

| Стратегия   | Скорость | Stealth | Сложность | Use Case                          |
| ----------- | -------- | ------- | --------- | --------------------------------- |
| **VWAP**    | Medium   | Medium  | High      | Крупные ордера, длительный период |
| **TWAP**    | Medium   | Low     | Low       | Средние ордера, предсказуемость   |
| **Iceberg** | Variable | High    | Medium    | Очень крупные, stealth required   |

---

## 🔀 Smart Order Routing

Интеллектуальная маршрутизация для выбора оптимальной биржи или разбиения ордера.

### Routing Strategies

#### 1. Best Price

Выбирает биржу с лучшей ценой (минимальный ask для BUY, максимальный bid для SELL).

#### 2. Best Execution

Оптимизирует общую стоимость: цена + комиссии + проскальзывание.

#### 3. Fastest

Выбирает биржу с минимальной задержкой исполнения.

#### 4. Split

Разбивает ордер на несколько бирж для минимизации impact (до 3 бирж).

#### 5. Smart (по умолчанию)

AI-driven стратегия с учетом всех факторов:

- **Price Score** (цена)
- **Fee Score** (комиссии)
- **Latency Score** (скорость)
- **Liquidity Score** (ликвидность)

**Веса в зависимости от urgency:**

| Urgency | Price | Fee | Latency | Liquidity |
| ------- | ----- | --- | ------- | --------- |
| Low     | 50%   | 30% | 10%     | 10%       |
| Medium  | 40%   | 30% | 20%     | 10%       |
| High    | 30%   | 20% | 40%     | 10%       |

### Выбор стратегии

| Сценарий                            | Рекомендация     |
| ----------------------------------- | ---------------- |
| Небольшой ордер, приоритет цена     | `best-price`     |
| Средний ордер, баланс цена/скорость | `smart`          |
| Крупный ордер, минимизация impact   | `split`          |
| Срочное исполнение                  | `fastest`        |
| Минимизация total cost              | `best-execution` |

---

## 📐 Market Impact Modeling

Оценка влияния крупных ордеров на рынок.

### Компоненты Impact

#### 1. Temporary Impact (Временное)

Краткосрочное изменение цены из-за давления спроса/предложения.

```
Temporary Impact = σ × sqrt(participation_rate) × urgency_factor
```

**Характеристики:** Обратимо, зависит от размера и ликвидности.

#### 2. Permanent Impact (Постоянное)

Долгосрочное изменение из-за информационного сигнала.

```
Permanent Impact = participation_rate × σ × 0.1
```

**Характеристики:** Необратимо, ~10% от temporary impact.

#### 3. Spread Cost

Издержки на пересечение bid-ask spread.

```
Spread Cost = (spread / price) × 0.5
```

### Participation Rate

Отношение размера ордера к дневному объему:

```
Participation Rate = Order Size / Daily Volume
```

**Рекомендации:**

| Rate  | Impact    | Действие               |
| ----- | --------- | ---------------------- |
| < 1%  | Low       | Исполнить немедленно   |
| 1-5%  | Medium    | Разбить на 2-5 частей  |
| 5-20% | High      | Разбить на 5-10 частей |
| > 20% | Very High | 10+ частей, multi-day  |

### Square Root Law

Market impact растет пропорционально квадратному корню:

```
Impact ∝ sqrt(participation_rate)
```

**Пример:**

| Order Size | Participation | Impact (linear) | Impact (sqrt) |
| ---------- | ------------- | --------------- | ------------- |
| $10K       | 1%            | 1x              | 1x            |
| $100K      | 10%           | 10x             | 3.16x         |
| $1M        | 100%          | 100x            | 10x           |

---

## 🔌 API Reference

### Алгоритмическое исполнение

**Создать execution:**

```bash
POST /api/trading/executor/algorithmic
```

**Request:**

```json
{
  "symbol": "BTCUSDT",
  "side": "BUY",
  "totalQuantity": 10.0,
  "strategy": "VWAP",
  "duration": 3600,
  "volumeProfile": [
    { "hour": 9, "volume": 1500000 },
    { "hour": 10, "volume": 2000000 }
  ],
  "maxSliceSize": 1.0,
  "minSliceSize": 0.1
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "executionId": "exec_123",
    "status": "PENDING",
    "slices": 10,
    "startTime": 1696435200000,
    "estimatedCompletion": 1696438800000
  }
}
```

**Список active executions:**

```bash
GET /api/trading/executor/algorithmic
```

**Детали execution:**

```bash
GET /api/trading/executor/algorithmic/:id
```

**Отменить execution:**

```bash
DELETE /api/trading/executor/algorithmic/:id
```

### Smart Order Routing

**Найти оптимальный маршрут:**

```bash
POST /api/trading/smart-routing
```

**Request:**

```json
{
  "symbol": "BTCUSDT",
  "side": "BUY",
  "quantity": 1.5,
  "orderType": "MARKET",
  "strategy": "smart",
  "maxSlippage": 0.01,
  "urgency": "medium",
  "quotes": [...]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "strategy": "smart",
    "routes": [
      {
        "exchange": "binance",
        "quantity": 1.5,
        "estimatedPrice": 50000,
        "estimatedFee": 75,
        "share": 100
      }
    ],
    "totalEstimatedCost": 75075,
    "averagePrice": 50000,
    "expectedSlippage": 0.0005,
    "confidence": 0.85
  }
}
```

**Сравнить цены:**

```bash
POST /api/trading/compare-prices
```

### Market Impact

**Оценить impact:**

```bash
POST /api/trading/market-impact
```

**Request:**

```json
{
  "symbol": "BTCUSDT",
  "orderSize": 100000,
  "side": "BUY",
  "urgency": "medium",
  "currentPrice": 50000,
  "dailyVolume": 1000000,
  "spread": 0.001,
  "volatility": 0.02
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "temporaryImpact": 0.0015,
    "permanentImpact": 0.0002,
    "expectedSlippage": 0.0022,
    "estimatedCost": 220,
    "participationRate": 0.1,
    "priceImpactBps": 22,
    "recommendation": {
      "shouldSplit": true,
      "optimalChunks": 4,
      "timeHorizon": 30
    }
  }
}
```

**Создать стратегию разбиения:**

```bash
POST /api/trading/order-splitting
```

### WebSocket Events

**Execution progress:**

```javascript
ws.on("trading.execution.progress", (data) => {
  console.log(`Progress: ${data.completion}%`)
  console.log(`Status: ${data.status}`)
})
```

**Events:**

- `trading.execution.created` - создание execution
- `trading.execution.progress` - обновление прогресса
- `trading.execution.completed` - завершение
- `trading.execution.cancelled` - отмена

---

## 💡 Примеры использования

### 1. Крупный ордер с VWAP

```typescript
// 1. Оценить market impact
const impact = await fetch('/api/trading/market-impact', {
  method: 'POST',
  body: JSON.stringify({
    symbol: 'BTCUSDT',
    orderSize: 500000,
    side: 'BUY',
    urgency: 'low',
    currentPrice: 50000,
    dailyVolume: 1000000,
    spread: 0.001,
    volatility: 0.025
  })
})

// 2. Создать VWAP execution
if (impact.data.recommendation.shouldSplit) {
  const execution = await fetch('/api/trading/executor/algorithmic', {
    method: 'POST',
    body: JSON.stringify({
      symbol: 'BTCUSDT',
      side: 'BUY',
      totalQuantity: 10.0,
      strategy: 'VWAP',
      duration: 3600,
      volumeProfile: [...],
      maxSliceSize: 1.0
    })
  })
}
```

### 2. Smart Order Routing

```typescript
// Получить котировки с бирж
const quotes = await getExchangeQuotes("BTCUSDT")

// Найти оптимальный маршрут
const route = await fetch("/api/trading/smart-routing", {
  method: "POST",
  body: JSON.stringify({
    symbol: "BTCUSDT",
    side: "BUY",
    quantity: 1.5,
    strategy: "smart",
    urgency: "medium",
    quotes,
  }),
})

console.log(`Best exchange: ${route.data.routes[0].exchange}`)
console.log(`Estimated cost: $${route.data.totalEstimatedCost}`)
```

### 3. Iceberg Order для stealth

```typescript
const execution = await fetch("/api/trading/executor/algorithmic", {
  method: "POST",
  body: JSON.stringify({
    symbol: "BTCUSDT",
    side: "BUY",
    totalQuantity: 100.0,
    visibleQuantity: 5.0, // Show only 5 BTC
    strategy: "ICEBERG",
    refreshThreshold: 0.8,
    randomizeInterval: true,
  }),
})
```

---

## 🎯 Best Practices

### Pre-Trade Analysis

```typescript
// ВСЕГДА оценивайте impact перед крупным ордером
if (orderSize > 0.01 * dailyVolume) {
  const impact = await calculateMarketImpact(order)

  if (impact.recommendation.shouldSplit) {
    // Используйте алгоритмическое исполнение
    await executeWithVWAP(order)
  }
}
```

### Выбор стратегии

| Размер ордера | Urgency    | Рекомендация                |
| ------------- | ---------- | --------------------------- |
| < 1% volume   | Any        | Market order или Best Price |
| 1-5% volume   | Low/Medium | TWAP или VWAP               |
| 5-20% volume  | Any        | VWAP + Split                |
| > 20% volume  | Any        | Iceberg + Multi-day         |

### Max Slippage

Рекомендуемые значения:

- **Tight**: 0.1% (стейблкоины, ликвидные пары)
- **Normal**: 0.5% (BTC/ETH)
- **Relaxed**: 1-2% (альткоины)

### Urgency Management

```
Low urgency → Минимизация cost (больше времени)
Medium urgency → Баланс cost/time
High urgency → Приоритет speed (выше cost)
```

---

## 📊 Performance

### Execution Metrics

Отслеживайте ключевые метрики:

1. **Average Price** - средняя цена исполнения
2. **Slippage** - отклонение от benchmark
3. **Completion** - процент исполнения
4. **Efficiency** - насколько хорошо выполнена стратегия
5. **Implementation Shortfall** - разница decision vs actual price

**Пример мониторинга:**

```typescript
const metrics = executor.calculateExecutionMetrics(execution, benchmarkPrice)

console.log({
  averagePrice: metrics.averagePrice,
  slippage: metrics.slippage, // %
  completion: metrics.completion, // 0-1
  duration: metrics.duration, // ms
  efficiency: metrics.efficiency, // 0-1
})
```

### Benchmarks

| Operation         | Time  | Memory |
| ----------------- | ----- | ------ |
| VWAP calculation  | <10ms | ~2MB   |
| TWAP calculation  | <5ms  | ~1MB   |
| SOR calculation   | <5ms  | ~1MB   |
| Impact estimation | <3ms  | ~500KB |

---

## ⚠️ Ограничения

1. **Quote Freshness**: котировки должны быть свежими (< 1-2 сек)
2. **Market Conditions**: модели предполагают нормальные условия
3. **Execution Risk**: цены могут измениться между routing и execution
4. **Data Requirements**: нужны точные volume, spread, volatility

---

## 🚀 Roadmap

### Planned Features

- [ ] Implementation Shortfall Algorithm
- [ ] POV (Percentage of Volume) strategy
- [ ] Dynamic Optimization (real-time корректировка)
- [ ] Multi-venue Coordination
- [ ] Machine Learning для optimal execution path
- [ ] Real-time order book analysis
- [ ] Time-of-day effects

---

## 📚 Литература

1. **Almgren & Chriss (2000)** - "Optimal Execution of Portfolio Transactions"
2. **Kyle (1985)** - "Continuous Auctions and Insider Trading"
3. **Bertsimas & Lo (1998)** - "Optimal Control of Execution Costs"
4. **Kissell & Glantz (2003)** - "Optimal Trading Strategies"
5. **Obizhaeva & Wang (2013)** - "Optimal Trading Strategy and Supply/Demand Dynamics"

---

## 🔗 См. также

- [API Documentation](./API.md)
- [Portfolio Management](../apps/portfolio/)
- [Aladdin Roadmap](./ALADDIN_ROADMAP.md)
- [Quick Start Trading](./QUICK_START_TRADING.md)

---

**Last Updated:** 5 октября 2025  
**Version:** 2.0  
**Status:** ✅ Production Ready
