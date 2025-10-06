# ML Python Service - Quickstart

## Установка

### Автоматическая установка (рекомендуется)

```bash
cd apps/ml-python
bun run setup
```

Эта команда создаст виртуальное окружение и установит все зависимости.

### Ручная установка

#### 1. Создать виртуальное окружение

```bash
cd apps/ml-python
python3.11 -m venv venv
source venv/bin/activate  # macOS/Linux
# или
venv\Scripts\activate  # Windows
```

#### 2. Установить зависимости

```bash
pip install -r requirements.txt
```

#### 3. Настроить переменные окружения

```bash
cp .env.example .env
# Отредактируйте .env с вашими настройками
```

## Запуск

### Через Turbo (рекомендуется для dev)

Из корня проекта:

```bash
# Запустить только ml-python
bun run dev:ml-python

# Или запустить все сервисы вместе
bun dev
```

Сервис будет доступен на `http://localhost:8000` с автоматической перезагрузкой при изменении файлов.

### Локальный запуск (альтернатива)

```bash
# Из директории apps/ml-python
cd apps/ml-python

# Активировать venv
source venv/bin/activate

# Запустить сервис
python -m src.main

# Или через uvicorn с hot reload
uvicorn src.main:app --reload --port 8000
```

### Production режим

```bash
cd apps/ml-python
venv/bin/uvicorn src.main:app --host 0.0.0.0 --port 8000 --workers 4
```

## Использование

### 1. Проверить здоровье сервиса

```bash
curl http://localhost:8000/api/ml/health
```

### 2. Обучить модель

```bash
curl -X POST http://localhost:8000/api/ml/train \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTCUSDT",
    "model_type": "LSTM",
    "hidden_size": 128,
    "num_layers": 2,
    "sequence_length": 60,
    "lookback_days": 30,
    "epochs": 100
  }'
```

**Ожидаемое время обучения:**

- CPU: 3-5 минут
- GPU: 1-2 минуты

### 3. Сделать предсказание

```bash
curl -X POST http://localhost:8000/api/ml/predict \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTCUSDT",
    "horizon": "1h",
    "confidence": 0.95
  }'
```

### 4. Список моделей

```bash
curl http://localhost:8000/api/ml/models
```

## Тестирование

```bash
# Убедитесь что сервис запущен
python test_ml.py
```

## Параметры модели

### Рекомендуемые настройки для разных случаев

#### Быстрое обучение (для тестирования)

```json
{
  "hidden_size": 64,
  "num_layers": 2,
  "sequence_length": 30,
  "lookback_days": 7,
  "epochs": 50,
  "batch_size": 32
}
```

#### Баланс скорости и качества

```json
{
  "hidden_size": 128,
  "num_layers": 2,
  "sequence_length": 60,
  "lookback_days": 30,
  "epochs": 100,
  "batch_size": 32
}
```

#### Максимальное качество

```json
{
  "hidden_size": 256,
  "num_layers": 3,
  "sequence_length": 100,
  "lookback_days": 90,
  "epochs": 200,
  "batch_size": 64,
  "bidirectional": true
}
```

## Ожидаемые результаты

На BTCUSDT с хорошими данными:

- **Directional Accuracy**: 60-70%
- **MAPE**: 3-5%
- **R² Score**: 0.5-0.7

## Troubleshooting

### Недостаточно данных

```
Error: Insufficient data: 500 candles (minimum 1000 required)
```

**Решение**: Убедитесь, что в ClickHouse есть исторические данные за указанный период.

### Модель не найдена

```
Error: No trained model found for BTCUSDT
```

**Решение**: Сначала обучите модель через `/api/ml/train`.

### Низкая точность

Если Directional Accuracy < 55%:

1. Увеличьте `lookback_days` (больше данных)
2. Увеличьте `hidden_size` и `num_layers`
3. Попробуйте `model_type: "GRU"`
4. Используйте `bidirectional: true`

## API документация

Полная документация доступна по адресу:

```
http://localhost:8000/docs
```

## Архитектура

```
Запрос → FastAPI → Feature Engineering → Normalization → PyTorch Model → Denormalization → Ответ
```

**Основные компоненты:**

1. **FeatureEngineer**: 40+ технических индикаторов
2. **Normalizer**: Standard/MinMax/Robust нормализация
3. **LSTMModel**: PyTorch модель с BPTT
4. **Trainer**: Обучение с early stopping
5. **ClickHouseLoader**: Загрузка данных

## Следующие шаги

1. **Оптимизация гиперпараметров**

   ```bash
   # TODO: Implement HPO endpoint
   POST /api/ml/optimize
   ```

2. **Backtesting**

   ```bash
   # TODO: Implement backtesting endpoint
   POST /api/ml/backtest
   ```

3. **Ensemble predictions**
   ```bash
   # TODO: Combine multiple models
   POST /api/ml/predict/ensemble
   ```
