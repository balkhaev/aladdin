# Advanced Risk Metrics API

Документация по продвинутым метрикам риска, реализованным в Risk Service.

## 🎯 Новые возможности

### 1. CVaR (Conditional Value at Risk / Expected Shortfall)

**Что это:** Средний убыток в худших случаях (например, худшие 5% сценариев).

**Зачем:** Более точная оценка tail risk, чем VaR. Показывает, насколько плохо может быть, если сработает худший сценарий.

**Преимущества над VaR:**

- Coherent risk measure (математически более корректна)
- Учитывает ВСЕ хвостовые потери, а не только threshold
- Предпочитается Basel III и современными риск-менеджерами

### 2. Stress Testing

**Что это:** Симуляция экстремальных рыночных сценариев.

**Зачем:** Понять, как портфель поведет себя в кризисных ситуациях.

**Сценарии:**

- COVID-19 Crash (Mar 2020) - BTC -50%, ETH -60%
- Crypto Winter 2022 - Luna/FTX collapse
- Flash Crash - Внезапный обвал ликвидности
- Exchange Hack - Взлом биржи
- Regulatory Crackdown - Запрет криптовалют
- Black Swan - Непредвиденная катастрофа
- Bull Market Peak - Перегрев рынка
- Stablecoin De-peg - Потеря пега стейблкоином

### 3. Beta (Market Sensitivity)

**Что это:** Мера чувствительности портфеля к рынку (BTC).

**Интерпретация:**

- **Beta = 1.0** - портфель движется вместе с рынком
- **Beta > 1.0** - портфель более волатилен (усиливает движения)
- **Beta < 1.0** - портфель менее волатилен (демпфирует движения)
- **Beta = 0.0** - не коррелирует с рынком
- **Beta < 0.0** - движется противоположно рынку

**Зачем:**

- Понять зависимость от BTC (основной рыночный фактор)
- Оценить systematic risk (рыночный) vs idiosyncratic risk (портфельный)
- Спрогнозировать поведение при движении рынка

---

## 📡 API Endpoints

### 1. Calculate CVaR

**Endpoint:** `GET /api/risk/cvar/:portfolioId`

**Query Parameters:**

- `confidence` (optional): 95 или 99 (default: 95)

**Example Request:**

```bash
curl -X GET "http://localhost:3013/api/risk/cvar/portfolio123?confidence=95"
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "cvar95": 8500.50,
    "cvar99": 12300.75,
    "var95": 6200.00,
    "var99": 9800.00,
    "portfolioValue": 100000,
    "tailRisk95": 1.37,
    "tailRisk99": 1.26,
    "historicalReturns": [-0.05, -0.03, ...],
    "calculatedAt": "2025-10-04T10:30:00Z"
  },
  "timestamp": 1728036600000
}
```

**Response Fields:**

- `cvar95` - CVaR на уровне 95% (в долларах)
- `cvar99` - CVaR на уровне 99% (в долларах)
- `var95` - VaR на уровне 95% для сравнения
- `var99` - VaR на уровне 99% для сравнения
- `tailRisk95` - Tail Risk Ratio (CVaR/VaR). Если > 1.5, то tail risk очень высокий
- `tailRisk99` - Tail Risk Ratio для 99%
- `portfolioValue` - Текущая стоимость портфеля
- `historicalReturns` - Исторические доходности
- `calculatedAt` - Время расчета

**Интерпретация:**

- **CVaR 95% = $8,500** означает: в худших 5% случаев средний убыток составит $8,500
- **Tail Risk 95% = 1.37** означает: худшие потери на 37% больше, чем показывает VaR

---

### 2. Run Stress Test

**Endpoint:** `POST /api/risk/stress-test/:portfolioId`

**Request Body (optional):**

```json
{
  "scenarios": [
    {
      "name": "Custom Crash",
      "description": "My custom scenario",
      "priceShocks": {
        "BTCUSDT": -40,
        "ETHUSDT": -50,
        "default": -60
      },
      "volumeShock": 200,
      "spreadShock": 5,
      "liquidityShock": -80
    }
  ]
}
```

