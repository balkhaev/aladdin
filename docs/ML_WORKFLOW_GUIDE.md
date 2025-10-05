# ML Model Workflow Guide

## Обзор

Новый workflow для работы с ML моделями предоставляет чёткий контроль над процессом обучения, тестирования и развертывания моделей в production.

## Страница /ml

### Архитектура табов

1. **Train (HPO)** - Обучение с гиперпараметрической оптимизацией
2. **Evaluate** - Тестирование модели и ручное сохранение
3. **Compare** - Сравнение LSTM vs Hybrid моделей
4. **Models** - Управление сохранёнными моделями

### Workflow

#### 1. Обучение модели (Train)

**Когда использовать:** Первоначальное обучение модели с автоматической оптимизацией параметров.

**Процесс:**

- Выберите символ, модель (LSTM/Hybrid), горизонт прогноза
- Настройте диапазоны гиперпараметров для оптимизации
- Нажмите "Start Optimization"
- **Модель автоматически сохраняется после HPO** с лучшими найденными параметрами

**Результат:**

- Optimized model saved to disk
- Ready for production use на /trading

#### 2. Тестирование модели (Evaluate)

**Когда использовать:**

- Тестирование новых комбинаций параметров
- Переобучение модели с обновлёнными данными
- Проверка performance перед заменой существующей модели

**Процесс:**

- Настройте параметры для бэктеста (symbol, modelType, dates, hyperparameters)
- Нажмите "Run Backtest"
- Изучите результаты (MAE, RMSE, MAPE, R², Directional Accuracy)
- **Если результаты удовлетворительны** - нажмите "Save Model"
- **Модель перезапишет существующую** с новыми параметрами

**Важно:**

- Модель НЕ сохраняется автоматически после бэктеста
- Явное нажатие "Save Model" даёт полный контроль
- Можно тестировать разные параметры без риска перезаписи production модели

#### 3. Сравнение моделей (Compare)

**Когда использовать:** Выбор между LSTM и Hybrid моделями для конкретного символа.

**Процесс:**

- Запускается бэктест обеих моделей параллельно
- Сравнение метрик side-by-side
- **Обе модели автоматически сохраняются** после сравнения

### Visual Stepper

Страница /ml показывает статус workflow через stepper:

```
Step 1: Train          → HPO (auto-save)
  ↓
Step 2: Evaluate       → Test & Save (manual)
  ↓
Step 3: Production     → Use on /trading
```

**Индикаторы:**

- 🟢 Green checkmark - Шаг завершён
- 🟡 Yellow circle - Бэктест выполнен, ожидает сохранения
- ⚪ Gray circle - Не выполнен

## Страница /trading

### ML Predictions

После сохранения модели на /ml, предсказания становятся доступны на /trading:

#### ML Tab (Sidebar)

- Predicted Price
- Confidence Interval
- Confidence %
- Model Version
- Last Trained Date
- Market Regime (Bull/Bear/Sideways)

#### ML Overlay (Chart)

- Toggle "Show ML on Chart"
- Dashed line от текущей цены к предсказанию
- Цвет: зелёный (↑) / красный (↓)
- Label: "ML: $XX,XXX"

## API Endpoints

### Save Model Manually

```
POST /api/ml/models/save
Body: {
  symbol: string,
  modelType: "LSTM" | "HYBRID",
  config: {
    hiddenSize: number,
    sequenceLength: number,
    learningRate: number,
    epochs: number
  },
  metrics: {
    mae: number,
    rmse: number,
    mape: number,
    r2Score: number,
    directionalAccuracy: number
  }
}
```

## Примеры использования

### Сценарий 1: Первоначальное обучение

1. Открыть /ml → Train tab
2. Выбрать BTCUSDT, LSTM, horizon 1h
3. Start Optimization
4. ✅ Модель сохранена автоматически
5. Перейти на /trading → включить ML predictions

### Сценарий 2: Улучшение существующей модели

1. Открыть /ml → Evaluate tab
2. Настроить новые параметры (epochs: 200, hiddenSize: 64)
3. Run Backtest
4. Проверить metrics (если лучше предыдущих)
5. Нажать "Save Model"
6. ✅ Production модель обновлена

### Сценарий 3: Тестирование без риска

1. Открыть /ml → Evaluate tab
2. Попробовать экстремальные параметры
3. Run Backtest
4. Увидеть плохие результаты
5. **НЕ нажимать "Save Model"**
6. ✅ Production модель осталась нетронутой

## Файловая структура

```
./models/
  ├── BTCUSDT_LSTM_1.0.0.json         # Model weights
  ├── BTCUSDT_LSTM_1.0.0.meta.json    # Metadata
  ├── ETHUSDT_LSTM_1.0.0.json
  └── ETHUSDT_LSTM_1.0.0.meta.json
```

## Metadata Format

```json
{
  "symbol": "BTCUSDT",
  "modelType": "LSTM",
  "version": "1.0.0",
  "trainedAt": 1696512000000,
  "accuracy": 0.73,
  "trainingDuration": 45000,
  "dataPoints": 1000,
  "config": {
    "hiddenSize": 32,
    "sequenceLength": 20,
    "learningRate": 0.001,
    "epochs": 100
  }
}
```

## Best Practices

### Обучение

- ✅ Используйте Train (HPO) для первоначального обучения
- ✅ Дайте достаточно trials для оптимизации (50-100)
- ✅ Используйте walk-forward validation

### Тестирование

- ✅ Всегда проверяйте на актуальных данных (последние 30 дней)
- ✅ Проверяйте directionalAccuracy (важнее RMSE для трейдинга)
- ✅ Сохраняйте только если metrics улучшились

### Production

- ✅ Регулярно переобучайте модели (раз в неделю/месяц)
- ✅ Мониторьте качество предсказаний
- ✅ Используйте Evaluate для экспериментов

### НЕ делайте

- ❌ Не сохраняйте модель без проверки metrics
- ❌ Не используйте слишком старые данные для обучения
- ❌ Не игнорируйте market regime changes
