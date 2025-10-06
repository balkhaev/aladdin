# Machine Learning Guide

> **Полное руководство по ML возможностям платформы Coffee Trading Platform**

**Статус:** ✅ Production Ready  
**Последнее обновление:** 6 октября 2025

## 📋 Содержание

- [Обзор](#обзор)
- [TypeScript ML Service](#typescript-ml-service)
- [Python ML Service](#python-ml-service)
- [Установка](#установка)
- [Workflow](#workflow)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Обзор

Платформа предоставляет **два ML сервиса**:

1. **TypeScript ML** (`apps/analytics`) — базовые модели, быстрые предсказания
2. **Python ML** (`apps/ml-python`) — продвинутые модели с PyTorch

### Возможности

- 📈 **Price Prediction** — LSTM, GRU, Hybrid, Ensemble
- 🚨 **Anomaly Detection** — Pump & Dump, Flash Crash
- 📊 **Market Regime** — Bull/Bear/Sideways classification
- 🔍 **Backtesting** — Walk-forward validation, model comparison
- ⚙️ **HPO** — Grid Search, Random Search, Optuna
- 🎯 **Ensemble** — Weighted Average, Voting, Stacking

---

## 🔷 TypeScript ML Service

### LSTM Model

**Архитектура:**

- Input: 20 нормализованных свечей
- Hidden: 32 LSTM units
- Output: предсказанная цена
- Learning Rate: 0.001, Epochs: 100

**API:**

```bash
GET /api/ml/predict/lstm?symbol=BTCUSDT&horizon=24h
```

**Response:**

```json
{
  "predictions": [
    {
      "timestamp": "2025-10-06T12:00:00Z",
      "price": 52500,
      "confidence": 0.85
    }
  ],
  "model": "lstm"
}
```

### Hybrid Model

**Компоненты:**

- Linear Regression (trend)
- Exponential Smoothing (noise reduction)

**Best for:** Краткосрочные предсказания (1-4 часа)

**API:**

```bash
GET /api/ml/predict/hybrid?symbol=BTCUSDT&horizon=24h
```

### Ensemble Prediction

**Стратегии:**

1. **Weighted Average** — сбалансированный 50/50
2. **Voting** — фокус на направление, +10% confidence при согласии
3. **Stacking** — адаптивный, LSTM для трендов, Hybrid для sideways

**Expected improvement:** +5-15% accuracy

**API:**

```bash
GET /api/ml/predict/ensemble?symbol=BTCUSDT&horizon=24h&strategy=stacking
```

### Anomaly Detection

#### Pump & Dump Detection

**Индикаторы:**

- Volume spike (>100-500%)
- Price momentum (>10%)
- Rapidity score
- Sustainability score

**Scoring:**

- 0-30 pts: Volume analysis
- 0-30 pts: Price magnitude
- 0-20 pts: Rapidity
- 0-20 pts: Sustainability

**Severity:**

- 0-25: LOW
- 26-50: MEDIUM
- 51-75: HIGH
- 76-100: CRITICAL

#### Flash Crash Prediction

**Индикаторы:**

- Liquidation risk
- Order book imbalance
- Market depth
- Cascade risk

**API:**

```bash
GET /api/ml/anomalies/detect?symbol=BTCUSDT
```

### Backtesting

**Методы:**

1. **Simple** — одна тренировка на всей истории
2. **Walk-forward** — периодическая переобучение
3. **Model Comparison** — LSTM vs Hybrid

**Метрики:**

- MAE, RMSE, MAPE
- R² Score
- Directional Accuracy
- Mean/Max/Min Error

**API:**

```bash
POST /api/ml/backtest
{
  "symbol": "BTCUSDT",
  "modelType": "lstm",
  "method": "walk-forward",
  "from": "2024-01-01",
  "to": "2024-10-01"
}
```

### Hyperparameter Optimization

**Методы:**

- Grid Search (exhaustive)
- Random Search (efficient)

**Оптимизируемые параметры:**

- `hiddenSize`: 32, 64, 128
- `sequenceLength`: 20, 40, 60
- `epochs`: 50, 100, 150

**API:**

```bash
POST /api/ml/hpo
{
  "symbol": "BTCUSDT",
  "method": "random",
  "trials": 10,
  "metric": "mae"
}
```

---

## 🐍 Python ML Service

### Преимущества над TypeScript

| Feature             | TypeScript | Python                      |
| ------------------- | ---------- | --------------------------- |
| **LSTM**            | Упрощенный | Настоящий PyTorch LSTM      |
| **BPTT**            | ❌         | ✅                          |
| **Normalization**   | Базовая    | Consistent с сохранением    |
| **Features**        | OHLCV      | 40+ технических индикаторов |
| **Validation**      | Нет        | Train/Val/Test split        |
| **Hidden Size**     | 32         | 128+                        |
| **Sequence Length** | 20         | 60+                         |

### Архитектура

```
src/
├── api/              # FastAPI endpoints
│   ├── health.py
│   ├── training.py
│   ├── prediction.py
│   └── advanced.py
├── models/           # PyTorch models
│   └── lstm.py
├── features/         # Feature engineering
│   ├── engineering.py    # 40+ indicators
│   └── normalization.py
├── data/             # ClickHouse loader
├── training/         # Training loop
└── utils/            # Logging, device
```

### Features (40+)

**Price Features:**

- Returns, Log Returns
- Price changes, Price momentum

**Technical Indicators:**

- RSI, MACD, Bollinger Bands
- Stochastic, CCI, ADX
- ATR, OBV

**Volatility:**

- Historical volatility
- Parkinson volatility

**Volume:**

- Volume SMA/EMA
- Volume momentum

### Models

#### LSTM Model

```python
LSTMModel(
    input_size=45,      # features
    hidden_size=128,    # LSTM units
    num_layers=2,       # stacked layers
    dropout=0.2,        # regularization
    batch_first=True
)
```

#### GRU Model

```python
GRUModel(
    input_size=45,
    hidden_size=128,
    num_layers=2,
    dropout=0.2
)
```

### Training

**Process:**

1. Load data from ClickHouse
2. Feature engineering (40+ indicators)
3. Normalization (Standard/MinMax/Robust)
4. Create sequences (60 timesteps)
5. Train/Val/Test split (70/15/15)
6. Training loop with early stopping
7. Save model + metadata + scaler

**Early Stopping:**

- Patience: 10 epochs
- Monitor: validation loss
- Restore: best weights

### Advanced Features

#### Market Regime Detection

**Классификация:**

- BULL: uptrend, low volatility
- BEAR: downtrend, high volatility
- SIDEWAYS: no trend

**Confidence:** 0-100%

**API:**

```bash
GET /api/ml/advanced/regime?symbol=BTCUSDT
```

#### Anomaly Detection (Python)

**Method:** Isolation Forest

**Features:**

- Price changes
- Volume anomalies
- Volatility spikes

**API:**

```bash
GET /api/ml/advanced/anomalies?symbol=BTCUSDT&days=30
```

#### Ensemble (Python)

**Methods:**

- Average
- Weighted Average
- Voting
- Stacking

**API:**

```bash
POST /api/ml/advanced/ensemble
{
  "symbol": "BTCUSDT",
  "horizon": "24h",
  "models": ["lstm", "gru"],
  "method": "weighted"
}
```

---

## 🔧 Установка

### TypeScript ML

Уже включен в `apps/analytics`:

```bash
bun dev:analytics  # Запускается автоматически
```

### Python ML

#### 1. Требования

- Python 3.11+
- PyTorch 2.0+
- FastAPI
- ClickHouse client

#### 2. Установка

```bash
cd apps/ml-python

# Создать виртуальное окружение
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Установить зависимости
pip install -r requirements.txt
```

#### 3. Конфигурация

`.env`:

```bash
CLICKHOUSE_HOST=49.13.216.63
CLICKHOUSE_PORT=8123
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=

MODEL_SAVE_PATH=./models
LOG_LEVEL=INFO
```

#### 4. Запуск

```bash
# Development
uvicorn src.main:app --reload --port 8000

# Production
uvicorn src.main:app --host 0.0.0.0 --port 8000 --workers 4
```

#### 5. Проверка

```bash
# Health check
curl http://localhost:8000/health

# List models
curl http://localhost:8000/api/ml/models
```

---

## 📈 Workflow

### Страница `/ml`

**Tabs:**

1. **Train (HPO)** — обучение с оптимизацией
2. **Evaluate** — тестирование и сохранение
3. **Compare** — сравнение LSTM vs Hybrid
4. **Models** — управление моделями

### 1. Обучение модели (Train)

**Процесс:**

1. Выбрать символ, модель, горизонт
2. Настроить диапазоны параметров
3. Нажать "Start Optimization"
4. **Модель автоматически сохраняется** с лучшими параметрами

**Результат:**

- Optimized model → disk
- Ready for production на `/trading`

### 2. Тестирование модели (Evaluate)

**Когда использовать:**

- Тестирование новых параметров
- Переобучение с новыми данными
- Проверка перед заменой модели

**Процесс:**

1. Настроить параметры бэктеста
2. Нажать "Run Backtest"
3. Изучить метрики
4. **Нажать "Save Model"** (manual)

### 3. Сравнение моделей (Compare)

**Процесс:**

1. Выбрать символ и период
2. Запустить сравнение
3. Обе модели тестируются параллельно
4. **Автоматическое сохранение** обеих моделей

### Visual Stepper

```
Step 1: Train          → HPO (auto-save)
  ↓
Step 2: Evaluate       → Test & Save (manual)
  ↓
Step 3: Production     → Use on /trading
```

### Использование на `/trading`

После сохранения модели:

**ML Tab (Sidebar):**

- Predicted Price
- Confidence Interval
- Confidence %
- Model Version
- Last Trained Date
- Market Regime

**ML Overlay (Chart):**

- Зеленая линия — prediction
- Серая зона — confidence interval

---

## 🐛 Troubleshooting

### Python ML Service

#### Проблема: ModuleNotFoundError

**Решение:**

```bash
pip install -r requirements.txt
```

#### Проблема: CUDA not available

**Решение:**

```bash
# Проверить CUDA
python -c "import torch; print(torch.cuda.is_available())"

# CPU режим (автоматически)
# Модель определяет устройство автоматически
```

#### Проблема: ClickHouse connection error

**Решение:**

```bash
# Проверить доступ
curl http://49.13.216.63:8123/ping

# Проверить .env
CLICKHOUSE_HOST=49.13.216.63
CLICKHOUSE_PORT=8123
```

#### Проблема: Out of memory

**Решение:**

```python
# Уменьшить batch size
BATCH_SIZE=16  # вместо 32

# Уменьшить hidden size
hidden_size=64  # вместо 128
```

### TypeScript ML Service

#### Проблема: Low accuracy (<50%)

**Причина:** Недостаточно исторических данных

**Решение:**

```bash
# Импортировать больше данных
bun scripts/quick-import-candles.ts
```

#### Проблема: Predictions не появляются

**Решение:**

```bash
# Проверить логи
tail -f logs/analytics.log

# Проверить модели
curl http://localhost:3014/api/ml/models
```

#### Проблема: HPO слишком медленный

**Решение:**

```typescript
// Уменьшить trials
trials: 5 // вместо 10

// Использовать Random Search
method: "random" // вместо 'grid'
```

### Общие проблемы

#### Model not found

**Причина:** Модель не обучена или удалена

**Решение:**

1. Перейти на `/ml`
2. Train → Start Optimization
3. Дождаться завершения

#### Predictions differ from actual

**Это нормально!** ML модели не идеальны.

**Ожидаемая точность:**

- LSTM: 60-70% directional accuracy
- Hybrid: 55-65%
- Ensemble: 65-75%

#### High latency

**Причина:** Первый запрос после старта

**Решение:**

- Warm-up period (~30 sec)
- Используйте кэширование (Redis)

---

## 📚 Дополнительные ресурсы

### Документация

- [API Reference](API_REFERENCE.md) — все ML endpoints
- [Architecture](ARCHITECTURE.md) — архитектура ML сервисов

### Примеры

```bash
# Обучить LSTM модель
curl -X POST http://localhost:8000/api/ml/train \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTCUSDT",
    "model_type": "lstm",
    "sequence_length": 60,
    "hidden_size": 128,
    "epochs": 100
  }'

# Получить предсказание
curl http://localhost:8000/api/ml/predict \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTCUSDT",
    "horizon": "24h",
    "model_type": "lstm"
  }'

# Запустить HPO
curl -X POST http://localhost:8000/api/ml/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTCUSDT",
    "model_type": "lstm",
    "trials": 10,
    "metric": "mae"
  }'
```

---

## 🎯 Best Practices

1. **Начните с HPO** — найдите оптимальные параметры
2. **Используйте Walk-forward** — более реалистичный бэктест
3. **Ensemble для production** — лучшая стабильность
4. **Регулярно переобучайте** — рынок меняется
5. **Проверяйте confidence** — не доверяйте низкой confidence
6. **Мониторьте accuracy** — деградация модели со временем
7. **Python для продвинутых задач** — TypeScript для быстрых предсказаний

---

**Made with 🧠 and 💻 for crypto traders**