**Example Request (default scenarios):**

```bash
curl -X POST "http://localhost:3013/api/risk/stress-test/portfolio123" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "scenarios": [
      {
        "scenario": "COVID-19 Crash (Mar 2020)",
        "description": "Black Thursday - Bitcoin dropped 50% in 24 hours",
        "currentValue": 100000,
        "stressedValue": 45000,
        "loss": 55000,
        "lossPercentage": 55,
        "positionImpacts": [
          {
            "symbol": "BTCUSDT",
            "currentValue": 50000,
            "stressedValue": 25000,
            "loss": 25000,
            "lossPercentage": 50
          }
        ],
        "liquidationRisk": false,
        "marginCallRisk": true,
        "recoveryTimeEstimate": 180,
        "timestamp": "2025-10-04T10:30:00Z"
      }
    ],
    "worstCase": {
      "scenario": "Black Swan Event",
      "loss": 75000,
      "lossPercentage": 75
    },
    "bestCase": {
      "scenario": "Flash Crash",
      "loss": 30000,
      "lossPercentage": 30
    },
    "averageLoss": 52500,
    "averageLossPercentage": 52.5,
    "resilienceScore": 47.5,
    "recommendations": [
      "⚠️ Высокий уровень риска: средняя потеря 52.5%. Рекомендуем улучшить диверсификацию.",
      "💀 В наихудшем сценарии \"Black Swan Event\" потери составят 75.0%. Хеджируйте риски опционами или стоп-лоссами."
    ]
  },
  "timestamp": 1728036600000
}
```

**Response Fields:**

- `scenarios` - Результаты всех сценариев
- `worstCase` - Наихудший сценарий
- `bestCase` - Наилучший сценарий (наименьшие потери)
- `averageLoss` - Средний убыток по всем сценариям
- `averageLossPercentage` - Средний убыток в процентах
- `resilienceScore` - Оценка устойчивости (0-100, выше = лучше)
- `recommendations` - Конкретные рекомендации по улучшению

**Интерпретация Resilience Score:**

- **80-100**: Отличная устойчивость, портфель хорошо диверсифицирован
- **60-80**: Хорошая устойчивость, умеренные риски
- **40-60**: Средняя устойчивость, рассмотрите диверсификацию
- **20-40**: Низкая устойчивость, высокие риски
- **0-20**: Критически низкая устойчивость, необходимы срочные меры

---

### 3. Get Stress Test Scenarios

**Endpoint:** `GET /api/risk/stress-test/scenarios`

**Example Request:**

```bash
curl -X GET "http://localhost:3013/api/risk/stress-test/scenarios"
```

**Example Response:**

```json
{
  "success": true,
  "data": [
    {
      "name": "COVID-19 Crash (Mar 2020)",
      "description": "Black Thursday - Bitcoin dropped 50% in 24 hours",
      "priceShocks": {
        "BTCUSDT": -50,
        "ETHUSDT": -60,
        "default": -70
      },
      "volumeShock": 300,
      "spreadShock": 5,
      "liquidityShock": -40
    }
  ],
  "timestamp": 1728036600000
}
```

---

### 4. Calculate Portfolio Beta

**Endpoint:** `GET /api/risk/beta/:portfolioId`

**Query Parameters:**

- `days` (optional): период для расчета (default: 30)
- `market` (optional): рыночный символ (default: "BTCUSDT")

**Example Request:**

```bash
curl "http://localhost:3013/api/risk/beta/portfolio123?days=30&market=BTCUSDT"
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "beta": 1.25,
    "alpha": 0.0012,
    "rSquared": 0.85,
    "correlation": 0.92,
    "portfolioReturns": [-0.02, 0.03, ...],
    "marketReturns": [-0.015, 0.025, ...],
    "period": {
      "from": "2025-09-04T00:00:00Z",
      "to": "2025-10-04T00:00:00Z"
    },
    "calculatedAt": "2025-10-04T12:00:00Z"
  }
}
```

**Response Fields:**

