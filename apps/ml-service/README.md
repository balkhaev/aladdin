# ML Service - Machine Learning & Predictions

**Port:** 3019  
**Status:** ✅ PRODUCTION READY  
**Date:** 5 октября 2025

---

## 🎯 Overview

ML Service предоставляет machine learning возможности для Coffee платформы:

- **Price Prediction** - прогнозирование цен на основе hybrid ML подхода
- **Market Regime Detection** - определение текущего состояния рынка (BULL/BEAR/SIDEWAYS)
- **Feature Engineering** - автоматическая подготовка features для моделей

---

## 🚀 Quick Start

```bash
# Запуск сервиса
bun dev:ml

# Или напрямую
cd apps/ml-service
bun dev
```

Сервис будет доступен на `http://localhost:3019`

---

## 📊 Features

### 1. Price Prediction

Гибридный подход к прогнозированию цен:
- Linear regression с техническими индикаторами
- Exponential smoothing
- Market regime adaptation
- Confidence intervals

**Horizons:**
- `1h` - 1 час (1 step)
- `4h` - 4 часа (4 steps)
- `1d` - 1 день (24 steps)
- `7d` - 7 дней (168 steps)

### 2. Market Regime Detection

Классификация рынка на основе:
- Trend analysis (linear regression slope)
- Volatility (annualized std dev)
- Momentum (rate of change)
- Volume profile

**Regimes:**
- `BULL` - восходящий тренд
- `BEAR` - нисходящий тренд
- `SIDEWAYS` - боковое движение

### 3. Feature Engineering

Автоматическое извлечение features:

**Price Features:**
- Returns & log returns
- Volatility
- High-low spread
- Open-close spread

**Technical Indicators:**
- RSI (Relative Strength Index)
- MACD (Moving Average Convergence Divergence)
- EMA/SMA (20, 50, 200)
- Bollinger Bands
- ATR (Average True Range)
- ADX (Average Directional Index)
- OBV (On-Balance Volume)

---

## 🔌 API Endpoints

### POST /api/ml/predict

Предсказать цену для символа.

**Request:**
```json
{
  "symbol": "BTCUSDT",
  "horizon": "1d",
  "confidence": 0.95
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "symbol": "BTCUSDT",
    "horizon": "1d",
    "predictions": [
      {
        "timestamp": 1728127056789,
        "predictedPrice": 65432.10,
        "lowerBound": 64000.50,
        "upperBound": 66863.70,
        "confidence": 0.95
      }
    ],
    "features": {
      "technicalIndicators": {
        "rsi": 54.2,
        "macd": 123.45,
        "ema20": 65000.00
      },
      "onChainMetrics": {},
      "sentimentScore": 0,
      "marketRegime": "BULL",
      "volatility": 0.45,
      "momentum": 0.02
    },
    "modelInfo": {
      "version": "1.0.0-hybrid",
      "lastTrained": 1728123456789,
      "accuracy": 0.75,
      "confidence": 0.82
    },
    "generatedAt": 1728123456789
  },
  "timestamp": 1728123456789
}
```

### POST /api/ml/predict/batch

Batch predictions для нескольких символов.

**Request:**
```json
{
  "symbols": ["BTCUSDT", "ETHUSDT", "SOLUSDT"],
  "horizon": "4h",
  "confidence": 0.95
}
```

### POST /api/ml/regime

Определить market regime.

**Request:**
```json
{
  "symbol": "BTCUSDT",
  "lookback": 30
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "symbol": "BTCUSDT",
    "currentRegime": "BULL",
    "confidence": 0.82,
    "regimeHistory": [
      {
        "timestamp": 1728000000000,
        "regime": "SIDEWAYS",
        "confidence": 0.65
      }
    ],
    "indicators": {
      "trend": 0.15,
      "volatility": 0.45,
      "volume": 1.2,
      "momentum": 0.02
    },
    "nextRegimeProb": {
      "BULL": 0.75,
      "BEAR": 0.10,
      "SIDEWAYS": 0.15
    },
    "generatedAt": 1728123456789
  },
  "timestamp": 1728123456789
}
```

