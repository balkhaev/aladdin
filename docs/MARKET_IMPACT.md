# 📊 Market Impact Modeling

Оценка влияния крупных ордеров на рынок для оптимизации исполнения.

## 🎯 Что это

**Market Impact** — это изменение цены актива, вызванное размещением крупного ордера. Понимание market impact критично для:

- Минимизации издержек исполнения
- Оптимального разбиения больших ордеров
- Прогнозирования реальных цен исполнения
- Оценки ликвидности рынка

## 📐 Компоненты Market Impact

### 1. Temporary Impact (Временное влияние)

**Описание:** Краткосрочное изменение цены из-за давления спроса/предложения

**Формула:**

```
Temporary Impact = σ × sqrt(participation_rate) × urgency_factor
```

**Характеристики:**

- Обратимо (цена восстанавливается после исполнения)
- Зависит от размера ордера и ликвидности
- Выше для срочных ордеров

### 2. Permanent Impact (Постоянное влияние)

**Описание:** Долгосрочное изменение цены из-за информационного сигнала

**Формула:**

```
Permanent Impact = participation_rate × σ × 0.1
```

**Характеристики:**

- Необратимо (отражает новую информацию)
- Обычно ~10% от temporary impact
- Представляет "утечку" информации на рынок

### 3. Spread Cost (Стоимость спреда)

**Описание:** Издержки на пересечение bid-ask spread

**Формула:**

```
Spread Cost = (spread / price) × 0.5
```

**Характеристики:**

- Неизбежные издержки для market orders
- Ниже для limit orders
- Зависит от ликвидности

## 🔧 API Endpoints

### 1. Calculate Market Impact

**Endpoint:** `POST /api/trading/market-impact`

Оценивает влияние ордера на рынок.

**Request Body:**

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

**Parameters:**

- `symbol`: торговая пара
- `orderSize`: размер ордера в USD
- `side`: "BUY" | "SELL"
- `urgency` (optional): "low" | "medium" | "high" (default: "medium")
- `currentPrice`: текущая цена
- `dailyVolume`: дневной объем торгов в USD
- `spread`: bid-ask spread (в долях, 0.001 = 0.1%)
- `volatility` (optional): дневная волатильность (default: 0.02 = 2%)

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
      "timeHorizon": 30,
      "reason": "Medium urgency - balanced splitting strategy"
    }
  },
  "timestamp": 1696435200000
}
```

### 2. Generate Order Splitting Strategy

**Endpoint:** `POST /api/trading/order-splitting`

Создает стратегию разбиения ордера для минимизации impact.

**Request Body:**

```json
{
  "impact": {
    "temporaryImpact": 0.0015,
    "permanentImpact": 0.0002,
    "expectedSlippage": 0.0022,
    "estimatedCost": 220,
    "participationRate": 0.1,
    "priceImpactBps": 22,
    "recommendation": {
      "shouldSplit": true,
      "optimalChunks": 4,
      "timeHorizon": 30,
      "reason": "Medium urgency"
    }
  },
  "orderSize": 100000,
  "volatility": 0.02
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "chunks": [
      {
        "size": 25000,
        "delayMinutes": 0,
        "estimatedSlippage": 0.0008
      },
      {
        "size": 25000,
        "delayMinutes": 7.5,
        "estimatedSlippage": 0.0008
      },
      {
        "size": 25000,
        "delayMinutes": 15,
        "estimatedSlippage": 0.0008
      },
      {
        "size": 25000,
        "delayMinutes": 22.5,
        "estimatedSlippage": 0.0008
      }
    ],
    "totalSlippage": 0.0008,
    "totalTime": 30,
    "savingsVsImmediate": 140
  },
  "timestamp": 1696435200000
}
```

### 3. Calculate Implementation Shortfall

**Endpoint:** `POST /api/trading/implementation-shortfall`

Вычисляет разницу между решением и фактическим исполнением.

**Request Body:**

```json
{
  "decisionPrice": 50000,
  "actualFillPrice": 50100,
  "orderSize": 100000,
  "side": "BUY"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "shortfall": 0.002,
    "shortfallBps": 20,
    "cost": 200
  },
  "timestamp": 1696435200000
}
```

## 💡 Примеры использования

### 1. Оценка impact для крупного ордера

```bash
curl -X POST "http://localhost:3011/api/trading/market-impact" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTCUSDT",
    "orderSize": 500000,
    "side": "BUY",
    "urgency": "low",
    "currentPrice": 50000,
    "dailyVolume": 1000000,
    "spread": 0.001,
    "volatility": 0.025
  }'
```

**Результат:** Оценка влияния ордера на $500K (50% от дневного объема) с рекомендацией разбить на несколько частей.

### 2. Разбиение ордера

```bash
# 1. Получить оценку impact
impact=$(curl -X POST "http://localhost:3011/api/trading/market-impact" \
  -H "Content-Type: application/json" \
  -d '{ ... }')

