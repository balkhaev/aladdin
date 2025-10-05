# Machine Learning Guide

**Статус:** ✅ Production Ready  
**Последнее обновление:** 5 октября 2025

Полное руководство по ML возможностям платформы: предсказание цен, аномалии, оптимизация параметров, бэктестинг.

---

## 📊 Price Prediction

### LSTM Model

**Архитектура:**

- Input: нормализованные цены (20 свечей)
- Hidden: 32 LSTM units
- Output: предсказанная цена
- Learning Rate: 0.001, Epochs: 100

**Features:**

- Multi-step ahead forecasting
- Uncertainty quantification (confidence intervals)
- Model persistence & caching (24h TTL)
- Automatic feature engineering

**API:**

```bash
GET /api/ml/predict/lstm?symbol=BTCUSDT&horizon=24h
```

### Hybrid Model

**Компоненты:**

- Linear Regression (trend)
- Exponential Smoothing (noise reduction)
- Fast training & inference

**Best for:** Short-term predictions (1-4 hours)

**API:**

```bash
GET /api/ml/predict/hybrid?symbol=BTCUSDT&horizon=24h
```

### Ensemble Prediction

**Стратегии:**

1. **Weighted Average** - balanced 50/50, stable predictions
2. **Voting** - direction-focused, +10% confidence when models agree
3. **Stacking** - regime-adaptive, LSTM for trends, Hybrid for sideways

**Expected improvement:** +5-15% accuracy

**API:**

```bash
GET /api/ml/predict/ensemble?symbol=BTCUSDT&horizon=24h&strategy=stacking
```

**Response:**

```json
{
  "predictions": [
    {
      "timestamp": "2025-10-06T12:00:00Z",
      "price": 52500,
      "confidence": 0.85,
      "lowerBound": 51000,
      "upperBound": 54000
    }
  ],
  "model": "ensemble",
  "modelAgreement": 0.92
}
```

---

## 🚨 Anomaly Detection

### Pump & Dump Detection

**Индикаторы:**

- Volume spike (>100-500%)
- Price momentum (>10% rapid increase)
- Rapidity score (speed of movement)
- Sustainability score (likelihood of reversal)

**Scoring:**

- 0-30 pts: Volume analysis
- 0-30 pts: Price magnitude
- 0-20 pts: Speed
- 0-20 pts: Reversal risk

**Severity Levels:**

- 80-100: CRITICAL - очень вероятный pump & dump
- 70-79: HIGH - сильные индикаторы
- 60-69: MEDIUM - есть предупреждающие знаки
- 50-59: LOW - небольшие опасения

### Flash Crash Risk

**Индикаторы:**

- Liquidation risk calculation
- Order book imbalance (bid/ask ratio < 0.7)
- Market depth analysis
- Cascade risk scoring

**Risk Levels:**

- 80-100: CRITICAL - очень высокий риск краха
- 70-79: HIGH - значительный риск
- 60-69: MEDIUM - умеренный риск
- 50-59: LOW - небольшой риск

**API:**

