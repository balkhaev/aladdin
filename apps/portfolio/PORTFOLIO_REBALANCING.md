# 🔄 Portfolio Rebalancing Engine

Автоматическая ребалансировка портфеля для поддержания целевых весов активов.

## 🎯 Что это

**Portfolio Rebalancing** — автоматический процесс возвращения портфеля к целевым весам активов после отклонения из-за изменения цен.

**Зачем нужно:**

- Поддерживать целевой профиль риска/доходности
- Фиксировать прибыль от выросших активов
- Докупать подешевевшие активы
- Систематический подход к ребалансировке

## 📐 Стратегии ребалансировки

### 1. Periodic (Календарная)

**Описание:** Ребалансировка по расписанию (ежедневно/еженедельно/ежемесячно/ежеквартально)

**Плюсы:**

- Простота и предсказуемость
- Минимальные издержки на мониторинг
- Дисциплинированный подход

**Минусы:**

- Может пропустить значительные отклонения между датами
- Не учитывает рыночную волатильность

**Когда использовать:**

- Для долгосрочных портфелей
- Когда важна предсказуемость
- Для минимизации комиссий

### 2. Threshold (Пороговая)

**Описание:** Ребалансировка при отклонении веса актива от целевого на заданный процент

**Плюсы:**

- Реагирует на фактические отклонения
- Предотвращает большие отклонения
- Гибкость настройки порогов

**Минусы:**

- Требует постоянного мониторинга
- Может быть слишком частой при высокой волатильности

**Когда использовать:**

- Для активно управляемых портфелей
- Когда важен контроль риска
- В волатильных рынках

### 3. Opportunistic (Оппортунистическая)

**Описание:** Ребалансировка при благоприятных рыночных условиях

**Плюсы:**

- Учитывает рыночные условия
- Потенциально лучшие цены исполнения
- Минимизация slippage

**Минусы:**

- Сложность определения "благоприятных условий"
- Может пропустить оптимальные моменты

**Когда использовать:**

- Для опытных трейдеров
- В спокойных рынках с хорошей ликвидностью
- Когда есть доступ к рыночной аналитике

### 4. Hybrid (Гибридная)

**Описание:** Комбинация Periodic и Threshold стратегий

**Плюсы:**

- Лучшее из обоих миров
- Гарантированная минимальная частота (periodic)
- Реакция на большие отклонения (threshold)

**Минусы:**

- Более сложная настройка

**Когда использовать:**

- Для большинства портфелей (recommended)
- Когда нужен баланс между частотой и контролем

## 🔧 API Endpoints

### 1. Analyze Rebalancing

**Endpoint:** `POST /api/portfolio/:id/rebalancing/analyze`

Анализирует необходимость ребалансировки и возвращает план действий.

**Request Body:**

```json
{
  "targetWeights": {
    "BTCUSDT": 0.5,
    "ETHUSDT": 0.3,
    "SOLUSDT": 0.2
  },
  "config": {
    "strategy": "hybrid",
    "frequency": "monthly",
    "thresholdPercent": 0.05,
    "minTradeSize": 10,
    "maxTransactionCost": 0.002,
    "allowPartialRebalance": false
  }
}
```

**Config Parameters:**

- `strategy`: "periodic" | "threshold" | "opportunistic" | "hybrid"
- `frequency` (periodic): "daily" | "weekly" | "monthly" | "quarterly"
- `thresholdPercent` (threshold): порог отклонения (0.05 = 5%)
- `minTradeSize`: минимальный размер сделки в USD
- `maxTransactionCost`: максимальная комиссия в % от портфеля
- `allowPartialRebalance`: разрешить частичную ребалансировку

**Response:**

