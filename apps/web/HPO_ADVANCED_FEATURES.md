# HPO Advanced Features

## Overview

Advanced features for Hyperparameter Optimization, including export functionality and real-time progress tracking.

---

## ✅ Export Functionality (COMPLETED)

### Features

#### 1. Export Menu Component

**Location:** `apps/web/src/components/ml/hpo-export-menu.tsx`

Dropdown menu with multiple export options:
- **Export as JSON** - Full optimization result
- **Export as CSV** - Trials table with metadata
- **Export Summary (TXT)** - Human-readable summary
- **Copy Best Params** - Copy to clipboard

#### 2. Export Utilities

**Location:** `apps/web/src/lib/export-utils.ts`

Core export functions:
- `downloadJSON()` - Save data as JSON file
- `downloadCSV()` - Save data as CSV file
- `optimizationResultToCSV()` - Convert trials to CSV format
- `exportOptimizationSummary()` - Generate text summary
- `generateFilename()` - Create timestamped filenames
- `copyToClipboard()` - Copy text to clipboard

#### 3. PNG Chart Export

**Location:** `apps/web/src/components/ml/hpo-improvement-chart.tsx`

Export chart as PNG image:
- Button in chart header
- Downloads canvas as PNG
- Timestamped filename
- Full resolution export

---

### Usage Examples

#### Export JSON

```typescript
import { HPOExportMenu } from "../components/ml/hpo-export-menu";

<HPOExportMenu result={optimizationResult} />
```

Downloads: `hpo_result_BTCUSDT_LSTM_2025-10-05.json`

**Content:**
```json
{
  "config": {
    "symbol": "BTCUSDT",
    "modelType": "LSTM",
    "horizon": "1h",
    "method": "RANDOM",
    "nTrials": 20,
    "optimizationMetric": "directionalAccuracy"
  },
  "trials": [...],
  "bestTrial": {...},
  "bestHyperparameters": {...},
  "improvementPercentage": 12.5
}
```

---

#### Export CSV

Downloads: `hpo_trials_BTCUSDT_LSTM_2025-10-05.csv`

**Content:**
```csv
# Hyperparameter Optimization Results
# Symbol: BTCUSDT
# Model Type: LSTM
# Method: RANDOM
# Best Trial: trial-5 (Score: 58.3)
# Improvement: 12.5%

Trial ID,Score,MAE,RMSE,MAPE,R2 Score,Directional Accuracy,Execution Time (s),hiddenSize,sequenceLength,learningRate,epochs
trial-1,55.2,125.43,189.76,2.34,0.876,55.2,45.0,32,20,0.001,100
trial-2,57.8,118.92,182.45,2.12,0.891,57.8,43.2,64,30,0.001,150
...
```

---

#### Export Summary (TXT)

Downloads: `hpo_summary_BTCUSDT_LSTM_2025-10-05.txt`

**Content:**
```text
Hyperparameter Optimization Results
====================================

Configuration:
- Symbol: BTCUSDT
- Model Type: LSTM
- Horizon: 1h
- Method: RANDOM
- Optimization Metric: directionalAccuracy
- Trials: 20

Best Trial: trial-5
- Score: 58.3000
- Improvement: 12.50%
- MAE: $125.43
- RMSE: $189.76
- MAPE: 2.34%
- R² Score: 0.8760
- Directional Accuracy: 58.30%

Best Hyperparameters:
- hiddenSize: 32
- sequenceLength: 20
- learningRate: 0.001
- epochs: 100
```

---

#### Copy Best Params

Copies to clipboard:
```json
{
  "hiddenSize": 32,
  "sequenceLength": 20,
  "learningRate": 0.001,
  "epochs": 100
}
```

Can be pasted directly into configuration files or code.

---

#### Export Chart as PNG

Downloads: `hpo_chart_BTCUSDT_LSTM_2025-10-05.png`

- Full resolution chart image
- Includes both series (Trial Score + Best So Far)
- Suitable for reports and presentations

---

### API Reference

#### downloadJSON(data, filename)

```typescript
function downloadJSON(data: unknown, filename: string): void
```

Downloads any data structure as formatted JSON file.

**Parameters:**
- `data` - Data to export
- `filename` - Output filename (without extension)

**Example:**
```typescript
downloadJSON(optimizationResult, "my_hpo_result");
// Downloads: my_hpo_result.json
```

---

#### downloadCSV(data, filename)

```typescript
function downloadCSV(data: string, filename: string): void
```

Downloads CSV data as file.

**Parameters:**
- `data` - CSV string
- `filename` - Output filename (without extension)

---

#### optimizationResultToCSV(result)

```typescript
function optimizationResultToCSV(result: OptimizationResult): string
```