- `beta` - Beta coefficient (чувствительность к рынку)
- `alpha` - Jensen's alpha (excess return vs market)
- `rSquared` - R² (какая часть дисперсии объясняется рынком, 0-1)
- `correlation` - Корреляция с рынком (-1 to 1)

**Интерпретация:**

- **Beta = 1.25** означает: при росте BTC на 10%, портфель вырастет на 12.5%
- **R² = 0.85** означает: 85% движений портфеля объясняются движениями BTC
- **Alpha > 0** означает: портфель генерирует excess return сверх рынка

---

### 5. Multi-Market Beta

**Endpoint:** `GET /api/risk/beta/:portfolioId/multi-market`

**Query Parameters:**

- `days` (optional): период для расчета (default: 30)

**Example Request:**

```bash
curl "http://localhost:3013/api/risk/beta/portfolio123/multi-market?days=30"
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "btcBeta": {
      "beta": 1.25,
      "alpha": 0.0012,
      "rSquared": 0.85
    },
    "ethBeta": {
      "beta": 1.45,
      "alpha": 0.0015,
      "rSquared": 0.78
    },
    "marketRegime": "BULL",
    "systematicRisk": 8.5,
    "idiosyncraticRisk": 1.5
  }
}
```

**Response Fields:**

- `btcBeta` - Beta к BTC (основной рыночный прокси)
- `ethBeta` - Beta к ETH (альтернативный прокси)
- `marketRegime` - Текущий режим рынка (BULL/BEAR/SIDEWAYS)
- `systematicRisk` - Рыночный риск (не можем контролировать)
- `idiosyncraticRisk` - Портфельный риск (можем диверсифицировать)

**Интерпретация Systematic vs Idiosyncratic Risk:**

- **Systematic Risk высокий** - портфель сильно зависит от рынка
- **Idiosyncratic Risk высокий** - много уникального риска, нужна диверсификация

---

### 6. Rolling Beta

**Endpoint:** `GET /api/risk/beta/:portfolioId/rolling`

**Query Parameters:**

- `totalDays` (optional): общий период (default: 90)
- `windowDays` (optional): окно для каждого расчета (default: 30)
- `market` (optional): рыночный символ (default: "BTCUSDT")

**Example Request:**

```bash
curl "http://localhost:3013/api/risk/beta/portfolio123/rolling?totalDays=90&windowDays=30"
```

**Example Response:**

```json
{
  "success": true,
  "data": [
    {
      "date": "2025-07-04T00:00:00Z",
      "beta": 1.15,
      "rSquared": 0.82
    },
    {
      "date": "2025-08-04T00:00:00Z",
      "beta": 1.22,
      "rSquared": 0.84
    },
    {
      "date": "2025-09-04T00:00:00Z",
      "beta": 1.25,
      "rSquared": 0.85
    }
  ]
}
```

**Зачем Rolling Beta:**

- Видеть, как beta меняется со временем
- Обнаружить изменения в рыночной чувствительности
- Понять, стабильна ли стратегия

---

## 💡 Практические примеры использования

### Пример 1: Ежедневная проверка рисков

