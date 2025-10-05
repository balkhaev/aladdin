# 🎯 Hyperparameter Optimization (HPO)

**Автоматический подбор параметров для ML моделей**

---

## 🎯 Что это?

Hyperparameter Optimization автоматически находит оптимальные параметры для ML моделей путем систематического тестирования различных комбинаций и выбора лучшей на основе метрик производительности.

**Преимущества:**

- ✅ Автоматический подбор параметров (не нужно гадать)
- ✅ Повышение точности моделей (5-15% improvement)
- ✅ Систематический поиск (grid search, random search)
- ✅ Объективная оценка (backtesting на исторических данных)
- ✅ Воспроизводимые результаты

---

## 📊 Оптимизируемые параметры

### LSTM Model

| Parameter | Description | Default Range | Impact |
|-----------|-------------|---------------|--------|
| **hiddenSize** | Number of LSTM units | [16, 32, 64] | High - affects model capacity |
| **sequenceLength** | Lookback window | [10, 20, 30] | High - affects context |
| **learningRate** | Training step size | [0.0001, 0.001, 0.01] | Medium - affects convergence |
| **epochs** | Training iterations | [50, 100, 200] | Medium - affects fit |

### Hybrid Model

| Parameter | Description | Default Range | Impact |
|-----------|-------------|---------------|--------|
| **lookbackWindow** | Historical data window | [20, 30, 50] | High - affects trend detection |
| **smoothingFactor** | Exponential smoothing alpha | [0.1, 0.2, 0.3] | Medium - affects noise reduction |

### General

| Parameter | Description | Default Range | Impact |
|-----------|-------------|---------------|--------|
| **retrainInterval** | Days between retraining | [7, 14, 30] | Medium - affects adaptation |

---

## 🔍 Optimization Methods

### 1. Grid Search

**Description:** Test ALL combinations of hyperparameters

**How it works:**

```typescript
hiddenSize: [16, 32, 64]
sequenceLength: [10, 20, 30]
learningRate: [0.0001, 0.001, 0.01]

// Total combinations = 3 × 3 × 3 = 27 trials
```

**Pros:**
- ✅ Exhaustive search (guaranteed to find best in space)
- ✅ Simple to understand
- ✅ Reproducible results

**Cons:**
- ❌ Slow (exponential growth with parameters)
- ❌ Computationally expensive

**Best for:**
- Small parameter spaces (< 50 combinations)
- Critical models requiring best performance
- When computational resources available

---

### 2. Random Search

**Description:** Test RANDOM combinations of hyperparameters

**How it works:**

```typescript
nTrials = 20

for i in range(20):
  hiddenSize = random.choice([16, 32, 64])
  sequenceLength = random.choice([10, 20, 30])
  learningRate = random.choice([0.0001, 0.001, 0.01])
  
  // Test this combination
```

**Pros:**
- ✅ Fast (fixed number of trials)
- ✅ Scales to large parameter spaces
- ✅ Often finds "good enough" solutions

**Cons:**
- ❌ May miss optimal combination
- ❌ Results vary between runs

**Best for:**
- Large parameter spaces (> 50 combinations)
- Quick prototyping
- When computational resources limited

---

## 📈 Optimization Metrics

Choose the metric that aligns with your goal:

### MAE (Mean Absolute Error)

```typescript
optimizationMetric: "mae"
```

**Goal:** Minimize average prediction error in dollars

**Use when:** You want predictions close to actual price

**Example:** MAE = $85 → model is off by $85 on average

---

### RMSE (Root Mean Squared Error)

```typescript
optimizationMetric: "rmse"
```

**Goal:** Minimize error with penalty for large mistakes

**Use when:** You want to avoid outliers

**Example:** RMSE = $120 → penalizes large errors more than MAE

---

### MAPE (Mean Absolute Percentage Error)

```typescript
optimizationMetric: "mape"
```

**Goal:** Minimize relative error percentage

**Use when:** You care about proportional accuracy

**Example:** MAPE = 2.8% → model is off by 2.8% on average

---

### R² Score

```typescript
optimizationMetric: "r2Score"
```

**Goal:** Maximize explanatory power (0-1)

