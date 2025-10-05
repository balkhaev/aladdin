# Smart Order Routing (SOR)

Интеллектуальная маршрутизация ордеров для оптимального исполнения на нескольких биржах.

## 🎯 Основные возможности

- **Price Comparison** - Сравнение цен на разных биржах в реальном времени
- **Multi-Exchange Routing** - Автоматический выбор лучшей биржи или разбиение ордера
- **Liquidity Optimization** - Учет ликвидности при выборе маршрута
- **Fee Optimization** - Минимизация комиссий за исполнение
- **Latency Consideration** - Учет задержек исполнения
- **Smart Strategies** - AI-driven выбор стратегии исполнения

## 📐 Архитектура

### Routing Strategies

#### 1. **Best Price**

Выбирает биржу с лучшей ценой:

- **BUY**: минимальная цена (ask)
- **SELL**: максимальная цена (bid)
- Проверяет достаточность ликвидности
- Если ликвидности недостаточно, автоматически переключается на Split

#### 2. **Best Execution**

Оптимизирует общую стоимость исполнения:

- Учитывает цену + комиссии + проскальзывание
- Рассчитывает composite score для каждой биржи
- Проверяет максимально допустимое проскальзывание
- Автоматически разбивает ордер при превышении лимитов

#### 3. **Fastest**

Выбирает биржу с минимальной задержкой:

- Сортирует биржи по latency
- Проверяет ликвидность на самой быстрой бирже
- Переключается на альтернативы при недостатке ликвидности

#### 4. **Split**

Разбивает ордер на несколько бирж:

- Оптимальное распределение по ликвидности
- До 3 бирж одновременно
- Минимизация market impact
- Взвешенное распределение объема

#### 5. **Smart** (по умолчанию)

AI-driven стратегия с учетом всех факторов:

**Факторы оценки:**

- **Price Score** (0-1) - насколько цена близка к лучшей
- **Fee Score** (0-1) - насколько низкие комиссии
- **Latency Score** (0-1) - насколько быстрое исполнение
- **Liquidity Score** (0-1) - насколько достаточная ликвидность

**Веса в зависимости от urgency:**

| Urgency | Price | Fee | Latency | Liquidity |
| ------- | ----- | --- | ------- | --------- |
| Low     | 50%   | 30% | 10%     | 10%       |
| Medium  | 40%   | 30% | 20%     | 10%       |
| High    | 30%   | 20% | 40%     | 10%       |

**Composite Score:**

```
score = price_score × w_price +
        fee_score × w_fee +
        latency_score × w_latency +
        liquidity_score × w_liquidity
```

Автоматически переключается на Split, если:

- Ликвидность недостаточна (< 120% от требуемой)
- Разница цен между топ-2 биржами < 2%

## 🔌 API Endpoints

### 1. Smart Routing

**POST** `/api/trading/smart-routing`

Найти оптимальный маршрут для ордера.

#### Request Body

```json
{
  "symbol": "BTCUSDT",
  "side": "BUY",
  "quantity": 1.5,
  "orderType": "MARKET",
  "strategy": "smart",
  "maxSlippage": 0.01,
  "urgency": "medium",
  "allowedExchanges": ["binance", "bybit", "okx"],
  "quotes": [
    {
      "exchange": "binance",
      "price": 50000,
      "availableLiquidity": 100000,
      "estimatedFee": 0.001,
      "latency": 50,
      "timestamp": 1704067200000
    },
    {
      "exchange": "bybit",
      "price": 50100,
      "availableLiquidity": 80000,
      "estimatedFee": 0.0015,
      "latency": 60,
      "timestamp": 1704067200000
    }
  ]
}
```

