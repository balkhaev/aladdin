# 📊 Backtesting Framework

**Проверка точности ML predictions на исторических данных**

---

## 🎯 Что это?

Backtesting Framework позволяет:

- ✅ Тестировать модели на исторических данных
- ✅ Сравнивать LSTM vs Hybrid модели
- ✅ Оценивать точность predictions
- ✅ Использовать Walk-Forward Testing (периодическое переобучение)
- ✅ Получать метрики производительности (MAE, RMSE, MAPE, R², Direction)

---

## 📈 Evaluation Metrics

### MAE (Mean Absolute Error)

```typescript
MAE = Σ|predicted - actual| / n
```

**Значение:** Средняя абсолютная ошибка в долларах.

- ✅ Низкий MAE = хорошая точность
- ❌ Высокий MAE = плохая точность

**Пример:** MAE = 100 означает, что модель ошибается в среднем на $100

---

### RMSE (Root Mean Squared Error)

```typescript
RMSE = sqrt(Σ(predicted - actual)² / n)
```

**Значение:** Корень из средней квадратичной ошибки.

- Штрафует большие ошибки сильнее, чем MAE
- RMSE ≥ MAE всегда
- ✅ RMSE ≈ MAE = хорошо (ошибки распределены равномерно)
- ❌ RMSE >> MAE = плохо (есть выбросы/большие ошибки)

---

### MAPE (Mean Absolute Percentage Error)

```typescript
MAPE = (Σ|predicted - actual| / actual) / n * 100
```

**Значение:** Средняя абсолютная процентная ошибка.

- Показывает ошибку в процентах от actual цены
- ✅ MAPE < 5% = отличная модель
- ⚠️ MAPE 5-10% = хорошая модель
- ❌ MAPE > 10% = плохая модель

**Пример:** MAPE = 3% означает, что модель ошибается в среднем на 3%

---

### R² Score (Coefficient of Determination)

```typescript
R² = 1 - (Σ(actual - predicted)² / Σ(actual - mean)²)
```

**Значение:** Процент variance в данных, объясненный моделью.

- Range: -∞ to 1
- ✅ R² = 1 = идеальная модель
- ✅ R² > 0.8 = отличная модель
- ⚠️ R² 0.5-0.8 = средняя модель
- ❌ R² < 0.5 = плохая модель
- ❌ R² < 0 = модель хуже чем среднее значение

---

### Directional Accuracy

```typescript
Directional Accuracy = (Correct Directions / Total) * 100
```

**Значение:** Процент правильных направлений (вверх/вниз).

- ✅ > 55% = profitable (для trading)
- ⚠️ ~50% = random guessing
- ❌ < 50% = worse than random

**Важно:** Для trading strategies directional accuracy важнее, чем точность цены!

---

## 🔄 Backtesting Modes

### 1. Simple Backtest

**Описание:** Одна модель, обучается один раз, тестируется на всех данных.

**Использование:**

- Quick evaluation
- Сравнение разных моделей
- Не retraining

**Пример:**

```bash
POST /api/ml/backtest
{
  "symbol": "BTCUSDT",
  "modelType": "LSTM",
  "horizon": "1h",
  "startDate": 1696118400000, // 1 окт 2023
  "endDate": 1727740800000,   // 1 окт 2024
  "walkForward": false
}
```

---

### 2. Walk-Forward Testing

**Описание:** Модель переобучается периодически на новых данных.

**Преимущества:**

- ✅ Более реалистичный (модель адаптируется)
- ✅ Учитывает market regime changes
- ✅ Closer to production

**Недостатки:**

- ❌ Медленнее (multiple retrainings)
- ❌ Требует больше данных

**Пример:**

```bash
POST /api/ml/backtest
{
  "symbol": "BTCUSDT",
  "modelType": "LSTM",
  "horizon": "1h",
  "startDate": 1696118400000,
  "endDate": 1727740800000,
  "walkForward": true,
  "retrainInterval": 30  // Retrain каждые 30 дней
}
```