```json
{
  "success": true,
  "data": {
    "needsRebalancing": true,
    "reason": "BTCUSDT deviated by 8.5% (threshold: 5.0%)",
    "totalValue": 10000,
    "actions": [
      {
        "symbol": "BTCUSDT",
        "action": "sell",
        "currentWeight": 0.58,
        "targetWeight": 0.5,
        "currentValue": 5800,
        "targetValue": 5000,
        "deltaValue": -800,
        "deltaQuantity": -0.008,
        "estimatedCost": 1.2
      },
      {
        "symbol": "ETHUSDT",
        "action": "buy",
        "currentWeight": 0.25,
        "targetWeight": 0.3,
        "currentValue": 2500,
        "targetValue": 3000,
        "deltaValue": 500,
        "deltaQuantity": 0.5,
        "estimatedCost": 0.75
      }
    ],
    "totalTransactionCost": 1.95,
    "estimatedSlippage": 0.0005,
    "netBenefit": 0.083,
    "priority": "medium"
  },
  "timestamp": 1696435200000
}
```

### 2. Execute Rebalancing

**Endpoint:** `POST /api/portfolio/:id/rebalancing/execute`

Выполняет ребалансировку (генерирует ордера).

**Request Body:**

```json
{
  "plan": {
    // ... plan from analyze endpoint
  },
  "dryRun": true
}
```

**Parameters:**

- `plan`: план ребалансировки от analyze endpoint
- `dryRun` (optional): если true, только показать ордера без выполнения (default: true)

**Response:**

```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "symbol": "BTCUSDT",
        "side": "SELL",
        "quantity": 0.008,
        "type": "LIMIT",
        "price": 100000
      },
      {
        "symbol": "ETHUSDT",
        "side": "BUY",
        "quantity": 0.5,
        "type": "LIMIT",
        "price": 1000
      }
    ],
    "dryRun": true
  },
  "timestamp": 1696435200000
}
```

## 💡 Примеры использования

### 1. Threshold Strategy (5% отклонение)

```bash
curl -X POST "http://localhost:3012/api/portfolio/my-portfolio/rebalancing/analyze" \
  -H "Content-Type: application/json" \
  -H "x-user-id: user123" \
  -d '{
    "targetWeights": {
      "BTCUSDT": 0.60,
      "ETHUSDT": 0.40
    },
    "config": {
      "strategy": "threshold",
      "thresholdPercent": 0.05,
      "minTradeSize": 10
    }
  }'
```

**Результат:** Ребалансировка, если любой актив отклонился на >5% от целевого веса.

### 2. Periodic Strategy (Monthly)

```bash
curl -X POST "http://localhost:3012/api/portfolio/my-portfolio/rebalancing/analyze" \
  -H "Content-Type: application/json" \
  -H "x-user-id: user123" \
  -d '{
    "targetWeights": {
      "BTCUSDT": 0.50,
      "ETHUSDT": 0.30,
      "SOLUSDT": 0.20
    },
    "config": {
      "strategy": "periodic",
      "frequency": "monthly"
    }
  }'
```

**Результат:** Ребалансировка раз в месяц, независимо от отклонений.

### 3. Hybrid Strategy (Best of Both)

```bash
curl -X POST "http://localhost:3012/api/portfolio/my-portfolio/rebalancing/analyze" \
  -H "Content-Type: application/json" \
  -H "x-user-id: user123" \
  -d '{
    "targetWeights": {
      "BTCUSDT": 0.40,
      "ETHUSDT": 0.30,
      "SOLUSDT": 0.20,
      "BNBUSDT": 0.10
    },
    "config": {
      "strategy": "hybrid",
      "frequency": "monthly",
      "thresholdPercent": 0.10,
      "minTradeSize": 50
    }
  }'
```

**Результат:** Ребалансировка раз в месяц ИЛИ если отклонение >10%.

### 4. Execute Rebalancing (Dry-Run)

```bash
curl -X POST "http://localhost:3012/api/portfolio/my-portfolio/rebalancing/execute" \
  -H "Content-Type: application/json" \
  -H "x-user-id: user123" \
  -d '{
    "plan": { /* ... plan from analyze */ },
    "dryRun": true
  }'
```

**Результат:** Показывает ордера, которые будут созданы, без фактического выполнения.

## 📊 Расчет издержек

### Transaction Cost

```
Transaction Cost = Fee + Slippage
```