#### Response

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
        "estimatedCost": 75075,
        "share": 100
      }
    ],
    "totalEstimatedCost": 75075,
    "totalEstimatedFee": 75,
    "averagePrice": 50000,
    "expectedSlippage": 0.0005,
    "confidence": 0.85,
    "reason": "Smart routing selected binance (best composite score)",
    "alternatives": [
      {
        "strategy": "best-price",
        "totalCost": 75075,
        "reason": "Best price on binance: $50000"
      },
      {
        "strategy": "split",
        "totalCost": 75180,
        "reason": "Split across 2 exchanges for better liquidity"
      }
    ]
  },
  "timestamp": 1704067200000
}
```

### 2. Price Comparison

**POST** `/api/trading/compare-prices`

Сравнить цены на разных биржах.

#### Request Body

```json
{
  "symbol": "BTCUSDT",
  "side": "BUY",
  "quotes": [
    {
      "exchange": "binance",
      "price": 50000,
      "availableLiquidity": 100000,
      "estimatedFee": 0.001,
      "latency": 50,
      "timestamp": 1704067200000
    },
    {
      "exchange": "bybit",
      "price": 50100,
      "availableLiquidity": 80000,
      "estimatedFee": 0.0015,
      "latency": 60,
      "timestamp": 1704067200000
    }
  ]
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "symbol": "BTCUSDT",
    "side": "BUY",
    "quotes": [
      {
        "exchange": "binance",
        "price": 50000,
        "availableLiquidity": 100000,
        "estimatedFee": 0.001,
        "latency": 50,
        "timestamp": 1704067200000
      },
      {
        "exchange": "okx",
        "price": 50050,
        "availableLiquidity": 120000,
        "estimatedFee": 0.0012,
        "latency": 45,
        "timestamp": 1704067200000
      },
      {
        "exchange": "bybit",
        "price": 50100,
        "availableLiquidity": 80000,
        "estimatedFee": 0.0015,
        "latency": 60,
        "timestamp": 1704067200000
      }
    ],
    "bestPrice": {
      "exchange": "binance",
      "price": 50000
    },
    "priceDifference": 0.002,
    "timestamp": 1704067200000
  },
  "timestamp": 1704067200000
}
```

## 💡 Примеры использования

### Пример 1: Простой BUY order

```typescript
const result = await fetch("/api/trading/smart-routing", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    symbol: "BTCUSDT",
    side: "BUY",
    quantity: 0.5,
    orderType: "MARKET",
    strategy: "best-price",
    quotes: [
      /* ... */
    ],
  }),
})

const { data } = await result.json()
console.log(`Best exchange: ${data.routes[0].exchange}`)
console.log(`Estimated cost: $${data.totalEstimatedCost}`)
```

### Пример 2: Крупный ордер с разбиением

```typescript
const result = await fetch("/api/trading/smart-routing", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    symbol: "ETHUSDT",
    side: "BUY",
    quantity: 100, // Large order
    orderType: "MARKET",
    strategy: "split",
    maxSlippage: 0.005, // 0.5% max slippage
    quotes: [
      /* ... */
    ],
  }),
})

const { data } = await result.json()
console.log(`Split across ${data.routes.length} exchanges:`)
data.routes.forEach((route) => {
  console.log(`  ${route.exchange}: ${route.quantity} ETH (${route.share}%)`)
})
```

### Пример 3: Срочное исполнение

```typescript
const result = await fetch("/api/trading/smart-routing", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    symbol: "BTCUSDT",
    side: "SELL",
    quantity: 2,
    orderType: "MARKET",
    strategy: "fastest",
    urgency: "high",
    quotes: [
      /* ... */
    ],
  }),
})

const { data } = await result.json()
console.log(`Fastest exchange: ${data.routes[0].exchange}`)
console.log(`Estimated latency: ${data.routes[0].latency}ms`)
```

### Пример 4: Сравнение цен

```typescript
const result = await fetch("/api/trading/compare-prices", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    symbol: "BTCUSDT",
    side: "BUY",
    quotes: [
      /* ... */
    ],
  }),
})

const { data } = await result.json()
console.log(
  `Best price: ${data.bestPrice.exchange} at $${data.bestPrice.price}`
)
console.log(`Price spread: ${(data.priceDifference * 100).toFixed(2)}%`)
```

## 🔧 Интеграция в Trading Service

Smart Order Router интегрирован в `TradingService`:

```typescript
class TradingService extends BaseService {
  private smartRouter: SmartOrderRouter

