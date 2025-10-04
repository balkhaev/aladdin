# Aladdin Trading Platform

Современная микросервисная платформа для торговли и анализа крипто рынков.

**Версия:** 2.0 (After Major Refactor)  
**Статус:** Production Ready ✅  
**Последнее обновление:** 4 октября 2025

## 🎯 Ключевые улучшения v2.0

- ✅ **Единая инфраструктура** - BaseService, ServiceBootstrap, стандартизированные утилиты
- ✅ **Безопасность** - Исправлены все SQL injection, добавлено шифрование API ключей
- ✅ **Производительность** - Redis кэширование (7-24x ускорение), Circuit Breaker, Retry логика
- ✅ **Типобезопасность** - Zod валидация, полная типизация с TypeScript
- ✅ **Модульность** - Analytics разбит на переиспользуемые модули

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
bun dev:market-data  # Market Data (3010)
```

Откройте http://localhost:3001

## 🏗️ Архитектура

```
Frontend (React) → API Gateway → Микросервисы → Инфраструктура
      (3001)          (3000)       (3010-3017)   (PostgreSQL, ClickHouse, NATS)
```

### Сервисы

| Сервис      | Порт | Статус | Версия | Миграция v2.0 |
| ----------- | ---- | ------ | ------ | ------------- |
| Web UI      | 3001 | ✅     | 1.0    | N/A           |
| API Gateway | 3000 | ✅     | 1.5    | 🟡 Частично   |
| Market Data | 3010 | ✅     | 1.5    | 🟡 Частично   |
| Trading     | 3011 | ✅     | 1.0    | 🔴 Не начата  |
| Portfolio   | 3012 | ✅     | 1.0    | 🔴 Не начата  |
| Risk        | 3013 | ✅     | 2.0    | ✅ Завершена  |
| Analytics   | 3014 | ✅     | 2.0    | ✅ Завершена  |
| On-Chain    | 3015 | ✅     | 1.0    | 🔴 Не начата  |
| Macro Data  | 3016 | ✅     | 1.0    | 🔴 Не начата  |
| Screener    | 3017 | ✅     | 1.0    | 🔴 Не начата  |

**Прогресс миграции:** 30% (2 из 8 сервисов)

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
│   ├── web/              # Frontend
│   ├── server/           # API Gateway
│   ├── market-data/      # Market Data Service
│   ├── trading/          # Trading Service
│   ├── portfolio/        # Portfolio Service
│   ├── risk/             # Risk Management Service
│   ├── analytics/        # Analytics Service
│   ├── on-chain/         # On-Chain Sentiment Service
│   ├── screener/         # Market Screener Service
│   └── ...
├── packages/
│   └── shared/           # Общие библиотеки
├── docs/                 # Документация
└── logs/                 # Логи сервисов
```

## 📖 Документация

### Основные документы

- **[API.md](docs/API.md)** - 🔌 REST API и WebSocket эндпоинты
- **[FEATURES.md](docs/FEATURES.md)** - ✨ Основные фичи (Sentiment, Futures, Trading Bot, Cache)
- **[INTEGRATIONS.md](docs/INTEGRATIONS.md)** - 🔗 Интеграции (Telegram, Twitter, Redis, Sentiment)
- **[EXAMPLES.md](docs/EXAMPLES.md)** - 💡 Практические примеры использования API
- **[QUICK_START_TRADING.md](docs/QUICK_START_TRADING.md)** - 🚀 Быстрый старт автоматической торговли
- **[SECURITY.md](docs/SECURITY.md)** - 🔐 Безопасность, шифрование
- **[PERFORMANCE.md](docs/PERFORMANCE.md)** - ⚡ Оптимизация и производительность
- **[CHANGELOG.md](docs/CHANGELOG.md)** - 📝 История изменений и багфиксов
- **[ALADDIN_ROADMAP.md](docs/ALADDIN_ROADMAP.md)** - 🎯 Roadmap к Aladdin-like системе
- **[migrations/](docs/migrations/)** - 📊 SQL миграции для ClickHouse
- **[PORTS.md](docs/PORTS.md)** - 🔌 Порты всех сервисов

## 🔧 Команды

```bash
# Разработка
bun dev              # Все сервисы
bun dev:web          # Только Frontend
bun dev:server       # Только Gateway
bun dev:risk         # Только Risk Service
bun dev:analytics    # Только Analytics Service
bun dev:on-chain     # Только On-Chain Service
bun dev:screener     # Только Screener Service

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

- [x] Микросервисная архитектура
- [x] Multi-exchange support (Binance, Bybit, OKX)
- [x] WebSocket стриминг
- [x] Технические индикаторы и бэктестинг
- [x] On-Chain метрики (BTC, ETH)
- [x] Общая инфраструктура (BaseService, ServiceBootstrap)
- [x] Безопасность (SQL injection fixes, encryption)
- [x] Модульная структура Analytics

### В процессе 🟡

- [ ] Миграция всех сервисов на v2.0 архитектуру
- [ ] Circuit Breaker integration в критические места
- [ ] Comprehensive testing
- [ ] Redis кэширование в остальных сервисах (Risk, Portfolio, On-Chain)

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