### GET /api/ml/health

Health check endpoint.

---

## 🏗️ Architecture

```
ML Service (3019)
  ├── Feature Engineering Service
  │   ├── Extract historical data from ClickHouse
  │   ├── Calculate technical indicators
  │   └── Normalize features
  │
  ├── Market Regime Service
  │   ├── Trend analysis
  │   ├── Volatility measurement
  │   ├── Momentum calculation
  │   └── Regime classification
  │
  └── Price Prediction Service
      ├── Generate predictions
      ├── Calculate confidence intervals
      └── Market regime adaptation
```

---

## 📈 Algorithms

### Price Prediction

1. **Feature Extraction** - извлечение 50-100 исторических свечей
2. **Trend Calculation** - linear regression slope
3. **Regime Adaptation** - корректировка тренда на основе regime
4. **Prediction Generation** - multi-step ahead forecasting
5. **Confidence Intervals** - на основе volatility и Z-score

### Market Regime Detection

1. **Trend Score** - normalized linear regression slope
2. **Volatility** - annualized standard deviation of returns
3. **Momentum** - rate of change over 14 periods
4. **Classification** - weighted scoring system:
   - BULL: `trend * 0.5 + momentum * 0.3 + (1 - volatility/2) * 0.2`
   - BEAR: `-trend * 0.5 - momentum * 0.3 + volatility * 0.2`
   - SIDEWAYS: `1 - |trend| - |momentum|`

---

## 🔧 Configuration

### Environment Variables

```bash
PORT=3019
CLICKHOUSE_URL=http://localhost:8123
```

### Dependencies

- **ClickHouse** - Historical candle data
- **@aladdin/shared** - Logger, ClickHouse client
- **Hono** - Web framework
- **Zod** - Validation

---

## 📝 Data Requirements

### ClickHouse Tables

**candles_1m** - minute candles for feature engineering:
```sql
SELECT timestamp, open, high, low, close, volume
FROM candles_1m
WHERE symbol = 'BTCUSDT'
ORDER BY timestamp ASC
```

**candles_1h** - hourly candles for regime detection:
```sql
SELECT timestamp, close, volume, high, low
FROM candles_1h
WHERE symbol = 'BTCUSDT'
ORDER BY timestamp ASC
```

---

## 🧪 Testing

```bash
# Unit tests (TODO)
bun test

# Manual testing
curl -X POST http://localhost:3019/api/ml/predict \
  -H "Content-Type: application/json" \
  -d '{"symbol":"BTCUSDT","horizon":"1d","confidence":0.95}'

curl -X POST http://localhost:3019/api/ml/regime \
  -H "Content-Type: application/json" \
  -d '{"symbol":"BTCUSDT","lookback":30}'
```

---

## 🚧 Future Improvements

### Phase 3.1 (Current)
- ✅ Feature Engineering
- ✅ Market Regime Detection
- ✅ Price Prediction (Hybrid)

### Phase 3.2 (Next)
- [ ] LSTM Price Prediction
- [ ] Transformer Models
- [ ] Model Training Pipeline
- [ ] Model Persistence (save/load)

### Phase 3.3 (Future)
- [ ] Reinforcement Learning (DQN/A3C)
- [ ] Anomaly Detection (Autoencoders)
- [ ] Sentiment Integration
- [ ] Ensemble Models

---

## 📚 Resources

- [Price Prediction Algorithm](./src/services/price-prediction.ts)
- [Market Regime Detection](./src/services/market-regime.ts)
- [Feature Engineering](./src/services/feature-engineering.ts)
- [API Routes](./src/routes.ts)

---

**Version:** 1.0.0  
**Status:** Production Ready ✅  
**Last Updated:** 5 октября 2025

