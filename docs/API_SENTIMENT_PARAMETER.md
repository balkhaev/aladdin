# API Update: includeSentiment Parameter

## 🎯 Обзор

Все ML prediction endpoints теперь поддерживают параметр `includeSentiment` для контроля использования sentiment данных.

**Default**: `true` (100% backward compatible)

## 📝 Быстрый старт

```bash
# С sentiment (default)
curl -X POST http://localhost:3019/api/ml/predict \
  -H "Content-Type: application/json" \
  -d '{"symbol": "BTCUSDT", "horizon": "1h"}'

# Без sentiment
curl -X POST http://localhost:3019/api/ml/predict \
  -H "Content-Type: application/json" \
  -d '{"symbol": "BTCUSDT", "horizon": "1h", "includeSentiment": false}'
```

## 🔧 Поддерживаемые endpoints

| Endpoint                        | includeSentiment |
| ------------------------------- | ---------------- |
| `POST /api/ml/predict`          | ✅               |
| `POST /api/ml/predict/lstm`     | ✅               |
| `POST /api/ml/predict/ensemble` | ✅               |
| `POST /api/ml/predict/batch`    | ✅               |
| `POST /api/ml/regime`           | ✅               |
| `POST /api/ml/backtest`         | ✅               |
| `POST /api/ml/backtest/compare` | ✅               |
| `POST /api/ml/optimize`         | ✅               |

## 📊 Request/Response

### Request

```typescript
{
  symbol: string
  horizon: "1h" | "4h" | "1d" | "7d"
  confidence?: number
  includeSentiment?: boolean  // default: true
}
```

### Response

```typescript
{
  success: true,
  data: {
    ...prediction,
    includeSentiment: boolean  // отражено в ответе
  }
}
```

## 💡 Use Cases

### Краткосрочная торговля (sentiment важен)

```typescript
const prediction = await fetch("/api/ml/predict", {
  method: "POST",
  body: JSON.stringify({
    symbol: "BTCUSDT",
    horizon: "1h",
    includeSentiment: true,
  }),
})
```

### Долгосрочный анализ (только техника)

```typescript
const prediction = await fetch("/api/ml/predict", {
  method: "POST",
  body: JSON.stringify({
    symbol: "BTCUSDT",
    horizon: "7d",
    includeSentiment: false,
  }),
})
```

## 📈 Expected Impact

| Метрика         | Без Sentiment | С Sentiment | Улучшение |
| --------------- | ------------- | ----------- | --------- |
| Accuracy        | ~70%          | ~75-80%     | +5-10%    |
| MAPE            | ~5%           | ~4.5%       | -0.5%     |
| False Positives | ~20%          | ~15%        | -5%       |

## 🎨 Frontend Integration

### 1. UI Toggle

```tsx
<Switch
  label="Include Sentiment"
  checked={includeSentiment}
  onChange={setIncludeSentiment}
/>
```

### 2. Display Sentiment

```tsx
{
  prediction.includeSentiment && (
    <SentimentGauge score={prediction.features.sentimentScore} />
  )
}
```

### 3. Smart Defaults

```typescript
const getDefaultSentiment = (horizon: string) => {
  return ["1h", "4h"].includes(horizon) // true для краткосрочных
}
```

## 🔍 Implementation Details

**Измененные файлы:**

- `apps/ml-service/src/types.ts` - 6 schemas
- `apps/ml-service/src/routes.ts` - 8 endpoints
- `apps/ml-service/src/index.ts` - docs

**Sentiment Features (когда enabled):**

- Overall Score (-1 to 1)
- Twitter/Reddit/Telegram scores
- Social volume & confidence
- Bullish/Bearish ratios

---

**Status**: ✅ Complete & Tested  
**Date**: October 5, 2025