**Use when:** You want high correlation with actual prices

**Example:** R² = 0.89 → model explains 89% of variance

---

### Directional Accuracy

```typescript
optimizationMetric: "directionalAccuracy"
```

**Goal:** Maximize correct direction predictions

**Use when:** You're using predictions for trading decisions

**Example:** 62.4% → correct direction 62.4% of time

**Note:** Most important for trading strategies!

---

## 🚀 Usage Examples

### Example 1: Quick Optimization (Random Search)

**Goal:** Find good parameters quickly (< 1 hour)

```bash
POST /api/ml/optimize
{
  "symbol": "BTCUSDT",
  "modelType": "LSTM",
  "horizon": "1h",
  "method": "RANDOM",
  "nTrials": 20,
  "startDate": 1696118400000,  // 30 days ago
  "endDate": 1727740800000,    // now
  "optimizationMetric": "directionalAccuracy",
  "hyperparameterSpace": {
    "hiddenSize": [16, 32, 64],
    "sequenceLength": [10, 20, 30],
    "learningRate": [0.0001, 0.001, 0.01]
  }
}
```

**Expected:**
- Trials: 20
- Time: ~20-30 minutes
- Improvement: ~5-10%

---

### Example 2: Exhaustive Search (Grid Search)

**Goal:** Find best parameters (accept longer time)

```bash
POST /api/ml/optimize
{
  "symbol": "BTCUSDT",
  "modelType": "LSTM",
  "horizon": "1h",
  "method": "GRID",
  "startDate": 1696118400000,
  "endDate": 1727740800000,
  "optimizationMetric": "mape",
  "hyperparameterSpace": {
    "hiddenSize": [32, 64],
    "sequenceLength": [20, 30],
    "learningRate": [0.001, 0.01]
  }
}
```

**Expected:**
- Trials: 2 × 2 × 2 = 8
- Time: ~10-15 minutes
- Improvement: ~10-15%

---

### Example 3: Hybrid Model Optimization

```bash
POST /api/ml/optimize
{
  "symbol": "ETHUSDT",
  "modelType": "HYBRID",
  "horizon": "4h",
  "method": "GRID",
  "startDate": 1696118400000,
  "endDate": 1727740800000,
  "optimizationMetric": "r2Score",
  "hyperparameterSpace": {
    "lookbackWindow": [20, 30, 50],
    "smoothingFactor": [0.1, 0.2, 0.3]
  }
}
```

**Expected:**
- Trials: 3 × 3 = 9
- Time: ~5-10 minutes (Hybrid is faster than LSTM)
- Improvement: ~5-10%

---

## 📊 Result Example

```json
{
  "config": {
    "symbol": "BTCUSDT",
    "modelType": "LSTM",
    "method": "RANDOM",
    "nTrials": 20,
    "optimizationMetric": "directionalAccuracy"
  },
  "trials": [
    {
      "trialId": 1,
      "hyperparameters": {
        "hiddenSize": 32,
        "sequenceLength": 20,
        "learningRate": 0.001
      },
      "metrics": {
        "mae": 95.42,
        "rmse": 135.21,
        "mape": 3.2,
        "r2Score": 0.85,
        "directionalAccuracy": 58.5
      },
      "score": 58.5
    },
    // ... 19 more trials
  ],
  "bestTrial": {
    "trialId": 15,
    "hyperparameters": {
      "hiddenSize": 64,
      "sequenceLength": 30,
      "learningRate": 0.0001
    },
    "metrics": {
      "mae": 82.15,
      "rmse": 115.32,
      "mape": 2.5,
      "r2Score": 0.91,
      "directionalAccuracy": 65.2
    },
    "score": 65.2
  },
  "bestHyperparameters": {
    "hiddenSize": 64,
    "sequenceLength": 30,
    "learningRate": 0.0001
  },
  "improvementPercentage": 11.45,
  "totalExecutionTime": 1800000
}
```

**Interpretation:**

