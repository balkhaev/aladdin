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

## 📦 Возможности

### Торговля и данные

- **Real-time данные** - WebSocket стриминг с 3 бирж (Binance, Bybit, OKX)
- **Агрегация цен** - VWAP, арбитражные возможности
- **Торговля** - Market, Limit, Stop-Loss, Take-Profit ордера
- **Портфель** - Позиции, P&L, история сделок

### Аналитика

- **Технические индикаторы** - RSI, MACD, EMA, SMA, Bollinger Bands
- **Бэктестинг** - Тестирование стратегий на исторических данных
- **Макро данные** - Fear & Greed Index, trending coins, категории
- **On-Chain метрики** - Whale transactions, exchange flows, NVT ratio

### Риск-менеджмент

- **VaR расчет** - Value at Risk (95%, 99% confidence)
- **Лимиты** - Настраиваемые лимиты по портфелям
- **Risk checks** - Проверка ордеров перед исполнением
- **Exposure monitoring** - Мониторинг экспозиции

### Скрининг

- **11+ стратегий** - RSI, MACD, Breakout, Volume Spike и др.
- **Автопоиск** - Real-time поиск торговых сигналов
- **Кастомные стратегии** - Создание собственных правил

### Новые возможности v2.0

- ✅ **Redis кэширование** - До 24x ускорение (интегрировано в Analytics и Market Data)
- ✅ **Circuit Breaker** - Защита от каскадных отказов
- ✅ **Retry логика** - Автоматическое восстановление с exponential backoff
- ✅ **Шифрование** - AES-256-GCM для API ключей
- ✅ **Валидация** - Type-safe Zod схемы
- ✅ **Модульная архитектура** - Переиспользуемые компоненты

## 🛠️ Технологии

**Backend:** Hono, Bun, Prisma, NATS, Winston, Zod  
**Frontend:** React, Vite, TanStack Router & Query, shadcn/ui, TailwindCSS, Lightweight Charts  
**Инфраструктура:** PostgreSQL (Supabase), ClickHouse, NATS, Redis (удаленные)  
**Безопасность:** AES-256-GCM шифрование, Zod валидация, Circuit Breaker, Retry логика

### Новые модули v2.0

**packages/shared:**

- `http.ts` - Стандартизированные HTTP утилиты
- `errors.ts` - Централизованная обработка ошибок
- `base-service.ts` - Базовый класс для сервисов
- `service-bootstrap.ts` - Упрощенная инициализация
- `cache.ts` - Redis кэширование
- `circuit-breaker.ts` - Circuit Breaker паттерн
- `retry.ts` - Retry логика с exponential backoff
- `crypto.ts` - Шифрование данных
- `config.ts` - Централизованная конфигурация
- `middleware/validation.ts` - Zod валидация
- `middleware/auth.ts` - Аутентификация

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

### Основные документы

- **[API.md](docs/API.md)** - 🔌 REST API и WebSocket эндпоинты
- **[FEATURES.md](docs/FEATURES.md)** - ✨ Основные фичи (Sentiment, Futures, Trading Bot, Cache)
- **[INTEGRATIONS.md](docs/INTEGRATIONS.md)** - 🔗 Интеграции (Social, Redis, Strategy Executor)
- **[SOCIAL_INTEGRATIONS.md](docs/SOCIAL_INTEGRATIONS.md)** - 📱 Telegram & Twitter sentiment analysis
- **[EXAMPLES.md](docs/EXAMPLES.md)** - 💡 Практические примеры использования API
- **[QUICK_START_TRADING.md](docs/QUICK_START_TRADING.md)** - 🚀 Быстрый старт автоматической торговли
- **[SECURITY.md](docs/SECURITY.md)** - 🔐 Безопасность, шифрование
- **[PERFORMANCE.md](docs/PERFORMANCE.md)** - ⚡ Оптимизация и производительность
- **[CHANGELOG.md](docs/CHANGELOG.md)** - 📝 История изменений и багфиксов
- **[ALADDIN_ROADMAP.md](docs/ALADDIN_ROADMAP.md)** - 🎯 Roadmap к Aladdin-like системе
- **[REFACTORING_SUMMARY.md](docs/REFACTORING_SUMMARY.md)** - 📦 Итоги рефакторинга v2.1
- **[FRONTEND_SENTIMENT_GUIDE.md](docs/FRONTEND_SENTIMENT_GUIDE.md)** - 🎨 Гайд по фронтенду sentiment
- **[migrations/](docs/migrations/)** - 📊 SQL миграции для ClickHouse
- **[PORTS.md](docs/PORTS.md)** - 🔌 Порты всех сервисов

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

### Завершено ✅

- [x] **Рефакторинг архитектуры** - 14 → 8 сервисов (v2.1)
- [x] Микросервисная архитектура
- [x] Multi-exchange support (Binance, Bybit, OKX)
- [x] WebSocket стриминг
- [x] Технические индикаторы и бэктестинг
- [x] On-Chain метрики (BTC, ETH)
- [x] Общая инфраструктура (BaseService, ServiceBootstrap)
- [x] Безопасность (SQL injection fixes, encryption)
- [x] Модульная структура Analytics
- [x] Консолидация сервисов и удаление дублирования кода

### В процессе 🟡

- [ ] Circuit Breaker integration в критические места
- [ ] Comprehensive testing
- [ ] Redis кэширование в остальных сервисах
- [ ] Полная интеграция Social services (Telegram + Twitter)

### Запланировано 🔵

- [ ] Automated trading execution
- [ ] Mobile app
- [ ] Distributed Tracing (OpenTelemetry + Jaeger)
- [ ] Kubernetes deployment
- [ ] CI/CD Pipeline

🎯 **[Полный Roadmap к Aladdin-like системе →](docs/ALADDIN_ROADMAP.md)**

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
