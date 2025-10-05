# OnChain Metrics Guide

## Обзор

Система OnChain анализа теперь включает расширенные метрики и интеллектуальный алгоритм оценки с трендовым анализом и динамическими порогами.

## Новые Метрики

### 1. MVRV Ratio (Market Value to Realized Value)

**Что это:** Соотношение рыночной капитализации к реализованной капитализации.

**Формула:** `MVRV = Market Cap / Realized Cap`

**Интерпретация:**
- **> 3.7** - Перекупленность (overvalued) → Bearish
- **1.0 - 1.5** - Справедливая зона → Neutral/Slightly Bullish
- **< 1.0** - Перепроданность (undervalued) → Very Bullish

**Применение:** Идентификация вершин и дна рыночных циклов.

### 2. NUPL (Net Unrealized Profit/Loss)

**Что это:** Сетевая нереализованная прибыль/убыток.

**Формула:** `NUPL = (Market Cap - Realized Cap) / Market Cap = (MVRV - 1) / MVRV`

**Интерпретация:**
- **> 0.75** - Эйфория (euphoria) → Strong Bearish
- **0.25 - 0.75** - Оптимизм → Neutral
- **0 - 0.25** - Ранняя аккумуляция → Bullish
- **< 0** - Капитуляция (capitulation) → Very Bullish

**Применение:** Определение психологического состояния рынка.

### 3. Puell Multiple (только BTC)

**Что это:** Соотношение текущего дохода майнеров к средней выручке.

**Формула:** `Puell = Daily Mining Revenue (USD) / 365-day MA of Revenue`

**Интерпретация:**
- **> 4** - Вершина цикла → Bearish
- **1.0 - 2.0** - Нормальная зона → Neutral
- **< 0.5** - Дно цикла → Very Bullish

**Применение:** Идентификация пиков и дна рыночных циклов через майнинговую экономику.

## Улучшенные Метрики

### Exchange Reserve

**Было:** 6 адресов, без кэширования
**Стало:** 20 адресов, batch requests (Ethereum), кэш 1 час

**Преимущества:**
- Точность +50%
- Меньше API запросов благодаря кэшу
- Устойчивость к ошибкам (fallback на кэш)

### SOPR (Spent Output Profit Ratio)

**Текущая реализация:** Упрощенная оценка на основе средней tx value

**Интерпретация:**
- **> 1.05** - Массовая фиксация прибыли → Bearish
- **0.95 - 1.05** - Нормальная зона → Neutral
- **< 0.95** - Продажа в убыток (capitulation) → Bullish

## Алгоритм Sentiment Analysis

### Взвешенная Система (OnChain Component)

```
Total Score = Basic(40%) + Advanced(40%) + Trends(20%)
```

#### Basic Metrics (40%)
- Whale Activity (динамические пороги на основе percentile)
- Exchange Net Flow (outflow = bullish)
- Active Addresses (percentile-based)

#### Advanced Metrics (40%)
- MVRV Ratio (±20-30 points)
- NUPL (±25-35 points)
- SOPR (±5-10 points)
- Puell Multiple (±15-25 points, BTC only)
- Exchange Reserve Trend (±5 points)

#### Trend Indicators (20%)
- 7-day momentum анализ
- MVRV trend
- NUPL trend
- Exchange Reserve trend

### Динамические Пороги

Вместо жестких значений используются **percentiles**:
- > 80th percentile = Top 20% → Bullish
- < 20th percentile = Bottom 20% → Bearish

Преимущества:
- Адаптация к рыночным условиям
- Работает в bull и bear рынках
- Учитывает волатильность

### Confidence Calculation

Базовая confidence: **70%**

**Повышение confidence (+5-10%):**
- Экстремальные значения MVRV (< 1.0 или > 3.7)
- Экстремальные значения NUPL (< 0 или > 0.75)
- Экстремальные значения Puell (< 0.5 или > 4)
- Сильные тренды (|momentum| > 0.5)

**Результат:** 0-100%

## API Usage

### Получение метрик

```bash
# Latest metrics
GET /api/market-data/on-chain/metrics/BTC/latest
GET /api/market-data/on-chain/metrics/ETH/latest

# Historical metrics
GET /api/market-data/on-chain/metrics/BTC?from=<timestamp>&to=<timestamp>&limit=100
```