- ✅ **Best Trial:** #15 with 65.2% directional accuracy
- ✅ **Improvement:** 11.45% better than baseline (trial #1)
- ✅ **Best Parameters:** Use hiddenSize=64, sequenceLength=30, learningRate=0.0001
- ⏰ **Time:** 30 minutes total

---

## 🎯 Best Practices

### 1. Start with Random Search

**Recommended workflow:**

1. Run random search with 20 trials
2. Identify promising parameter ranges
3. Run grid search on refined ranges

**Example:**

```typescript
// Step 1: Random search (broad exploration)
Random Search: hiddenSize=[16, 32, 64, 128]

// Step 2: Results show 32-64 work best
// Step 3: Grid search (narrow exploitation)
Grid Search: hiddenSize=[32, 48, 64]
```

---

### 2. Choose Right Metric

| Goal | Metric | Reason |
|------|--------|--------|
| Trading | directionalAccuracy | Need correct direction |
| Price forecasting | mae or mape | Need close prices |
| Risk management | rmse | Penalize outliers |
| Model comparison | r2Score | Overall fit |

---

### 3. Use Sufficient Data

**Minimum requirements:**

- **Random Search:** 30 days of data
- **Grid Search:** 60 days of data
- **Production Models:** 90+ days of data

**Why:** More data = more reliable optimization results

---

### 4. Validation

**Always validate optimized model:**

```bash
# 1. Optimize on training period
POST /api/ml/optimize
{
  "startDate": 1696118400000,  // Oct 1 - Nov 30
  "endDate": 1701388800000
}

# 2. Test on validation period
POST /api/ml/backtest
{
  "startDate": 1701388800000,  // Dec 1 - Dec 31
  "endDate": 1704067200000,
  "hyperparameters": { ... best from optimization ... }
}
```

---

## ⚠️ Common Pitfalls

### 1. Overfitting

**Problem:** Model works great on optimization data, fails on new data

**Solution:** Use walk-forward testing during optimization

```json
{
  "walkForward": true,
  "retrainInterval": 30
}
```

---

### 2. Too Small Parameter Space

**Problem:** Missing optimal parameters

**Bad:**
```json
{
  "hiddenSize": [32]  // Only one value!
}
```

**Good:**
```json
{
  "hiddenSize": [16, 32, 64]  // Multiple values
}
```

---

### 3. Too Large Parameter Space

**Problem:** Grid search takes forever

**Bad (Grid Search):**
```json
{
  "hiddenSize": [16, 32, 48, 64, 80, 96, 112, 128],  // 8 values
  "sequenceLength": [10, 15, 20, 25, 30, 35, 40],    // 7 values
  "learningRate": [0.0001, 0.0005, 0.001, 0.005, 0.01]  // 5 values
}
// Total: 8 × 7 × 5 = 280 trials! 😱
```

**Good (Random Search):**
```json
{
  "method": "RANDOM",
  "nTrials": 30,
  "hyperparameterSpace": { ... same large space ... }
}
// Only 30 trials! 😊
```

---

## 🔬 Technical Details

### Algorithm Flow

```typescript
function optimize(config) {
  // 1. Generate hyperparameter combinations
  combinations = generateCombinations(config.space, config.method)
  
  // 2. Test each combination
  trials = []
  for (hyperparams of combinations) {
    // Run backtest with these hyperparameters
    result = backtest(symbol, hyperparams)
    
    // Extract score
    score = result.metrics[config.optimizationMetric]
    
    trials.push({ hyperparams, score, metrics: result.metrics })
  }
  
  // 3. Find best
  bestTrial = findBest(trials, config.optimizationMetric)
  
  // 4. Calculate improvement
  improvement = (bestTrial.score - trials[0].score) / trials[0].score
  
  return {
    trials,
    bestTrial,
    improvement
  }
}
```

---

## 📚 References

### Academic Papers

- Bergstra & Bengio (2012) - "Random Search for Hyper-Parameter Optimization"
- Snoek et al. (2012) - "Practical Bayesian Optimization of Machine Learning Algorithms"

### Resources

- [Hyperparameter Optimization Guide](https://scikit-learn.org/stable/modules/grid_search.html)
- [Random vs Grid Search](https://towardsdatascience.com/grid-search-vs-random-search-d1d44f1fc1)

---

**Status:** Production Ready ✅  
**Last Updated:** 5 октября 2025

