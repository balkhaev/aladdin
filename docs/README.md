# Aladdin Trading Platform

Современная микросервисная платформа для торговли и анализа крипто рынков.

**Версия:** 2.1 (Service Consolidation)  
**Статус:** Production Ready ✅  
**Последнее обновление:** 5 октября 2025

## 🎯 Ключевые улучшения v2.1

- ✅ **Оптимизация архитектуры** - 14 сервисов → 8 сервисов (43% сокращение)
- ✅ **Единая инфраструктура** - BaseService, ServiceBootstrap, стандартизированные утилиты
- ✅ **Безопасность** - Исправлены все SQL injection, добавлено шифрование API ключей
- ✅ **Производительность** - Redis кэширование (7-24x ускорение), Circuit Breaker, Retry логика
- ✅ **Типобезопасность** - Zod валидация, полная типизация с TypeScript
- ✅ **Уменьшение кода** - ~13,700 строк удалено благодаря объединению сервисов

📊 **[Подробный статус проекта →](docs/PROJECT_STATUS.md)**

## 🚀 Быстрый старт

```bash
# Установка зависимостей
bun install

# Применить миграции БД
bun db:push

# Запустить все сервисы
./START_ALL.sh

# Или запустить отдельные сервисы
bun dev:web          # Frontend (3001)
bun dev:server       # API Gateway (3000)
bun dev:market-data  # Market Data (3010) - включает macro + on-chain
bun dev:trading      # Trading (3011) - включает executor
bun dev:portfolio    # Portfolio (3012) - включает risk
bun dev:analytics    # Analytics (3014) - включает sentiment
bun dev:screener     # Screener (3017)
bun dev:social       # Social Integrations (3018) - telega + twity
```

Откройте http://localhost:3001

## 🏗️ Архитектура

```
Frontend (React) → API Gateway → 6 Backend Services → Инфраструктура
      (3001)          (3000)         (3010-3018)        (PostgreSQL, ClickHouse, NATS)
```

### Сервисы (После рефакторинга v2.1)

| Сервис          | Порт | Объединяет                     | Статус |
| --------------- | ---- | ------------------------------ | ------ |
| **Web UI**      | 3001 | Frontend                       | ✅     |
| **API Gateway** | 3000 | Gateway                        | ✅     |
| **Market Data** | 3010 | market-data + macro + on-chain | ✅     |
| **Trading**     | 3011 | trading + executor             | ✅     |
| **Portfolio**   | 3012 | portfolio + risk               | ✅     |
| **Analytics**   | 3014 | analytics + sentiment          | ✅     |
| **Screener**    | 3017 | screener                       | ✅     |
| **Social**      | 3018 | telega + twity                 | ✅     |

**Итого:** 8 сервисов (было 14) — сокращение на 43%!

## 📦 Ключевые возможности

- **Real-time данные** - WebSocket стриминг с 3 бирж, VWAP агрегация
- **Торговля** - Market/Limit ордера, Smart Order Routing, алгоритмическое исполнение
- **Аналитика** - Технические индикаторы, бэктестинг, макро данные, on-chain метрики
- **ML & AI** - LSTM predictions, sentiment analysis, anomaly detection
- **Риск-менеджмент** - VaR/CVaR, stress testing, portfolio optimization
- **Скрининг** - 11+ стратегий, real-time сигналы

## 🛠️ Технологии

**Backend:** Bun, Hono, Prisma, NATS, Winston, Zod  
**Frontend:** React, Vite, TanStack, shadcn/ui, Lightweight Charts  
**Инфраструктура:** PostgreSQL, ClickHouse, NATS, Redis (удаленные)  
**Безопасность:** AES-256-GCM, Circuit Breaker, Retry логика

## 📁 Структура

```
coffee/
├── apps/
│   ├── web/                    # Frontend
│   ├── server/                 # API Gateway
│   ├── market-data/            # Market Data + Macro + On-Chain
│   ├── trading/                # Trading + Strategy Executor
│   ├── portfolio/              # Portfolio + Risk Management
│   ├── analytics/              # Analytics + Sentiment
│   ├── screener/               # Market Screener
│   └── social-integrations/    # Telegram + Twitter (Telega + Twity)
├── packages/
│   ├── shared/                 # Общие библиотеки
│   └── database/               # Prisma схемы и миграции
├── docs/                       # Документация
└── logs/                       # Логи сервисов
```

## 📖 Документация

- **[GETTING_STARTED.md](docs/GETTING_STARTED.md)** - Быстрый старт
- **[API_REFERENCE.md](docs/API_REFERENCE.md)** - API справочник
- **[FEATURES.md](docs/FEATURES.md)** - Возможности платформы
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Архитектура и безопасность
- **[ML_GUIDE.md](docs/ML_GUIDE.md)** - Machine Learning guide
- **[ROADMAP.md](docs/ROADMAP.md)** - План развития
- **[CHANGELOG.md](docs/CHANGELOG.md)** - История изменений

## 🔧 Команды

```bash
# Разработка
bun dev              # Все сервисы
bun dev:web          # Только Frontend
bun dev:server       # Только Gateway
bun dev:market-data  # Market Data (+ macro + on-chain)
bun dev:trading      # Trading (+ executor)
bun dev:portfolio    # Portfolio (+ risk)
bun dev:analytics    # Analytics (+ sentiment)
bun dev:screener     # Screener
bun dev:social       # Social Integrations (telega + twity)

# База данных
bun db:push          # Миграции PostgreSQL
bun db:studio        # Prisma Studio
bun clickhouse:schema # Схема ClickHouse

# Код
bun check            # Lint + format
bun build            # Build всех сервисов

# Тестирование
bun scripts/test-cache-performance.ts  # Тест производительности Redis кэша
```

## 📊 Логи

Все логи в `/logs`:

```bash
tail -f logs/market-data.log
tail -f logs/trading.log
```

## 🔗 Инфраструктура

Вся инфраструктура на удаленных серверах:

- PostgreSQL: `49.13.216.63:65432`
- ClickHouse: `49.13.216.63:8123`
- NATS: `nats.balkhaev.com`

Docker НЕ требуется для разработки!

## 📈 Roadmap

**Завершено:** Рефакторинг архитектуры (14→8 сервисов), Multi-exchange support, ML predictions, Risk management  
**В процессе:** Circuit Breaker integration, Comprehensive testing  
**Запланировано:** Automated trading, Mobile app, Kubernetes deployment

🎯 **[Полный Roadmap →](docs/ROADMAP.md)**

## 🐛 Troubleshooting

```bash
# Health checks
curl http://localhost:3000/health
curl http://localhost:3010/health

# Логи
tail -f logs/*.log

# Проверка инфраструктуры
curl http://49.13.216.63:8123/ping  # ClickHouse
nc -zv nats.balkhaev.com 4222       # NATS
```
