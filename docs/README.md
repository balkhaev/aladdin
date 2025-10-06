# 📚 Документация Coffee Trading Platform

> **Полная документация криптовалютной торговой платформы**

## 🚀 Быстрый старт

Новичок? Начните здесь:

1. **[Getting Started](GETTING_STARTED.md)** — установка и первые шаги (5 минут)
2. **[API Reference](API_REFERENCE.md)** — все API endpoints
3. **[Features](FEATURES.md)** — что умеет платформа

## 📖 Основная документация

### Архитектура и инфраструктура

| Документ                            | Описание                                              | Для кого             |
| ----------------------------------- | ----------------------------------------------------- | -------------------- |
| **[Architecture](ARCHITECTURE.md)** | Микросервисы, порты, производительность, безопасность | Разработчики, DevOps |
| **[Gateway](GATEWAY.md)**           | API Gateway package, proxy, service registry          | Backend разработчики |
| **[WebSocket](WEBSOCKET.md)**       | WebSocket integration, real-time streaming            | Frontend + Backend   |

### Функциональность

| Документ                                  | Описание                                        | Для кого              |
| ----------------------------------------- | ----------------------------------------------- | --------------------- |
| **[Features](FEATURES.md)**               | Все возможности платформы (SOR, VWAP, ML, Risk) | Все пользователи      |
| **[ML Guide](ML_GUIDE.md)**               | Machine Learning модели, HPO, backtesting       | ML инженеры, трейдеры |
| **[Portfolio Guide](PORTFOLIO_GUIDE.md)** | Оптимизация, ребалансировка, risk management    | Портфельные менеджеры |

### Разработка

| Документ                                  | Описание                                       | Для кого           |
| ----------------------------------------- | ---------------------------------------------- | ------------------ |
| **[Getting Started](GETTING_STARTED.md)** | Быстрый старт, troubleshooting, best practices | Все разработчики   |
| **[API Reference](API_REFERENCE.md)**     | Полный справочник по API endpoints             | Frontend + Backend |
| **[Roadmap](ROADMAP.md)**                 | План развития платформы                        | Product managers   |

## 🗂️ Структура документации

```
docs/
├── README.md                  # ← Вы здесь
│
├── Getting Started
│   └── GETTING_STARTED.md     # Установка, первые шаги, troubleshooting
│
├── Core Documentation
│   ├── ARCHITECTURE.md        # Архитектура, производительность, безопасность
│   ├── FEATURES.md            # Все возможности платформы
│   └── API_REFERENCE.md       # API справочник
│
├── Specialized Guides
│   ├── ML_GUIDE.md            # Machine Learning (TypeScript + Python)
│   └── PORTFOLIO_GUIDE.md     # Portfolio management, optimization, risk
│
├── Technical Documentation
│   ├── GATEWAY.md             # API Gateway package
│   └── WEBSOCKET.md           # WebSocket integration
│
└── Planning
    └── ROADMAP.md             # План развития
```

## 🎯 Быстрый поиск

### Как сделать X?

