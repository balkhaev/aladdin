# HPO UI Guide

## Overview

The HPO (Hyperparameter Optimization) UI provides a comprehensive interface for configuring, running, and visualizing hyperparameter optimization results in the Coffee platform.

## Components

### 1. HPOConfigForm

**Location:** `apps/web/src/components/ml/hpo-config-form.tsx`

**Purpose:** Configure and submit hyperparameter optimization jobs.

**Features:**

- Symbol selection (e.g., BTCUSDT)
- Model type (LSTM / Hybrid)
- Prediction horizon (1h / 4h / 1d / 7d)
- Optimization method (Random Search / Grid Search)
- Number of trials (for Random Search)
- Historical period selection
- Optimization metric selection
- Hyperparameter space configuration
- "Use Recommended" button (loads default values from backend)
- Recommendations info card

**Example Usage:**

```tsx
<HPOConfigForm
  isLoading={isRunning}
  onSubmit={(config) => {
    runOptimization(config)
  }}
/>
```

---

### 2. HPOTrialsTable

**Location:** `apps/web/src/components/ml/hpo-trials-table.tsx`

**Purpose:** Display all optimization trials with their hyperparameters and metrics.

**Features:**

- Sortable by score
- Best trial highlighting (blue background)
- Top 3 trials highlighting (gray background)
- Hyperparameter display (tags)
- Metric displays:
  - Optimization metric (colored by performance)
  - MAE, RMSE, MAPE
  - Directional accuracy
  - Execution time
- Best trial indicator (checkmark icon)

**Example Usage:**

```tsx
<HPOTrialsTable result={optimizationResult} />
```

---

### 3. HPOBestParamsCard

**Location:** `apps/web/src/components/ml/hpo-best-params-card.tsx`

**Purpose:** Display the best hyperparameters and their performance.

**Features:**

- Improvement percentage (vs baseline)
- Best hyperparameters grid
- Performance metrics (MAE, RMSE, MAPE, R², Direction)
- JSON export (copy-paste ready)
- Recommendation based on improvement

**Color Coding:**

- **Green:** Good performance (>10% improvement)
- **Yellow:** Medium performance (5-10% improvement)
- **Gray:** Low improvement (<5%)

**Example Usage:**

```tsx
<HPOBestParamsCard result={optimizationResult} />
```

---

### 4. HPOImprovementChart

**Location:** `apps/web/src/components/ml/hpo-improvement-chart.tsx`

**Purpose:** Visualize optimization progress over trials.

**Features:**

- Line chart (lightweight-charts)
- Two series:
  - **Trial Score** (blue line) - score of each trial
  - **Best So Far** (green dashed line) - cumulative best score
- Auto-resizing
- Dark theme

**Example Usage:**

```tsx
<HPOImprovementChart result={optimizationResult} height={300} />
```

---

### 5. HPOOptimizationResults

**Location:** `apps/web/src/components/ml/hpo-optimization-results.tsx`

**Purpose:** Main component that combines all HPO result components.

**Features:**

- Optimization summary card (method, trials, period, metric)
- Best parameters card
- Tabs:
  - **Progress Chart** - visualization
  - **All Trials** - detailed table

**Example Usage:**

```tsx
<HPOOptimizationResults result={optimizationResult} />
```

---

## React Query Hooks

### 1. useRunOptimization

**Location:** `apps/web/src/hooks/use-hpo.ts`

**Purpose:** Mutation for running hyperparameter optimization.

**Example:**

```tsx
const runOptimizationMutation = useRunOptimization()

// Run optimization
runOptimizationMutation.mutate({
  symbol: "BTCUSDT",
  modelType: "LSTM",
  horizon: "1h",
  method: "RANDOM",
  nTrials: 20,
  startDate: Date.now() - 30 * 24 * 60 * 60 * 1000,
  endDate: Date.now(),
  optimizationMetric: "directionalAccuracy",
  hyperparameterSpace: {
    hiddenSize: [16, 32, 64],
    sequenceLength: [10, 20, 30],
    learningRate: [0.0001, 0.001, 0.01],
    epochs: [50, 100, 200],
  },
})

// Access result
if (runOptimizationMutation.isSuccess) {
  const result = runOptimizationMutation.data
}
```

---

### 2. useHPORecommendations

**Location:** `apps/web/src/hooks/use-hpo.ts`

**Purpose:** Query for fetching hyperparameter recommendations.

**Example:**

```tsx
const { data: recommendations } = useHPORecommendations("BTCUSDT", "LSTM")

if (recommendations) {
  console.log(recommendations.recommendedSpace)
  console.log(recommendations.reasoning)
}
```

---

## Integration

### ML Page Integration

**Location:** `apps/web/src/routes/_auth.ml.tsx`

The HPO UI is integrated as a third tab in the ML page:

1. **Backtest Results** - single model backtesting
2. **Model Comparison** - compare multiple models
3. **HPO** - hyperparameter optimization

**States:**

- **Idle** - show configuration form
- **Running** - show loading spinner (20-40 minutes)
- **Success** - show results
- **Error** - show error message with retry button

---

## User Flow

1. **Navigate to ML page** → Select "HPO" tab
2. **Configure optimization:**
   - Select symbol, model, horizon
   - Choose optimization method
   - Adjust hyperparameter space
   - Optional: Click "Use Recommended" for defaults