**How it works:**

1. Train model on first N days
2. Test for next 30 days
3. Retrain on new data (including last 30 days)
4. Test for next 30 days
5. Repeat...

---

## 🆚 Comparing Models

### LSTM vs Hybrid

**Usage:**

```bash
POST /api/ml/backtest/compare
{
  "symbol": "BTCUSDT",
  "horizon": "1h",
  "startDate": 1696118400000,
  "endDate": 1727740800000,
  "walkForward": true,
  "retrainInterval": 30
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "lstm": {
      "config": { ... },
      "metrics": {
        "mae": 85.32,
        "rmse": 120.45,
        "mape": 2.8,
        "r2Score": 0.89,
        "directionalAccuracy": 62.4
      },
      "predictions": [ ... ]
    },
    "hybrid": {
      "config": { ... },
      "metrics": {
        "mae": 120.56,
        "rmse": 165.34,
        "mape": 4.2,
        "r2Score": 0.75,
        "directionalAccuracy": 58.1
      },
      "predictions": [ ... ]
    },
    "comparison": {
      "winner": "LSTM",
      "lstmBetter": ["MAE", "RMSE", "MAPE", "R²", "Directional Accuracy"],
      "hybridBetter": []
    }
  }
}
```

---

## 📊 Backtest Result Structure

```typescript
{
  "config": {
    "symbol": "BTCUSDT",
    "modelType": "LSTM",
    "horizon": "1h",
    "startDate": 1696118400000,
    "endDate": 1727740800000,
    "walkForward": true,
    "retrainInterval": 30
  },
  "metrics": {
    "mae": 85.32,           // Mean Absolute Error ($)
    "rmse": 120.45,         // Root Mean Squared Error ($)
    "mape": 2.8,            // Mean Absolute Percentage Error (%)
    "r2Score": 0.89,        // R² Score (0-1)
    "directionalAccuracy": 62.4,  // Directional accuracy (%)
    "meanError": -5.2,      // Mean Error (bias)
    "maxError": 450.0,      // Max Error
    "minError": -380.0      // Min Error
  },
  "predictions": [
    {
      "timestamp": 1696122000000,
      "actual": 28500.00,
      "predicted": 28420.50,
      "error": -79.50,
      "percentError": -0.28,
      "correctDirection": true
    }
    // ... more predictions
  ],
  "summary": {
    "totalPredictions": 365,
    "successfulPredictions": 362,
    "failedPredictions": 3,
    "averageConfidence": 0.85,
    "modelRetrains": 12
  },
  "executionTime": 45000,  // ms
  "completedAt": 1728127056789
}
```

---

## 📐 Example Use Cases

### 1. Quick Model Evaluation

**Goal:** Быстро проверить, работает ли модель

```bash
POST /api/ml/backtest
{
  "symbol": "BTCUSDT",
  "modelType": "LSTM",
  "horizon": "1h",
  "startDate": 1727568000000,  // Last 7 days
  "endDate": 1727740800000,
  "walkForward": false
}
```

**Expected execution time:** 10-15 seconds

---

### 2. Production Readiness Test

**Goal:** Проверить модель на реальных условиях

```bash
POST /api/ml/backtest
{
  "symbol": "BTCUSDT",
  "modelType": "LSTM",
  "horizon": "1h",
  "startDate": 1696118400000,  // Last 1 year
  "endDate": 1727740800000,
  "walkForward": true,
  "retrainInterval": 30
}
```

**Expected execution time:** 2-5 minutes

---

### 3. Model Selection

**Goal:** Выбрать лучшую модель для production

```bash
POST /api/ml/backtest/compare
{
  "symbol": "BTCUSDT",
  "horizon": "1h",
  "startDate": 1696118400000,
  "endDate": 1727740800000,
  "walkForward": true
}
```

**Result:**

- Winner: LSTM (4 metrics better)
- Use LSTM for production

---

### 4. Different Horizons