**Установить платформу:**
→ [Getting Started § Установка](GETTING_STARTED.md#установка-5-минут)

**Получить real-time цены:**
→ [API Reference § Market Data WebSocket](API_REFERENCE.md)

**Обучить ML модель:**
→ [ML Guide § Training](ML_GUIDE.md#установка)

**Оптимизировать портфель:**
→ [Portfolio Guide § Optimization](PORTFOLIO_GUIDE.md#portfolio-optimization)

**Запустить алгоритмическое исполнение:**
→ [Features § Algorithmic Execution](FEATURES.md#algorithmic-execution)

**Настроить WebSocket:**
→ [WebSocket § Setup](WEBSOCKET.md)

### Что такое Y?

**Smart Order Routing:**
→ [Features § SOR](FEATURES.md#smart-order-routing-sor)

**VWAP/TWAP:**
→ [Features § Algorithmic Execution](FEATURES.md#algorithmic-execution)

**Value at Risk (VaR):**
→ [Portfolio Guide § Risk Management](PORTFOLIO_GUIDE.md#risk-management)

**Ensemble Predictions:**
→ [ML Guide § Ensemble](ML_GUIDE.md#ensemble-prediction)

**Circuit Breaker:**
→ [Architecture § Безопасность](ARCHITECTURE.md#безопасность)

## 🔍 По категориям

### 📊 Market Data & Analytics

- Real-time данные с 3+ бирж → [Features § Market Data](FEATURES.md)
- Технические индикаторы (RSI, MACD, etc.) → [API Reference](API_REFERENCE.md)
- On-chain метрики → [API Reference](API_REFERENCE.md)
- Sentiment analysis → [Features § Social Media](FEATURES.md)

### 🤖 Machine Learning

- LSTM predictions → [ML Guide § LSTM](ML_GUIDE.md#lstm-model)
- Anomaly detection → [ML Guide § Anomaly](ML_GUIDE.md#anomaly-detection)
- Hyperparameter optimization → [ML Guide § HPO](ML_GUIDE.md#hyperparameter-optimization)
- Backtesting → [ML Guide § Backtesting](ML_GUIDE.md#backtesting)

### 💼 Portfolio Management

- Portfolio optimization → [Portfolio Guide § Optimization](PORTFOLIO_GUIDE.md#portfolio-optimization)
- Rebalancing strategies → [Portfolio Guide § Rebalancing](PORTFOLIO_GUIDE.md#portfolio-rebalancing)
- Risk management (VaR, CVaR) → [Portfolio Guide § Risk](PORTFOLIO_GUIDE.md#risk-management)
- Stress testing → [Portfolio Guide § Stress Testing](PORTFOLIO_GUIDE.md#stress-testing)

### 🎯 Trading & Execution

- Smart Order Routing → [Features § SOR](FEATURES.md#smart-order-routing-sor)
- Algorithmic execution (VWAP, TWAP, Iceberg) → [Features § Algos](FEATURES.md#algorithmic-execution)
- Market screener → [Features § Screener](FEATURES.md)
- Order management → [API Reference](API_REFERENCE.md)

### 🔧 Development

- Установка → [Getting Started § Setup](GETTING_STARTED.md)
- API интеграция → [API Reference](API_REFERENCE.md)
- WebSocket streaming → [WebSocket Guide](WEBSOCKET.md)
- Gateway setup → [Gateway Guide](GATEWAY.md)

## 📈 Производительность

| Метрика           | Значение            | Документ                                           |
| ----------------- | ------------------- | -------------------------------------------------- |
| API Latency (p95) | < 100ms             | [Architecture](ARCHITECTURE.md#производительность) |
| WebSocket         | 10,000 msg/sec      | [Architecture](ARCHITECTURE.md#производительность) |
| ClickHouse        | 100,000 inserts/sec | [Architecture](ARCHITECTURE.md#производительность) |
| Redis Speedup     | 7-24x               | [Architecture](ARCHITECTURE.md#redis-кэширование)  |

## 🔒 Безопасность

**Статус:** Production Ready ✅ (9/10)

- ✅ SQL Injection защита
- ✅ API Keys шифрование (AES-256-GCM)
- ✅ Circuit Breaker & Retry
- ✅ Input validation (Zod)

**Подробнее:** [Architecture § Безопасность](ARCHITECTURE.md#безопасность)

## 🐛 Troubleshooting

**Проблемы с запуском:**
→ [Getting Started § Troubleshooting](GETTING_STARTED.md#troubleshooting)

**ML модели не работают:**
→ [ML Guide § Troubleshooting](ML_GUIDE.md#troubleshooting)

**WebSocket не подключается:**
→ [WebSocket § Troubleshooting](WEBSOCKET.md)

## 🤝 Вклад в документацию

Нашли ошибку или хотите улучшить документацию?

1. Создайте issue с описанием проблемы
2. Предложите изменения через pull request
3. Следуйте стилю существующей документации

## 📊 Статистика документации

- **9 документов** — оптимизировано с 26
- **~5,000 строк** — сокращено с 11,400
- **100% покрытие** — все функции задокументированы
- **Актуальность** — обновлено 6 октября 2025

---

**Нужна помощь?** Начните с [Getting Started](GETTING_STARTED.md) или изучите [Features](FEATURES.md)
