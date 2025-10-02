# Карта портов сервисов Aladdin

## Основные сервисы

| Порт | Сервис                | Описание                         |
| ---- | --------------------- | -------------------------------- |
| 3000 | **server** (Gateway)  | API Gateway - единая точка входа |
| 3001 | **web**               | Frontend веб-приложение          |
| 3005 | **telega**            | Telegram signal scraper          |
| 3010 | **market-data**       | Рыночные данные и котировки      |
| 3011 | **trading**           | Торговые операции                |
| 3012 | **portfolio**         | Управление портфелями            |
| 3013 | **risk**              | Управление рисками               |
| 3014 | **analytics**         | Аналитика и индикаторы           |
| 3015 | **on-chain**          | On-chain метрики                 |
| 3016 | **macro-data**        | Макроэкономические данные        |
| 3017 | **screener**          | Скринер активов                  |
| 3018 | **sentiment**         | Анализ настроений                |
| 3019 | **strategy-executor** | Исполнение стратегий             |
| 8000 | **twity**             | Twitter scraper                  |

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

## Переменные окружения

### Gateway (apps/server/.env)

```env
PORT=3000
MARKET_DATA_URL=http://localhost:3010
TRADING_URL=http://localhost:3011
PORTFOLIO_URL=http://localhost:3012
RISK_URL=http://localhost:3013
ANALYTICS_URL=http://localhost:3014
ON_CHAIN_URL=http://localhost:3015
MACRO_DATA_URL=http://localhost:3016
SCREENER_URL=http://localhost:3017
SENTIMENT_URL=http://localhost:3018
STRATEGY_EXECUTOR_URL=http://localhost:3019
TELEGA_URL=http://localhost:3005
TWITY_URL=http://localhost:8000
```

### Frontend (apps/web/.env)

```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000/ws
```

### Sentiment (apps/sentiment/.env)

```env
PORT=3018
TELEGA_URL=http://localhost:3005
TWITY_URL=http://localhost:8000
```

### Strategy Executor (apps/strategy-executor/.env)

```env
PORT=3019
TRADING_SERVICE_URL=http://localhost:3011
PORTFOLIO_SERVICE_URL=http://localhost:3012
RISK_SERVICE_URL=http://localhost:3013
MARKET_DATA_SERVICE_URL=http://localhost:3010
```

## Health Check URLs

Проверка всех сервисов:

```bash
# Gateway
curl http://localhost:3000/health

# Telega
curl http://localhost:3005/health

# Twity
curl http://localhost:8000/health

# Market Data
curl http://localhost:3010/health

# Trading
curl http://localhost:3011/health

# Portfolio
curl http://localhost:3012/health

# Risk
curl http://localhost:3013/health

# Analytics
curl http://localhost:3014/health

# On-Chain
curl http://localhost:3015/health

# Macro Data
curl http://localhost:3016/health

# Screener
curl http://localhost:3017/health

# Sentiment
curl http://localhost:3018/health

# Strategy Executor
curl http://localhost:3019/health
```

## Обновление документации

После изменения этого файла также обновите:

- README.md
- API.md
- QUICK_START_TRADING.md
- TELEGA_TWITY_INTEGRATION.md
- SENTIMENT_INTEGRATION.md
- Все .env.example файлы