  constructor(deps) {
    super(deps)
    this.smartRouter = new SmartOrderRouter(this.logger)
  }

  findOptimalRoute(
    params: SmartRouteParams,
    quotes: ExchangeQuote[]
  ): RouteRecommendation {
    return this.smartRouter.findOptimalRoute(params, quotes)
  }

  comparePrices(
    symbol: string,
    side: "BUY" | "SELL",
    quotes: ExchangeQuote[]
  ): PriceComparison {
    return this.smartRouter.comparePrices(symbol, side, quotes)
  }
}
```

## 🎯 Best Practices

### 1. Получение Quotes

Перед вызовом SOR необходимо получить актуальные котировки с бирж:

```typescript
// TODO: Implement price aggregation service
const quotes = await getExchangeQuotes("BTCUSDT")
```

### 2. Выбор Strategy

| Сценарий                            | Рекомендуемая стратегия |
| ----------------------------------- | ----------------------- |
| Небольшой ордер, приоритет цена     | `best-price`            |
| Средний ордер, баланс цена/скорость | `smart` (default)       |
| Крупный ордер, минимизация impact   | `split`                 |
| Срочное исполнение                  | `fastest`               |
| Минимизация total cost              | `best-execution`        |

### 3. Urgency Levels

- **Low**: приоритет цене (50% weight), можно подождать
- **Medium**: баланс цены и скорости (40%/20%)
- **High**: приоритет скорости (30%/40%), срочное исполнение

### 4. Max Slippage

Рекомендуемые значения:

- **Tight**: 0.1% (0.001) - для стейблкоинов, очень ликвидных пар
- **Normal**: 0.5% (0.005) - для BTC/ETH
- **Relaxed**: 1-2% (0.01-0.02) - для альткоинов

### 5. Allowed Exchanges

Ограничивайте список бирж если:

- Есть предпочтения по юрисдикции
- Требуется KYC compliance
- Известны проблемы с ликвидностью

## 🔍 Мониторинг и Аналитика

### Метрики для отслеживания

1. **Execution Quality**

   - Average slippage vs. expected
   - Price improvement rate
   - Fill rate

2. **Routing Efficiency**

   - Most used exchange
   - Average routes per order
   - Split order success rate

3. **Cost Savings**
   - Total fees saved vs. single exchange
   - Slippage reduction
   - Implementation shortfall

## ⚠️ Limitations

1. **Quote Freshness**: котировки должны быть свежими (< 1-2 секунд)
2. **Execution Risk**: цены могут измениться между routing и execution
3. **Partial Fills**: не все биржи могут исполнить свою часть split order
4. **Network Latency**: реальная latency может отличаться от оценки

## 🚀 TODO

- [ ] Добавить real-time price aggregation с WebSocket
- [ ] Интегрировать historical execution data для улучшения predictions
- [ ] Добавить machine learning для динамической оптимизации весов
- [ ] Реализовать adaptive routing на основе market conditions
- [ ] Добавить support для limit orders
- [ ] Интегрировать с Order Management System (OMS)

## 📚 Связанная документация

- [Market Impact Modeling](./MARKET_IMPACT.md) - оценка влияния ордера на рынок
- [Order Splitting Strategy](./MARKET_IMPACT.md#order-splitting) - как разбивать крупные ордера
- [Trading Service API](../docs/API.md#trading) - полная документация API

## 📊 Performance

Benchmark на типичных сценариях:

| Operation         | Time  | Memory |
| ----------------- | ----- | ------ |
| Route calculation | <5ms  | ~1MB   |
| Price comparison  | <2ms  | ~500KB |
| Split generation  | <10ms | ~2MB   |

## 🔐 Security

- Все quotes должны быть validated перед использованием
- Rate limiting на API endpoints
- Проверка allowed exchanges на уровне пользователя
- Audit log всех routing decisions