**Goal:** Найти optimal prediction horizon

```typescript
// Test all horizons
for (const horizon of ["1h", "4h", "1d", "7d"]) {
  const result = await backtest({
    symbol: "BTCUSDT",
    modelType: "LSTM",
    horizon,
    startDate: 1696118400000,
    endDate: 1727740800000,
  })

  console.log(
    `${horizon}: MAE=${result.metrics.mae}, Accuracy=${result.metrics.directionalAccuracy}%`
  )
}
```

**Expected result:**

- 1h: MAE=85, Accuracy=62% ✅ (best for short-term)
- 4h: MAE=180, Accuracy=60%
- 1d: MAE=420, Accuracy=58%
- 7d: MAE=1200, Accuracy=52% ❌ (too uncertain)

---

## 🎨 Interpretation Guide

### Good Model Signs

✅ MAPE < 5%
✅ R² > 0.8
✅ Directional Accuracy > 55%
✅ RMSE ≈ MAE (no outliers)
✅ Mean Error ≈ 0 (no bias)

### Bad Model Signs

❌ MAPE > 10%
❌ R² < 0.5
❌ Directional Accuracy < 52%
❌ RMSE >> MAE (large outliers)
❌ Mean Error ≠ 0 (bias)

### Example Scenarios

#### Scenario 1: Good Model

```json
{
  "mae": 85.32,
  "rmse": 95.45,
  "mape": 2.8,
  "r2Score": 0.89,
  "directionalAccuracy": 62.4
}
```

**Analysis:** ✅ Excellent model! Deploy to production.

#### Scenario 2: Overfitting

```json
{
  "mae": 45.2,
  "rmse": 320.5,
  "mape": 3.1,
  "r2Score": 0.45,
  "directionalAccuracy": 51.2
}
```

**Analysis:** ❌ Low MAE but high RMSE = overfitting. Model breaks on outliers.

#### Scenario 3: Biased Model

```json
{
  "mae": 95.32,
  "rmse": 110.45,
  "mape": 3.5,
  "r2Score": 0.82,
  "directionalAccuracy": 62.1,
  "meanError": 85.2
}
```

**Analysis:** ⚠️ Good metrics but high mean error = model is consistently overestimating. Needs bias correction.

---

## 🔧 Tips & Best Practices

### 1. Minimum Data Requirements

- **Simple Backtest:** Minimum 7 days (168 hours for 1h predictions)
- **Walk-Forward:** Minimum 90 days for reliable results

### 2. Retrain Interval

- **1h predictions:** Retrain every 7-14 days
- **4h predictions:** Retrain every 14-30 days
- **1d predictions:** Retrain every 30-60 days
- **7d predictions:** Retrain every 60-90 days

### 3. Data Splits

For production models:

- **Training:** 70% of data
- **Validation:** 15% of data
- **Testing (backtest):** 15% of data

### 4. When to Use Each Mode

**Simple Backtest:**

- Quick model evaluation
- Development phase
- Comparing architectures

**Walk-Forward:**

- Production readiness test
- Final model selection
- Performance reporting

---

## 🚀 Next Steps

After backtesting:

1. ✅ Choose best model (LSTM or Hybrid)
2. ✅ Choose best horizon (1h, 4h, 1d)
3. ✅ Set retrain schedule
4. ⏳ Deploy to production
5. ⏳ Monitor live performance
6. ⏳ A/B testing

---

## 📚 References

### Academic Papers

- **Bergmeir & Benítez (2012)** - "On the use of cross-validation for time series predictor evaluation"
- **Tashman (2000)** - "Out-of-sample tests of forecasting accuracy"

### Resources

- [Time Series Cross-Validation](https://stats.stackexchange.com/questions/14099/using-k-fold-cross-validation-for-time-series-model-selection)
- [Walk-Forward Analysis](https://www.investopedia.com/terms/w/walkforward.asp)

---

**Status:** Production Ready ✅
**Last Updated:** 5 октября 2025
