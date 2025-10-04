# Карта портов сервисов Aladdin

> **Последнее обновление:** 5 октября 2025  
> **Архитектура:** Оптимизированная (8 сервисов после рефакторинга)

## Основные сервисы

### Frontend & Gateway (2 сервиса)

| Порт | Сервис              | Описание                         |
| ---- | ------------------- | -------------------------------- |
| 3000 | **server** (Gateway) | API Gateway - единая точка входа |
| 3001 | **web**             | Frontend веб-приложение          |

### Backend Services (6 сервисов)

| Порт | Сервис                    | Описание                                      | Объединяет                        |
| ---- | ------------------------- | --------------------------------------------- | --------------------------------- |
| 3010 | **market-data**           | Рыночные данные, макро данные, on-chain       | market-data + macro-data + on-chain |
| 3011 | **trading**               | Торговые операции и исполнение стратегий      | trading + strategy-executor        |
| 3012 | **portfolio**             | Управление портфелями и рисками               | portfolio + risk                   |
| 3014 | **analytics**             | Аналитика, индикаторы и sentiment             | analytics + sentiment              |
| 3017 | **screener**              | Скринер активов                               | -                                  |
| 3018 | **social-integrations**   | Telegram и Twitter интеграции                 | telega + twity                     |

## Инфраструктура

| Порт | Сервис         | Описание                |
| ---- | -------------- | ----------------------- |
| 4222 | **NATS**       | Message broker (client) |
| 5432 | **PostgreSQL** | Транзакционная БД       |
| 6222 | **NATS**       | Cluster routing         |
| 6379 | **Redis**      | Cache & sessions        |
| 8123 | **ClickHouse** | HTTP interface          |
| 8222 | **NATS**       | HTTP monitoring         |
| 9000 | **ClickHouse** | Native client           |

## API Routes После Рефакторинга

### Market Data (3010)
- `/api/market-data/*` - рыночные данные (существующие)
- `/api/market-data/macro/*` - макроэкономические данные (из macro-data)
- `/api/market-data/on-chain/*` - on-chain метрики (из on-chain)

### Trading (3011)
- `/api/trading/*` - торговые операции (существующие)
- `/api/trading/executor/*` - исполнение стратегий (из strategy-executor)

### Portfolio (3012)
- `/api/portfolio/*` - портфели (существующие)
- `/api/portfolio/:id/risk/*` - управление рисками (из risk)

### Analytics (3014)
- `/api/analytics/*` - аналитика (существующие)
- Sentiment уже интегрирован в analytics

### Social Integrations (3018)
- `/api/social/telegram/*` - Telegram (из telega)
- `/api/social/twitter/*` - Twitter (из twity)

## Переменные окружения

### Gateway (apps/server/.env)

```env
PORT=3000

# Microservices (После рефакторинга)
MARKET_DATA_URL=http://localhost:3010      # Includes: market-data + macro-data + on-chain
TRADING_URL=http://localhost:3011           # Includes: trading + strategy-executor
PORTFOLIO_URL=http://localhost:3012         # Includes: portfolio + risk
ANALYTICS_URL=http://localhost:3014         # Includes: analytics + sentiment
SCREENER_URL=http://localhost:3017          # Standalone
SOCIAL_URL=http://localhost:3018            # Includes: telega + twity
```

### Frontend (apps/web/.env)

```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000/ws
```

## Health Check URLs

Проверка всех сервисов после рефакторинга:

```bash
# Gateway
curl http://localhost:3000/health

# Web (frontend)
curl http://localhost:3001/

# Market Data
curl http://localhost:3010/health

# Trading
curl http://localhost:3011/health

# Portfolio
curl http://localhost:3012/health

# Analytics
curl http://localhost:3014/health

# Screener
curl http://localhost:3017/health

# Social Integrations
curl http://localhost:3018/health
```

## Запуск сервисов

```bash
# Все сервисы
bun dev

# Отдельные сервисы
bun dev:server              # API Gateway
bun dev:web                 # Frontend
bun dev:market-data         # Market Data (включая macro + on-chain)
bun dev:trading             # Trading (включая executor)
bun dev:portfolio           # Portfolio (включая risk)
bun dev:analytics           # Analytics (включая sentiment)
bun dev:screener            # Screener
bun dev:social              # Social Integrations (telegram + twitter)
```

## История изменений

### 5 октября 2025 - Рефакторинг архитектуры
- **Было:** 14 сервисов (12 backend + 2 frontend/gateway)
- **Стало:** 8 сервисов (6 backend + 2 frontend/gateway)
- **Сокращение:** 43% (6 сервисов объединены)
- **Удалено строк кода:** ~13,700 строк

#### Объединенные сервисы:
1. macro-data + on-chain → **market-data**
2. strategy-executor → **trading**
3. risk → **portfolio**
4. sentiment → **analytics**
5. telega + twity → **social-integrations**

## Обновление документации

После изменения портов также обновите:
- `README.md`
- `docs/API.md`
- Все `.env` и `.env.example` файлы