3. **Start optimization** → Click "Start Optimization"
4. **Wait for results** (20-40 minutes)
5. **View results:**
   - Check improvement percentage
   - Review best hyperparameters
   - Analyze trials in table
   - Visualize progress in chart
6. **Export results** → Copy JSON from best parameters card
7. **Run new optimization** → Click "Run New Optimization"

---

## Performance Considerations

### Optimization Metrics

- **Directional Accuracy** - Best for trading (predicts direction)
- **MAE** - Good for price prediction
- **RMSE** - Penalizes large errors
- **MAPE** - Relative error (percentage)
- **R² Score** - Overall model fit

### Method Comparison

| Method            | Speed | Coverage | Use Case                            |
| ----------------- | ----- | -------- | ----------------------------------- |
| **Grid Search**   | Slow  | Complete | Small parameter space (<100 combos) |
| **Random Search** | Fast  | Partial  | Large parameter space (>100 combos) |

### Best Practices

1. **Start small** - Use 10-20 trials for initial exploration
2. **Use recommendations** - Backend provides good defaults
3. **Monitor improvement** - >10% is excellent, 5-10% is good
4. **Iterate** - Refine parameter space based on results
5. **Validate** - Run backtest with best params before production

---

## Troubleshooting

### Common Issues

#### 1. Optimization takes too long

- **Solution:** Reduce number of trials or use shorter historical period

#### 2. No improvement found

- **Solution:**
  - Expand parameter space
  - Try different optimization metric
  - Check data quality

#### 3. Chart not rendering

- **Solution:**
  - Check browser console for errors
  - Ensure lightweight-charts is installed
  - Verify container has width

#### 4. Recommendations not loading

- **Solution:**
  - Check ML Service is running
  - Verify API endpoint `/api/ml/optimize/recommendations`
  - Check network tab for errors

---

## Future Enhancements

1. **Real-time progress tracking** - Show trial results as they complete
2. **Export functionality** - CSV/JSON/PNG export
3. **Bayesian Optimization** - More efficient search
4. **Multi-objective optimization** - Optimize multiple metrics
5. **Parallel execution** - Run multiple trials simultaneously
6. **AutoML** - Automatic model selection + HPO

---

## API Reference

### POST /api/ml/optimize

**Request:**

```json
{
  "symbol": "BTCUSDT",
  "modelType": "LSTM",
  "horizon": "1h",
  "method": "RANDOM",
  "nTrials": 20,
  "startDate": 1609459200000,
  "endDate": 1612137600000,
  "optimizationMetric": "directionalAccuracy",
  "hyperparameterSpace": {
    "hiddenSize": [16, 32, 64],
    "sequenceLength": [10, 20, 30],
    "learningRate": [0.0001, 0.001, 0.01],
    "epochs": [50, 100, 200]
  },
  "crossValidationFolds": 3
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "config": { ... },
    "bestHyperparameters": {
      "hiddenSize": 32,
      "sequenceLength": 20,
      "learningRate": 0.001,
      "epochs": 100
    },
    "bestTrial": {
      "trialId": "trial-5",
      "hyperparameters": { ... },
      "metrics": {
        "mae": 125.43,
        "rmse": 189.76,
        "mape": 2.34,
        "r2Score": 0.876,
        "directionalAccuracy": 58.3
      },
      "score": 58.3,
      "executionTime": 45000
    },
    "bestMetrics": { ... },
    "improvementPercentage": 12.5,
    "trials": [ ... ],
    "totalExecutionTime": 1200000,
    "completedAt": 1612137600000
  }
}
```

---

### GET /api/ml/optimize/recommendations

**Query Params:**

- `symbol` - Trading symbol (e.g., BTCUSDT)
- `modelType` - LSTM or HYBRID

**Response:**

```json
{
  "success": true,
  "data": {
    "recommendedSpace": {
      "hiddenSize": [16, 32, 64],
      "sequenceLength": [10, 20, 30],
      "learningRate": [0.0001, 0.001, 0.01],
      "epochs": [50, 100, 200]
    },
    "reasoning": "LSTM models benefit from tuning hidden size (16-64), sequence length (10-30), learning rate (0.0001-0.01), and epochs (50-200). Start with medium values and adjust based on results."
  }
}
```

---

## Examples

### Example 1: Basic LSTM Optimization

```tsx
import { HPOConfigForm, HPOOptimizationResults } from "../components/ml"
import { useRunOptimization } from "../hooks/use-hpo"

function MyOptimizationPage() {
  const runOptimizationMutation = useRunOptimization()

  return (
    <div>
      {!runOptimizationMutation.isSuccess && (
        <HPOConfigForm
          isLoading={runOptimizationMutation.isPending}
          onSubmit={(config) => {
            const endDate = Date.now()
            const startDate = endDate - config.days * 24 * 60 * 60 * 1000

            runOptimizationMutation.mutate({
              ...config,
              startDate,
              endDate,
            })
          }}
        />
      )}

      {runOptimizationMutation.isSuccess && (
        <HPOOptimizationResults result={runOptimizationMutation.data} />
      )}
    </div>
  )
}
```

---

## Credits

Built with:

- **React** - UI framework
- **TypeScript** - Type safety
- **React Query** - Data fetching
- **lightweight-charts** - Charting
- **Tailwind CSS** - Styling
- **Biome** - Linting and formatting