Converts optimization result to CSV format.

**Returns:** CSV string with:
- Metadata header (symbol, model, method, etc.)
- Column headers (Trial ID, Score, Metrics, Hyperparameters)
- Trial rows

---

#### exportOptimizationSummary(result)

```typescript
function exportOptimizationSummary(result: OptimizationResult): {
  summary: string;
  bestParams: Record<string, number>;
  allTrials: Array<...>;
}
```

Generates human-readable summary and structured data.

**Returns:**
- `summary` - Formatted text summary
- `bestParams` - Best hyperparameters object
- `allTrials` - Simplified trials array

---

#### generateFilename(prefix, symbol, modelType, extension)

```typescript
function generateFilename(
  prefix: string,
  symbol: string,
  modelType: string,
  extension: string
): string
```

Generates timestamped filename.

**Example:**
```typescript
generateFilename("hpo_result", "BTCUSDT", "LSTM", "json");
// Returns: "hpo_result_BTCUSDT_LSTM_2025-10-05.json"
```

---

#### copyToClipboard(text)

```typescript
async function copyToClipboard(text: string): Promise<boolean>
```

Copies text to clipboard with fallback for older browsers.

**Returns:** `true` if successful, `false` otherwise

---

### Use Cases

#### 1. Share Results with Team

Export as JSON or CSV to share with colleagues:
- Full data for analysis
- Reproducible results
- Easy to import into other tools

#### 2. Create Reports

Export summary (TXT) and chart (PNG) for reports:
- Management presentations
- Research papers
- Documentation

#### 3. Backup & Archive

Save results for future reference:
- Historical comparison
- Audit trail
- Model versioning

#### 4. Import into Excel/Google Sheets

Export as CSV for spreadsheet analysis:
- Create charts
- Custom calculations
- Pivot tables

#### 5. Configuration Management

Copy best params to use in production:
- Update config files
- Deploy optimized models
- Version control

---

## 🔄 Real-time Progress Tracking (FUTURE)

### Planned Features

#### 1. Backend Progress Storage

**Location:** `apps/ml-service/src/services/optimization-progress.ts` (created)

Features:
- In-memory progress tracking
- Trial-by-trial updates
- Estimated time remaining
- Status management (RUNNING/COMPLETED/FAILED)

#### 2. Progress API Endpoint

**Endpoint:** `GET /api/ml/optimize/:optimizationId/progress`

**Response:**
```json
{
  "optimizationId": "BTCUSDT_LSTM_1633024800000",
  "status": "RUNNING",
  "currentTrial": 12,
  "totalTrials": 20,
  "completedTrials": [...],
  "estimatedTimeRemaining": 480000
}
```

#### 3. Frontend Polling

**Component:** `apps/web/src/components/ml/hpo-progress-tracker.tsx` (TODO)

Features:
- Poll progress every 5 seconds
- Display current trial number
- Show progress bar
- Estimated time remaining
- Live trial results table

#### 4. WebSocket Support (Later)

For true real-time updates:
- Push trial results immediately
- No polling overhead
- Lower latency
- Better UX

---

### Implementation Status

| Feature | Status | Priority |
|---------|--------|----------|
| Export JSON | ✅ DONE | High |
| Export CSV | ✅ DONE | High |
| Export Summary (TXT) | ✅ DONE | Medium |
| Copy Best Params | ✅ DONE | High |
| Export Chart (PNG) | ✅ DONE | Medium |
| Progress Storage (Backend) | ⏳ STARTED | Medium |
| Progress API Endpoint | ⏳ TODO | Medium |
| Frontend Polling | ⏳ TODO | Medium |
| WebSocket Updates | 📅 PLANNED | Low |

---

## Next Steps

1. **Complete Progress Tracking** (Medium Priority)
   - Integrate `OptimizationProgressService` into HPO service
   - Add progress API endpoint
   - Create progress tracker component
   - Add polling logic

2. **Bayesian Optimization** (Low Priority)
   - More efficient than random search
   - Uses Gaussian processes
   - Learns from previous trials
   - 10-100x fewer trials needed

3. **Multi-objective Optimization** (Low Priority)
   - Optimize multiple metrics simultaneously
   - Pareto frontier
   - Trade-off visualization
   - User selects preferred solution

4. **Parallel Execution** (Low Priority)
   - Run multiple trials in parallel
   - Worker pool
   - 2-4x faster
   - Requires resource management

5. **AutoML** (Future)
   - Automatic model selection
   - Architecture search
   - Feature selection
   - End-to-end automation

---

## Credits

Built with:
- **React** - UI framework
- **TypeScript** - Type safety
- **Lucide Icons** - Icons
- **Canvas API** - Chart export
- **Blob API** - File downloads