- **Fee:** Комиссия биржи (maker fee, обычно ~0.1%)
- **Slippage:** Отклонение цены исполнения от ожидаемой (~0.05%)

### Net Benefit

```
Net Benefit = Deviation - (Transaction Cost / Portfolio Value)
```

- **Deviation:** Максимальное отклонение веса от целевого
- **Transaction Cost:** Общие издержки на ребалансировку

**Интерпретация:**

- **Net Benefit > 0:** Ребалансировка выгодна
- **Net Benefit < 0:** Издержки превышают пользу

## 🎯 Priority Levels

| Priority   | Max Deviation | Действие                  |
| ---------- | ------------- | ------------------------- |
| **Low**    | 3-7%          | Можно отложить            |
| **Medium** | 7-10%         | Желательна ребалансировка |
| **High**   | >10%          | Срочная ребалансировка    |

## ⚠️ Best Practices

### 1. Выбор порога (Threshold)

```
Low Volatility Assets  → 3-5% threshold
Medium Volatility      → 5-7% threshold
High Volatility        → 7-10% threshold
```

### 2. Частота ребалансировки

```
Long-term Portfolio    → Monthly/Quarterly
Active Portfolio       → Weekly
Trading Portfolio      → Threshold-based
```

### 3. Минимальный размер сделки

```
minTradeSize ≥ Transaction Cost × 10
```

Пример: Если комиссия $0.50, то `minTradeSize ≥ $5`

### 4. Учет налогов

- В некоторых юрисдикциях ребалансировка = taxable event
- Рассмотреть tax-loss harvesting
- Периодическая ребалансировка может быть выгоднее для налогов

## 🧮 Технические детали

### Расчет текущих весов

```typescript
currentWeight_i = positionValue_i / totalPortfolioValue
```

### Расчет отклонения

```typescript
deviation_i = |currentWeight_i - targetWeight_i|
```

### Расчет нужного объема

```typescript
deltaValue_i = totalValue × (targetWeight_i - currentWeight_i)
deltaQuantity_i = deltaValue_i / currentPrice_i
```

### Определение действия

```typescript
if (deltaValue > minTradeSize) → BUY
if (deltaValue < -minTradeSize) → SELL
else → HOLD
```

## 📈 Преимущества ребалансировки

1. **Risk Control:** Поддержание целевого профиля риска
2. **Buy Low, Sell High:** Систематическое фиксирование прибыли
3. **Discipline:** Удаление эмоций из процесса
4. **Drift Prevention:** Предотвращение чрезмерной концентрации

## 🚧 Ограничения

1. **Transaction Costs:** Частая ребалансировка увеличивает издержки
2. **Market Impact:** Большие ордера могут двигать рынок
3. **Tax Implications:** Может создавать taxable events
4. **Market Timing:** Не учитывает momentum и trends

## 🚀 Будущие улучшения

### Planned:

1. **Tax-Aware Rebalancing** — учет налоговых последствий
2. **Slippage Prediction** — ML-модель для предсказания slippage
3. **Market Impact Modeling** — оценка влияния ордеров на рынок
4. **Multi-Exchange Rebalancing** — ребалансировка между биржами
5. **Dynamic Thresholds** — адаптивные пороги на основе волатильности
6. **Risk Parity Rebalancing** — ребалансировка по риску, а не по весам
7. **Transaction Cost Optimization** — оптимальный выбор между limit/market

## 📚 Литература

1. **Markowitz, H. (1991)** - "Portfolio Selection: Efficient Diversification of Investments"
2. **Sharpe, W. (2010)** - "Adaptive Asset Allocation Policies"
3. **Jaconetti et al. (2010)** - "Best Practices for Portfolio Rebalancing" - Vanguard
4. **DeMiguel et al. (2009)** - "Optimal Versus Naive Diversification"

## 🔗 См. также

- [Portfolio Optimization](./PORTFOLIO_OPTIMIZATION.md)
- [Risk Management](../../risk/ADVANCED_RISK_METRICS.md)
- [Aladdin Roadmap](../../../docs/ALADDIN_ROADMAP.md)
