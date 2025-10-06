# ☕ Coffee Trading Platform

> **Профессиональная платформа для криптовалютного трейдинга с машинным обучением, анализом рисков и алгоритмическим исполнением**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.2-black.svg)](https://bun.sh/)
[![Python](https://img.shields.io/badge/Python-3.11-blue.svg)](https://www.python.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## 🎯 Что это?

Coffee — это enterprise-grade платформа для криптовалютной торговли, вдохновленная системой управления рисками BlackRock Aladdin. Предоставляет полный стек инструментов для трейдеров и институциональных инвесторов:

- **📊 Real-time Market Data** — данные с 3+ бирж (Binance, Bybit, OKX)
- **🤖 Machine Learning** — LSTM прогнозирование, аномалии, sentiment анализ
- **⚠️ Risk Management** — VaR, CVaR, стресс-тестирование, оптимизация портфелей
- **🎯 Smart Execution** — SOR, VWAP, TWAP, Iceberg ордера
- **📈 Technical Analysis** — 15+ индикаторов, бэктестинг, screener
- **💼 Portfolio Management** — multi-portfolio, ребалансировка, attribution
- **📱 Social Sentiment** — Twitter, Reddit, Telegram мониторинг

## 🏗️ Архитектура

### Микросервисы (8 сервисов)

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ HTTP/WS
       ↓
┌─────────────┐
│  Web (3001) │  React + Vite + TanStack
└──────┬──────┘
       │
       ↓
┌─────────────┐
│ Gateway     │  API Gateway (3000)
│  (server)   │  Auth, Rate Limiting, Routing
└──────┬──────┘
       │
       ├─────────┬─────────┬──────────┬──────────┬──────────┐
       ↓         ↓         ↓          ↓          ↓          ↓
  ┌─────────┬─────────┬─────────┬────────┬─────────┬─────────┐
  │Market   │Trading  │Portfolio│Analytics│Screener│Scraper  │
  │Data     │         │         │        │        │         │
  │(3010)   │(3011)   │(3012)   │(3014)  │(3017)  │(3018)   │
  └────┬────┴────┬────┴────┬────┴────┬───┴────┬───┴────┬────┘
       │         │         │         │        │        │
       └─────────┴─────────┴─────────┴────────┴────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ↓                 ↓                 ↓
  ┌───────────┐    ┌──────────┐     ┌──────────┐
  │PostgreSQL │    │ClickHouse│     │   NATS   │
  │  (5432)   │    │  (8123)  │     │  (4222)  │
  └───────────┘    └──────────┘     └──────────┘
```

### Технологический стек

**Backend:**

- 🚀 **Bun** — современный JavaScript runtime
- 🔥 **Hono** — быстрый веб-фреймворк
- 📊 **ClickHouse** — time-series данные
- 🐘 **PostgreSQL** — транзакционные данные
- 📨 **NATS** — event-driven messaging
- ⚡ **Redis** — кэширование

**Frontend:**

- ⚛️ **React 18** + **TypeScript**
- ⚡ **Vite** — молниеносная сборка
- 🎨 **Tailwind CSS** — современный дизайн
- 📊 **TanStack Query** — управление состоянием
- 📈 **lightweight-charts** — профессиональные графики

**ML & Data Science:**

- 🐍 **Python 3.11** + **PyTorch**
- 🧠 **LSTM/GRU** — предсказание цен
- 🔍 **Optuna** — hyperparameter optimization
- 📊 **Pandas** + **NumPy** — обработка данных

## ⚡ Быстрый старт

### Требования

- **Bun** >= 1.0 ([установка](https://bun.sh/docs/installation))
- **Node.js** >= 20 (для совместимости)
- **Python** >= 3.11 (для ML сервиса)
- **Git**

### Установка (5 минут)

```bash
# 1. Клонировать репозиторий
git clone <repository-url> coffee
cd coffee

# 2. Установить зависимости
bun install

# 3. Настроить базу данных
bun db:push

# 4. Запустить все сервисы
bun dev
```

Откройте **http://localhost:3001** — готово! 🎉

### Проверка запуска

```bash
# Health checks
curl http://localhost:3000/health  # Gateway
curl http://localhost:3010/health  # Market Data
curl http://localhost:3011/health  # Trading
curl http://localhost:3012/health  # Portfolio

# Получить цену BTC
curl http://localhost:3010/api/market-data/aggregated/BTCUSDT

# Логи
tail -f logs/market-data.log
```

## 📦 Структура проекта

```
coffee/
├── apps/                       # Микросервисы
│   ├── web/                    # Frontend (React + Vite)
│   ├── server/                 # API Gateway
│   ├── market-data/            # Рыночные данные + Macro + On-Chain
│   ├── trading/                # Торговля + Strategy Executor
│   ├── portfolio/              # Портфели + Risk Management
│   ├── analytics/              # Аналитика + Sentiment + ML
│   ├── screener/               # Market Screener
│   ├── scraper/                # Social Media (Twitter, Reddit, Telegram)
│   └── ml-python/              # ML Service (Python + PyTorch)
│
├── packages/                   # Общие библиотеки
│   ├── core/                   # Базовые типы и константы
│   ├── database/               # Prisma схемы
│   ├── gateway/                # Gateway utilities
│   ├── websocket/              # WebSocket handlers
│   ├── http/                   # HTTP клиенты
│   ├── logger/                 # Логирование
│   ├── messaging/              # NATS интеграция
│   ├── cache/                  # Redis кэширование
│   ├── resilience/             # Circuit breaker, Retry
│   └── validation/             # Zod schemas
│
├── docs/                       # Документация
│   ├── ARCHITECTURE.md         # Архитектура системы
│   ├── FEATURES.md             # Все возможности
│   ├── GETTING_STARTED.md      # Быстрый старт
│   ├── API_REFERENCE.md        # API документация
│   ├── ML_GUIDE.md             # Machine Learning guide
│   ├── GATEWAY.md              # Gateway package
│   └── WEBSOCKET.md            # WebSocket guide
│
├── scripts/                    # Утилиты и миграции
└── logs/                       # Логи сервисов
```

## 🚀 Основные возможности

### 📊 Market Data & Analytics

- **Real-time данные** с 3+ бирж (WebSocket streaming, 10K msg/sec)
- **Технические индикаторы**: RSI, MACD, EMA, SMA, Bollinger Bands
- **Macro метрики**: Fear & Greed Index, market cap, dominance
- **On-Chain метрики**: whale transactions, exchange flows, NVT ratio
- **Арбитраж**: автоматический поиск возможностей между биржами

### 🤖 Machine Learning

- **LSTM прогнозирование** цен (60-70% accuracy)
- **Hybrid модели** (linear + exponential smoothing)
- **Ensemble predictions** (stacking, voting, weighted average)
- **Anomaly Detection**: Pump & Dump, Flash Crash
- **Hyperparameter Optimization**: Grid Search, Random Search
- **Backtesting**: walk-forward validation, model comparison

### ⚠️ Risk Management

- **Value at Risk (VaR)**: 95%, 99% confidence levels
- **Conditional VaR (CVaR)**: expected shortfall
- **Stress Testing**: 5 сценариев (Crypto Winter, Flash Crash, Exchange Hack)
- **Correlation Analysis**: диверсификация портфеля
- **Market Beta**: чувствительность к BTC и традиционным рынкам
- **Portfolio Optimization**: Markowitz Mean-Variance, Efficient Frontier

### 🎯 Smart Trading

**Smart Order Routing (SOR):**

- 5 стратегий: Best Price, Best Execution, Fastest, Split, Smart
- Автоматический выбор биржи по цене, комиссиям, ликвидности
- Multi-exchange order splitting

**Algorithmic Execution:**

- **VWAP** (Volume Weighted Average Price) — минимизация market impact
- **TWAP** (Time Weighted Average Price) — равномерное распределение
- **Iceberg Orders** — скрытие крупных ордеров

### 💼 Portfolio Management

- **Multi-Portfolio**: неограниченное количество портфелей
- **Real-time P&L**: realized/unrealized gains
- **Performance Attribution**: factor-based analysis
- **Rebalancing**: threshold, time, volatility-based стратегии
- **Advanced Metrics**: Sharpe, Sortino, Calmar, Information Ratio

### 📱 Social Sentiment

- **Twitter/X**: мониторинг 15 KOL (Key Opinion Leaders)
- **Reddit**: анализ 8 subreddits (r/cryptocurrency, r/bitcoin, etc.)
- **Telegram**: channel monitoring
- **Advanced NLP**: weighted lexicon, intensifiers, negators
- **Combined Sentiment**: агрегация из всех источников с весами

### 🔍 Market Screener

- **11+ стратегий**: RSI oversold/overbought, MACD cross, BB breakout
- **Real-time сканирование**: автоматический поиск возможностей
- **WebSocket signals**: мгновенные уведомления
- **Custom strategies**: создание своих стратегий

## 🔧 Команды

```bash
# Разработка
bun dev                  # Все сервисы
bun dev:web              # Frontend (3001)
bun dev:server           # Gateway (3000)
bun dev:market-data      # Market Data (3010)
bun dev:trading          # Trading (3011)
bun dev:portfolio        # Portfolio (3012)
bun dev:analytics        # Analytics (3014)

# База данных
bun db:push              # Применить схему
bun db:migrate           # Миграции
bun db:studio            # Prisma Studio UI
bun db:seed              # Загрузить тестовые данные

# Проверка кода
bun check                # Lint с oxlint
bun check-types          # TypeScript проверка
bun x ultracite fix      # Автоисправление с Biome

# Сборка
bun build                # Production build всех сервисов
```

## 📖 Документация

| Документ                                       | Описание                                   |
| ---------------------------------------------- | ------------------------------------------ |
| [**Getting Started**](docs/GETTING_STARTED.md) | Подробный гайд по установке и первым шагам |
| [**Architecture**](docs/ARCHITECTURE.md)       | Архитектура, порты, производительность     |
| [**Features**](docs/FEATURES.md)               | Полное описание всех возможностей          |
| [**API Reference**](docs/API_REFERENCE.md)     | Документация API endpoints                 |
| [**ML Guide**](docs/ML_GUIDE.md)               | Machine Learning модели и бэктестинг       |
| [**Gateway**](docs/GATEWAY.md)                 | API Gateway package                        |
| [**WebSocket**](docs/WEBSOCKET.md)             | WebSocket integration guide                |
| [**Roadmap**](docs/ROADMAP.md)                 | Планы развития платформы                   |

## 📊 Performance

### Текущая производительность

| Метрика               | Значение            | Статус |
| --------------------- | ------------------- | ------ |
| **API Latency (p95)** | < 100ms             | ✅     |
| **WebSocket**         | 10,000 msg/sec      | ✅     |
| **ClickHouse**        | 100,000 inserts/sec | ✅     |
| **Redis Speedup**     | 7-24x               | ✅     |
| **Uptime**            | 99.9% target        | ✅     |

### Кэширование

- **Hot data** (prices): 1s TTL
- **Warm data** (indicators): 60s TTL
- **Cold data** (symbols): 1h TTL
- **Ускорение**: 7-24x для критических операций
- **Экономия**: ~$1,000/месяц на инфраструктуре

## 🔒 Безопасность

**Статус: Production Ready** ✅ (9/10)

- ✅ **SQL Injection защита**: параметризованные запросы
- ✅ **API Keys шифрование**: AES-256-GCM
- ✅ **Circuit Breaker**: защита от каскадных сбоев
- ✅ **Retry Logic**: exponential backoff с jitter
- ✅ **Rate Limiting**: защита от DDoS
- ✅ **Input Validation**: Zod schemas
- ✅ **Error Handling**: централизованная обработка

## 🤝 Разработка

### Best Practices

1. **Hot Reload** — все изменения применяются автоматически
2. **Логи** — всегда проверяйте `/logs/<service>.log` при ошибках
3. **Health Checks** — используйте `/health` endpoints для диагностики
4. **Type Safety** — строгая типизация, избегайте `any` и `unknown`
5. **Тесты** — пишите тесты до реализации (TDD)

### Правила кодирования

Проект использует [**Ultracite**](https://github.com/biomejs/biome) для строгого контроля качества:

- ✅ Accessibility (a11y) стандарты
- ✅ TypeScript best practices (no enums, use const assertions)
- ✅ React/JSX правила
- ✅ Безопасность и correctness
- ✅ Единый code style

```bash
# Проверить код
bun check

# Автоисправление
bun x ultracite fix
```

## 📈 Roadmap

### ✅ Completed (v2.1)

- Микросервисная архитектура (8 сервисов)
- Redis кэширование (7-24x speedup)
- VaR, CVaR, Stress Testing
- Portfolio Optimization (Markowitz)
- Smart Order Routing (5 стратегий)
- Algorithmic Execution (VWAP, TWAP, Iceberg)
- Sentiment Analysis (Twitter, Reddit, Telegram)
- LSTM Price Prediction
- Anomaly Detection
- Hyperparameter Optimization

### 🚧 In Progress

- Black-Litterman optimization
- Tax-loss harvesting
- Advanced backtesting framework
- Multi-strategy portfolios
- Options trading support

### 🔮 Planned (Phase 3+)

- Reinforcement Learning для trading
- Risk Parity optimization
- Compliance & Reporting
- Institutional features
- White-label solution

Подробнее: [ROADMAP.md](docs/ROADMAP.md)

## 🐛 Troubleshooting

### Сервис не запускается

```bash
# Проверить логи
tail -f logs/<service-name>.log

# Проверить health
curl http://localhost:<port>/health

# Проверить порты
lsof -i :3000
```

### Нет данных

```bash
# Импорт исторических данных
bun scripts/quick-import-candles.ts

# Проверить ClickHouse
curl http://49.13.216.63:8123/ping
```

### WebSocket не подключается

```bash
# Проверить Market Data
curl http://localhost:3010/health

# Использовать ws:// (не wss://)
const ws = new WebSocket("ws://localhost:3010/ws")
```

Больше решений: [GETTING_STARTED.md](docs/GETTING_STARTED.md#troubleshooting)

## 🙏 Благодарности

Проект вдохновлен:

- **BlackRock Aladdin** — enterprise risk management
- **QuantConnect** — algorithmic trading platform
- **TradingView** — charting и technical analysis

Технологии:

- [Bun](https://bun.sh/) — быстрый JavaScript runtime
- [Hono](https://hono.dev/) — минималистичный web framework
- [ClickHouse](https://clickhouse.com/) — OLAP база данных
- [NATS](https://nats.io/) — cloud-native messaging
- [PyTorch](https://pytorch.org/) — machine learning framework

## 📄 Лицензия

MIT License - см. [LICENSE](LICENSE)

## 🤝 Контакты

- **Issues**: [GitHub Issues](https://github.com/balkhaev/aladdin)

---

**Made with ☕ and ❤️ for crypto traders**

⭐ Поставьте звезду, если проект полезен!