```bash
GET /api/ml/anomalies/detect?symbol=BTCUSDT
GET /api/ml/anomalies/pump-dump?symbol=BTCUSDT&window=24h
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

---

## 🧪 Backtesting Framework

### Evaluation Metrics

| Метрика                | Описание                       | Формула                          | Хорошее значение           |
| ---------------------- | ------------------------------ | -------------------------------- | -------------------------- |
| **MAE**                | Mean Absolute Error            | Σ\|predicted - actual\| / n      | < 2% от цены               |
| **RMSE**               | Root Mean Squared Error        | sqrt(Σ(predicted - actual)² / n) | ≈ MAE (равномерные ошибки) |
| **MAPE**               | Mean Absolute Percentage Error | Σ\|error / actual\| × 100 / n    | < 5%                       |
| **R²**                 | Coefficient of Determination   | 1 - (SS_res / SS_tot)            | > 0.7 (70%)                |
| **Direction Accuracy** | Правильность направления       | correct_directions / total       | > 60%                      |

### Backtesting Methods

**1. Simple Backtest**

- Single training period
- Single test period
- Fast, good for initial testing

**2. Walk-Forward Testing**

- Periodic retraining (каждые 7-30 дней)
- Rolling window approach
- More realistic, accounts for regime changes

**3. Model Comparison**

- LSTM vs Hybrid
- Side-by-side metrics
- Best model selection

**API:**

```bash
POST /api/ml/backtest/simple
POST /api/ml/backtest/walk-forward
POST /api/ml/backtest/compare
```

**Request Body:**

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

---

## 🎯 Hyperparameter Optimization

### Optimization Methods

**1. Grid Search**

- Exhaustive search всех комбинаций
- Гарантированно находит лучший результат в заданном пространстве
- Медленнее, но надежнее

**2. Random Search**

- Random sampling из параметрального пространства
- Быстрее на больших пространствах
- Good coverage с меньшими вычислениями

### Optimized Parameters

**LSTM:**

- `hiddenSize`: [16, 32, 64] - affects model capacity
- `sequenceLength`: [10, 20, 30] - lookback window
- `learningRate`: [0.0001, 0.001, 0.01] - training step size
- `epochs`: [50, 100, 200] - training iterations

**Hybrid:**

- `lookbackWindow`: [20, 30, 50] - historical data window
- `smoothingFactor`: [0.1, 0.2, 0.3] - exponential smoothing alpha

**General:**

- `retrainInterval`: [7, 14, 30] - days between retraining

### Optimization Metrics

Можно оптимизировать по:

- **MAE** - минимизация средней ошибки
- **RMSE** - минимизация квадратичной ошибки (штраф за выбросы)
- **MAPE** - минимизация процентной ошибки
- **R²** - максимизация explained variance
- **Direction** - максимизация правильности направления

**API:**

```bash
POST /api/ml/hpo/optimize
GET /api/ml/hpo/results/:jobId
GET /api/ml/hpo/list
```

**Request Body:**

```json
{
  "symbol": "BTCUSDT",
  "model": "LSTM",
  "method": "grid",
  "metric": "mae",
  "parameterSpace": {
    "hiddenSize": [16, 32, 64],
    "sequenceLength": [10, 20, 30],
    "learningRate": [0.001, 0.01]
  },
  "trainStart": "2024-01-01",
  "trainEnd": "2024-09-01",
  "testStart": "2024-09-01",
  "testEnd": "2024-10-01"
}
```

**Response:**

```json
{
  "jobId": "hpo_abc123",
  "status": "completed",
  "trials": [
    {
      "parameters": {
        "hiddenSize": 32,
        "sequenceLength": 20,
        "learningRate": 0.001
      },
      "metrics": {
        "mae": 245.3,
        "rmse": 356.8,
        "mape": 0.48,
        "r2": 0.87,
        "directionalAccuracy": 0.75
      }
    }
  ],
  "bestParameters": {
    "hiddenSize": 32,
    "sequenceLength": 20,
    "learningRate": 0.001
  },
  "improvement": 12.5
}
```

---

## 📈 Best Practices

### Model Selection

**Use LSTM when:**

- Long-term predictions (24h+)
- Trending markets (bull/bear)
- Complex patterns
- You have computational resources

**Use Hybrid when:**

- Short-term predictions (1-4h)
- Sideways markets
- Need fast inference
- Resource-constrained

**Use Ensemble when:**

- Maximum accuracy needed
- Uncertain market regime
- Can afford latency (+20-50ms)
- Production deployment

### Performance Guidelines

**Training:**

- LSTM: 2-5 minutes (100 epochs)
- Hybrid: 10-30 seconds
- Ensemble: combines pre-trained models (fast)

**Inference:**

- LSTM: 50-100ms
- Hybrid: 10-20ms
- Ensemble: 70-150ms

**Cache Strategy:**

- Cache predictions for 1h (hot data)
- Retrain models daily or on significant market changes
- Use stale predictions if inference fails

### Monitoring

**Track metrics:**

- Prediction MAE/RMSE (should be < 5% of price)
- Directional accuracy (should be > 60%)
- Model agreement (ensemble models, should be > 70%)
- Cache hit rate (should be > 80%)

**Alerts:**

- MAE spike > 10%
- Directional accuracy drop < 50%
- Anomaly detected (CRITICAL severity)
- Model training failure

---

## 🔧 Configuration

### Environment Variables

```bash
# ML Service
ML_MODEL_CACHE_TTL=86400  # 24h
ML_LSTM_HIDDEN_SIZE=32
ML_LSTM_SEQUENCE_LENGTH=20
ML_LSTM_LEARNING_RATE=0.001
ML_LSTM_EPOCHS=100

# Anomaly Detection
ML_PUMP_VOLUME_THRESHOLD=100  # %
ML_PUMP_PRICE_THRESHOLD=10    # %
ML_CRASH_LIQUIDATION_THRESHOLD=30  # %
```

### Model Files

Модели сохраняются в:

```
apps/ml-service/models/
  ├── lstm_BTCUSDT_v1.json
  ├── lstm_ETHUSDT_v1.json
  └── hybrid_BTCUSDT_v1.json
```

**Формат:**

- Weights & biases в JSON
- Metadata (training date, accuracy metrics)
- 24h TTL (автоматическое переобучение)

---

## 🐛 Troubleshooting

### Model Not Training

**Проблема:** Model training fails или accuracy < 50%

**Решения:**

1. Check data quality (минимум 1000 candles)
2. Adjust learning rate (try 0.0001, 0.001, 0.01)
3. Increase epochs (try 200+)
4. Check for data gaps (fill missing data)

### Poor Predictions

**Проблема:** High MAE/RMSE, low R²

**Решения:**

1. Use HPO to find better parameters
2. Try ensemble prediction
3. Check market regime (LSTM for trends, Hybrid for sideways)
4. Increase training data window

### Anomalies Not Detecting

**Проблема:** False negatives/positives

**Решения:**

1. Adjust thresholds (volume_threshold, price_threshold)
2. Use shorter windows for faster detection
3. Combine with sentiment analysis
4. Check data freshness

---

## 📚 Further Reading

- [API Reference](./API_REFERENCE.md) - все ML endpoints
- [Roadmap](./ROADMAP.md) - будущие улучшения
- [LSTM Paper](https://www.bioinf.jku.at/publications/older/2604.pdf) - original LSTM paper
- [Ensemble Methods](https://scikit-learn.org/stable/modules/ensemble.html) - ensemble learning

---

**Все ML функции протестированы и готовы к production использованию.** ✅