### Response Example

```json
{
  "blockchain": "BTC",
  "timestamp": 1696248000000,
  "whaleTransactions": {
    "count": 15,
    "totalVolume": 1250.5
  },
  "exchangeFlow": {
    "inflow": 500.2,
    "outflow": 750.8,
    "netFlow": -250.6
  },
  "activeAddresses": 850000,
  "nvtRatio": 45.2,
  "marketCap": 580000000000,
  "transactionVolume": 12500000,
  "mvrvRatio": 1.35,
  "nupl": 0.15,
  "sopr": 1.02,
  "puellMultiple": 1.8,
  "stockToFlow": 52.5,
  "exchangeReserve": 2450000
}
```

## Sentiment Analysis

### Composite Sentiment

```bash
GET /api/analytics/sentiment/composite?symbol=BTCUSDT
```

### Response with OnChain Component

```json
{
  "symbol": "BTCUSDT",
  "compositeScore": 45.2,
  "compositeSignal": "BULLISH",
  "confidence": 87,
  "components": {
    "onChain": {
      "score": 52.1,
      "signal": "BULLISH",
      "weight": 10,
      "confidence": 85
    }
  }
}
```

## Конфигурация

### Environment Variables

```bash
# OnChain Service
ENABLED_CHAINS=BTC,ETH
CMC_API_KEY=your-coinmarketcap-api-key
ETHERSCAN_API_KEY=your-etherscan-api-key
BLOCKCHAIR_API_KEY=  # Optional

# Update Settings
ON_CHAIN_UPDATE_INTERVAL_MS=300000  # 5 минут
WHALE_THRESHOLD_BTC=10
WHALE_THRESHOLD_ETH=100

# Whale Alerts
WHALE_ALERT_ENABLED=true
WHALE_ALERT_BTC_THRESHOLD=50
WHALE_ALERT_ETH_THRESHOLD=500
WHALE_ALERT_EXCHANGE_THRESHOLD=100
```

## Интерпретация Сигналов

### Bullish Signals (Score > +30)
- MVRV < 1.0 (undervalued)
- NUPL < 0 (capitulation)
- Puell < 0.5 (cycle bottom)
- Strong exchange outflow
- Increasing whale activity
- Positive momentum trends

### Bearish Signals (Score < -30)
- MVRV > 3.7 (overvalued)
- NUPL > 0.75 (euphoria)
- Puell > 4 (cycle top)
- Strong exchange inflow
- Decreasing whale activity
- Negative momentum trends

## Best Practices

1. **Комбинируйте метрики** - одна метрика может давать ложные сигналы
2. **Смотрите на тренды** - direction важнее текущего значения
3. **Учитывайте context** - bull vs bear market
4. **Проверяйте confidence** - > 70% = более надежный сигнал
5. **Используйте multiple timeframes** - 7-day trends + real-time data

## Limitations

### Bitcoin (BTC)
- MVRV: оценочный (Realized Cap approximation)
- Puell Multiple: использует оценку 365-day MA
- Exchange Reserve: sample-based extrapolation

### Ethereum (ETH)
- MVRV: оценочный (65% ratio approximation)
- No Puell Multiple (не применимо к PoS)
- No Stock-to-Flow (нет фиксированной эмиссии)

### General
- API rate limits могут влиять на частоту обновлений
- Exchange addresses могут быть неполными
- Historical data требует >= 3 точек для трендов

## Testing

```bash
# Run Bitcoin tests
bun test apps/market-data/src/fetchers/bitcoin-mempool.test.ts

# Run Ethereum tests  
bun test apps/market-data/src/fetchers/ethereum.test.ts

# Run Sentiment Analysis tests
bun test apps/analytics/src/services/sentiment/sentiment-analysis.test.ts
```

## Resources

- [MVRV Ratio Explanation](https://academy.glassnode.com/indicators/mvrv)
- [NUPL Guide](https://academy.glassnode.com/indicators/nupl)
- [Puell Multiple Analysis](https://www.lookintobitcoin.com/charts/puell-multiple/)
- [Stock-to-Flow Model](https://www.lookintobitcoin.com/charts/stock-to-flow-model/)