# 2. Создать стратегию разбиения
curl -X POST "http://localhost:3011/api/trading/order-splitting" \
  -H "Content-Type: application/json" \
  -d "{
    \"impact\": $impact,
    \"orderSize\": 500000,
    \"volatility\": 0.025
  }"
```

**Результат:** План исполнения ордера с разбиением на chunks и временными задержками.

### 3. Анализ исполнения

```bash
curl -X POST "http://localhost:3011/api/trading/implementation-shortfall" \
  -H "Content-Type: application/json" \
  -d '{
    "decisionPrice": 50000,
    "actualFillPrice": 50150,
    "orderSize": 100000,
    "side": "BUY"
  }'
```

**Результат:** Анализ издержек исполнения (shortfall = $150 или 30 bps).

## 📊 Urgency Levels

| Urgency    | Impact Multiplier | Typical Use Case                             |
| ---------- | ----------------- | -------------------------------------------- |
| **Low**    | 1.0x              | Portfolio rebalancing, long-term positioning |
| **Medium** | 1.5x              | Normal trading, moderate time pressure       |
| **High**   | 2.5x              | Stop-loss, liquidation, urgent exit          |

## 📐 Participation Rate

**Определение:** Отношение размера ордера к дневному объему торгов

```
Participation Rate = Order Size / Daily Volume
```

**Интерпретация:**

| Rate  | Impact    | Recommendation                                      |
| ----- | --------- | --------------------------------------------------- |
| < 1%  | Low       | Execute immediately                                 |
| 1-5%  | Medium    | Consider splitting (2-5 chunks)                     |
| 5-20% | High      | Split into 5-10 chunks                              |
| > 20% | Very High | Split into 10+ chunks, consider multi-day execution |

## 🧮 Square Root Law

Market impact растет пропорционально **квадратному корню** из participation rate:

```
Impact ∝ sqrt(participation_rate)
```

**Почему квадратный корень?**

- Линейная модель переоценивает impact для больших ордеров
- Эмпирические исследования подтверждают sqrt-relationship
- Отражает реальную динамику order book

**Пример:**

| Order Size | Participation | Impact (linear) | Impact (sqrt) |
| ---------- | ------------- | --------------- | ------------- |
| $10K       | 1%            | 1x              | 1x            |
| $100K      | 10%           | 10x             | 3.16x         |
| $1M        | 100%          | 100x            | 10x           |

## ⚖️ Optimal Order Splitting

**Almgren-Chriss Framework:**

Оптимальное количество chunks:

```
Optimal Chunks ≈ sqrt(participation_rate × 100)
```

Оптимальное время исполнения:

```
Optimal Time ∝ sqrt(participation_rate) × volatility × (1 + risk_aversion)
```

**Trade-off:**

- Больше chunks = меньше impact, но больше времени
- Меньше chunks = быстрее, но выше impact

## 🎯 Best Practices

### 1. Pre-Trade Analysis

```bash
# ALWAYS оценивайте impact перед крупным ордером
if order_size > 0.01 * daily_volume:
    impact = calculate_market_impact(order)
    if impact.recommendation.shouldSplit:
        use_splitting_strategy()
```

### 2. Time Diversification

```
Spread execution across time
- Reduces average impact
- Exploits mean reversion
- Captures better prices
```

### 3. Urgency Management

```
Low urgency → Minimize cost
Medium urgency → Balance cost/time
High urgency → Accept higher cost
```

### 4. Monitoring Implementation Shortfall

```bash
# Track actual vs expected execution
for each fill:
    shortfall = actual_price - decision_price
    cumulative_cost += shortfall × fill_size
```

## ⚠️ Limitations

1. **Model Assumptions:**

   - Assumes normal market conditions
   - Doesn't account for extreme events
   - Ignores other large orders

2. **Data Requirements:**

   - Need accurate daily volume
   - Spread can change rapidly
   - Volatility is historical

3. **Market Microstructure:**
   - Order book depth varies
   - Hidden liquidity exists
   - Dark pools not included

## 🚀 Future Improvements

### Planned:

1. **Machine Learning Impact Predictor** — ML model trained on execution data
2. **Real-time Order Book Analysis** — Dynamic impact based on current liquidity
3. **Cross-Exchange Routing** — Split across multiple exchanges
4. **Adaptive Execution** — Adjust strategy based on realized impact
5. **Time-of-Day Effects** — Account for intraday liquidity patterns
6. **Volume Participation (VWAP/TWAP)** — Algorithm-based execution
7. **Smart Order Router** — Automatic venue selection

## 📚 Литература

1. **Almgren & Chriss (2000)** - "Optimal Execution of Portfolio Transactions"
2. **Kyle (1985)** - "Continuous Auctions and Insider Trading"
3. **Hasbrouck (2009)** - "Trading Costs and Returns for U.S. Equities"
4. **Grinold & Kahn (1999)** - "Active Portfolio Management"

## 🔗 См. также

- [Portfolio Rebalancing](../../portfolio/PORTFOLIO_REBALANCING.md)
- [Trading Service](../README.md)
- [Aladdin Roadmap](../../../docs/ALADDIN_ROADMAP.md)