```typescript
// Утренняя проверка портфеля
async function dailyRiskCheck(portfolioId: string) {
  // 1. Проверяем VaR и CVaR
  const cvar = await fetch(
    `http://localhost:3013/api/risk/cvar/${portfolioId}?confidence=95`
  ).then((r) => r.json())

  console.log(`Максимальный ожидаемый убыток (VaR 95%): $${cvar.data.var95}`)
  console.log(
    `Средний убыток в худших случаях (CVaR 95%): $${cvar.data.cvar95}`
  )
  console.log(`Tail Risk Ratio: ${cvar.data.tailRisk95}x`)

  // 2. Если tail risk высокий, запускаем стресс-тест
  if (cvar.data.tailRisk95 > 1.5) {
    const stressTest = await fetch(
      `http://localhost:3013/api/risk/stress-test/${portfolioId}`,
      { method: "POST" }
    ).then((r) => r.json())

    console.log(`Resilience Score: ${stressTest.data.resilienceScore}/100`)
    console.log("Recommendations:", stressTest.data.recommendations)
  }
}
```

### Пример 2: Before Opening Large Position

```typescript
// Перед открытием крупной позиции
async function checkPositionRisk(portfolioId: string) {
  // Запускаем стресс-тест
  const result = await fetch(
    `http://localhost:3013/api/risk/stress-test/${portfolioId}`,
    { method: "POST" }
  ).then((r) => r.json())

  // Проверяем риск ликвидации
  const hasLiquidationRisk = result.data.scenarios.some(
    (s: any) => s.liquidationRisk
  )

  if (hasLiquidationRisk) {
    console.warn("⚠️ DANGER: Риск ликвидации в некоторых сценариях!")
    console.warn("Рекомендуем снизить размер позиции или плечо.")
    return false // Не открываем позицию
  }

  // Проверяем среднюю потерю
  if (result.data.averageLossPercentage > 50) {
    console.warn("⚠️ WARNING: Средняя потеря > 50%")
    console.warn("Рекомендуем добавить хеджирование.")
  }

  return true // Можно открывать позицию
}
```

### Пример 3: Portfolio Rebalancing Decision

```typescript
// Решение о ребалансировке портфеля
async function shouldRebalance(portfolioId: string): Promise<boolean> {
  const stressTest = await fetch(
    `http://localhost:3013/api/risk/stress-test/${portfolioId}`,
    { method: "POST" }
  ).then((r) => r.json())

  // Смотрим на resilience score
  const score = stressTest.data.resilienceScore

  if (score < 40) {
    console.log("🔴 Критически низкая устойчивость. Необходима ребалансировка!")
    return true
  }

  if (score < 60) {
    console.log("🟡 Средняя устойчивость. Рекомендуется ребалансировка.")
    return true
  }

  console.log("🟢 Хорошая устойчивость. Ребалансировка не требуется.")
  return false
}
```

---

## 🔍 Интерпретация результатов

### CVaR

**Хороший портфель:**

- CVaR 95% < 5% от портфеля
- Tail Risk Ratio < 1.3
- CVaR не слишком отличается от VaR

**Плохой портфель:**

- CVaR 95% > 10% от портфеля
- Tail Risk Ratio > 1.5 (большие хвостовые риски!)
- CVaR значительно больше VaR

### Stress Test

**Хороший портфель:**

- Resilience Score > 60
- Нет сценариев с liquidation risk
- Average loss < 30%
- Recovery time < 90 дней

**Плохой портфель:**

- Resilience Score < 40
- Есть сценарии с liquidation risk
- Average loss > 50%
- Recovery time > 180 дней

---

## 🚀 Best Practices

1. **Ежедневная проверка CVaR** - отслеживайте tail risk
2. **Stress testing перед крупными сделками** - избегайте неожиданностей
3. **Мониторинг resilience score** - держите > 60
4. **Реагируйте на recommendations** - AI дает конкретные советы
5. **Используйте custom scenarios** - симулируйте свои опасения

---

## 📊 Сравнение с традиционными метриками

| Метрика              | Что показывает                          | Когда использовать |
| -------------------- | --------------------------------------- | ------------------ |
| **VaR**              | Максимальный убыток при normal условиях | Обычный день       |
| **CVaR**             | Средний убыток в худших случаях         | Оценка tail risk   |
| **Max Drawdown**     | Исторический максимальный drawdown      | Прошлые риски      |
| **Stress Test**      | Потери в экстремальных сценариях        | "Что если?"        |
| **Resilience Score** | Общая устойчивость портфеля             | Quick check        |

**Рекомендация:** Используйте все метрики вместе для полной картины рисков!

---

## 🎓 Следующие шаги

Следующие возможности в roadmap:

- [ ] Beta calculation (чувствительность к BTC/рынку)
- [ ] Liquidity Risk Management
- [ ] Portfolio Optimization (Markowitz)
- [ ] Performance Attribution

См. [ALADDIN_ROADMAP.md](../../docs/ALADDIN_ROADMAP.md) для полного roadmap.
