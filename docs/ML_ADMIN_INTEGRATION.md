# ML Admin Panel Integration

## Обзор

Полная интеграция ml-service с админской панелью на фронтенде. Добавлена возможность обучения моделей, оптимизации гиперпараметров, детекции аномалий и работы с ансамблевыми предсказаниями.

## Что было реализовано

### 1. Навигация и роутинг

- **AppSidebar**: Добавлен пункт "ML" в раздел "Администрирование" (только для админов)
- **Middleware**: Обновлен для защиты админских роутов
- **Admin ML Page**: Создана страница `/admin/ml` с табами для управления ML

### 2. API интеграция

Добавлены новые методы в `apps/web/lib/api/ml.ts`:

- `trainModel()` - обучение новой модели
- `detectAnomalies()` - детекция аномалий на рынке
- `batchPredict()` - массовые предсказания для нескольких символов
- `ensemblePredict()` - ансамблевые предсказания

### 3. React Hooks

Созданы hooks в `apps/web/hooks/`:

- `use-train-model.ts` - обучение модели с прогрессом
- `use-anomaly-detection.ts` - детекция аномалий
- `use-batch-predictions.ts` - массовые предсказания
- `use-ensemble-predictions.ts` - ансамблевые предсказания

### 4. Компоненты

Созданы компоненты в `apps/web/components/ml/admin/`:

#### Training (Обучение)

- `training-form.tsx` - форма для обучения новой модели
- `training-results.tsx` - отображение результатов обучения

#### Anomaly Detection (Детекция аномалий)

- `anomaly-detection-config.tsx` - конфигурация детекции
- `anomaly-results-table.tsx` - таблица найденных аномалий

#### Batch Predictions (Массовые предсказания)

- `batch-predictions-form.tsx` - форма для batch predictions
- `batch-results-table.tsx` - результаты batch predictions

#### Ensemble Predictions (Ансамблевые предсказания)

- `ensemble-config-form.tsx` - конфигурация ансамбля
- `ensemble-results-card.tsx` - результаты ансамбля

### 5. Админская панель ML

Страница `/admin/ml` содержит 6 табов:

1. **Training** - обучение новых моделей
2. **HPO** - гиперпараметрическая оптимизация (из automation)
3. **Models** - управление моделями (из automation)
4. **Anomaly Detection** - детекция аномалий на рынке
5. **Batch Predictions** - массовые предсказания для множества символов
6. **Ensemble Predictions** - ансамблевые предсказания

### 6. Gateway

Gateway уже настроен на проксирование всех ML эндпоинтов:

- `POST /api/ml/train` → ml-service:8000
- `POST /api/ml/anomalies/detect` → ml-service:8000
- `POST /api/ml/predict/batch` → ml-service:8000
- `POST /api/ml/predict/ensemble` → ml-service:8000

## Использование

### Доступ

Только пользователи с ролью `admin` имеют доступ к странице `/admin/ml`.

### Обучение модели

1. Перейдите в таб "Training"
2. Заполните форму:
   - Символ (BTCUSDT, ETHUSDT и т.д.)
   - Тип модели (LSTM/GRU)
   - Гиперпараметры (hidden_size, num_layers, learning_rate и др.)
3. Нажмите "Начать обучение"
4. Результаты отобразятся после завершения

### Детекция аномалий

1. Перейдите в таб "Anomaly Detection"
2. Укажите символ и период анализа
3. Нажмите "Найти аномалии"
4. Просмотрите таблицу найденных аномалий

### Batch Predictions

1. Перейдите в таб "Batch"
2. Добавьте несколько символов
3. Выберите горизонт предсказания
4. Нажмите "Запустить предсказания"
5. Просмотрите результаты для всех символов

### Ensemble Predictions

1. Перейдите в таб "Ensemble"
2. Укажите символ и стратегию ансамбля
3. Нажмите "Получить предсказание"
4. Просмотрите вклад каждой модели в итоговое предсказание

## Технические детали

### Типы данных

Все типы определены в `apps/web/lib/api/ml.ts`:

```typescript
TrainRequest, TrainingResult
AnomalyDetectionRequest, AnomalyDetectionResult, AnomalyAlert
BatchPredictionRequest, BatchPredictionResult
EnsemblePredictionRequest, EnsemblePredictionResult
```

### Валидация

Используется Zod для валидации форм на клиенте.

### Обработка ошибок

Все ошибки обрабатываются на уровне hooks и отображаются через toast-нотификации.

## Пользовательский доступ

Обычные пользователи (роль `user`) имеют доступ только к:

- ML Prediction Card на `/trading`
- Backtest на `/automation`
- Просмотр предсказаний без управления моделями

## Следующие шаги

1. Добавить real-time обновление прогресса обучения через WebSocket
2. Добавить визуализацию метрик обучения (learning curves)
3. Добавить экспорт/импорт моделей
4. Добавить A/B тестирование моделей

