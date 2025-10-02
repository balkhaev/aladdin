# Quick Start: Автоматическая Торговля

**Время:** 10 минут | **Режим:** Paper Trading (безопасное тестирование)

## 🎯 Цель

Запустить автоматическую торговую систему с sentiment analysis и risk management для безопасного тестирования.

> ⚠️ **Важно:** Используйте только Paper Trading Mode! Переход на Live Trading только после 2+ недель успешного тестирования.

## 📋 Требования

1. Все основные сервисы запущены (market-data, trading, portfolio, risk, screener)
2. Telega service настроен и запущен
3. Twity service настроен и запущен

## 🚀 Быстрый Старт

### Шаг 1: Настроить Telega (Telegram Signals)

```bash
cd integrate/telega

# Установить зависимости
npm install

# Создать БД
npm run db:push

# Настроить .env
cp .env.example .env
```

Отредактируйте `.env`:

```env
PORT=3000
TELEGRAM_API_ID=your_api_id          # Получить на my.telegram.org
TELEGRAM_API_HASH=your_api_hash      # Получить на my.telegram.org
TELEGRAM_CHANNEL_ID=@crypto_signals  # Ваш Telegram канал
DATABASE_URL=postgresql://...
```

```bash
# Запустить (первый раз потребует верификацию по телефону)
npm run dev
```

**Тест:**

```bash
curl http://localhost:3000/health
curl http://localhost:3000/signals
```

### Шаг 2: Настроить Twity (Twitter Scraper)

```bash
cd integrate/twity

# Установить зависимости
pnpm install

# Добавить Twitter cookies
cd apps/api
```

Создайте `twitter_cookies.json` с вашими Twitter cookies (экспортируйте через browser extension).

```bash
# Запустить
cd ../..
pnpm dev:api
```

**Тест:**

```bash
curl http://localhost:8000/health
curl "http://localhost:8000/twitter/search?query=BTC&limit=10"
```

### Шаг 3: Запустить Sentiment Service

```bash
cd apps/sentiment

# Настроить
cp .env.example .env
```

Отредактируйте `.env`:

```env
PORT=3018
TELEGA_URL=http://localhost:3000
TWITY_URL=http://localhost:8000
NATS_URL=nats://nats.balkhaev.com:4222
```

```bash
# Запустить
bun run dev
```

**Тест:**

```bash
curl http://localhost:3018/health
curl http://localhost:3018/api/sentiment/BTCUSDT
curl http://localhost:3018/api/sentiment/services/health
```

### Шаг 4: Запустить Strategy Executor (PAPER MODE)

```bash
cd apps/strategy-executor

# Настроить
cp .env.example .env
```

Отредактируйте `.env`:

```env
PORT=3019
EXECUTOR_MODE=PAPER              # ВАЖНО: Начинать с PAPER!
AUTO_EXECUTE=true                # Автоматическое исполнение
MAX_OPEN_POSITIONS=5             # Макс 5 позиций одновременно

# Эти параметры нужно получить из вашего portfolio
DEFAULT_USER_ID=your_user_id
DEFAULT_PORTFOLIO_ID=your_portfolio_id
DEFAULT_EXCHANGE=binance

# URLs сервисов
TRADING_SERVICE_URL=http://localhost:3011
PORTFOLIO_SERVICE_URL=http://localhost:3012
RISK_SERVICE_URL=http://localhost:3013
NATS_URL=nats://nats.balkhaev.com:4222
```

```bash
# Запустить
bun run dev
```

**Тест:**

```bash
# Check статус
curl http://localhost:3019/health
curl http://localhost:3019/api/executor/stats
curl http://localhost:3019/api/executor/config

# Check pending signals
curl http://localhost:3019/api/executor/pending
```

### Шаг 5: Настроить Risk Limits

```bash
# Установить консервативные лимиты для начала
curl -X POST http://localhost:3013/api/risk/limits \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "your_user_id",
    "type": "MAX_POSITION_SIZE",
    "value": 2,
    "portfolioId": "your_portfolio_id",
    "enabled": true
  }'

curl -X POST http://localhost:3013/api/risk/limits \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "your_user_id",
    "type": "MAX_LEVERAGE",
    "value": 1,
    "portfolioId": "your_portfolio_id",
    "enabled": true
  }'
```

## 📊 Мониторинг

### 1. Real-time Logs

```bash
# Strategy Executor
tail -f logs/strategy-executor-2025-10-04.log

# Sentiment
tail -f logs/sentiment-2025-10-04.log

# Risk
tail -f logs/risk-2025-10-04.log
```

### 2. Dashboard Metrics

**Executor Stats:**

```bash
curl http://localhost:3019/api/executor/stats | jq
```

**Пример ответа:**

```json
{
  "totalSignalsReceived": 45,
  "totalSignalsProcessed": 45,
  "totalOrdersExecuted": 12,
  "totalOrdersSuccessful": 10,
  "totalOrdersFailed": 2,
  "mode": "PAPER",
  "autoExecute": true,
  "currentOpenPositions": 3
}
```

**Monitored Positions:**

```bash
curl http://localhost:3013/api/risk/positions/monitored | jq
```

### 3. NATS Events

Подписаться на события:

```bash
nats sub ">" --server nats://nats.balkhaev.com:4222
```

**События:**

- `screener.signal.STRONG_BUY` - Сигналы от screener
- `sentiment.analysis` - Sentiment анализ
- `sentiment.shift` - Изменения sentiment
- `strategy.order.executed` - Исполненные ордера
- `risk.position.auto-close` - Автозакрытие позиций

## 🎮 Управление

### Включить/Выключить Auto-Execution

```bash
# Отключить
curl -X POST http://localhost:3019/api/executor/toggle \
  -H "Content-Type: application/json" \
  -d '{"autoExecute": false}'

# Включить
curl -X POST http://localhost:3019/api/executor/toggle \
  -H "Content-Type: application/json" \
  -d '{"autoExecute": true}'
```

### Переключить PAPER/LIVE Mode

```bash
# ⚠️ ОСТОРОЖНО: Переключение на LIVE использует реальные деньги!

# LIVE mode
curl -X POST http://localhost:3019/api/executor/mode \
  -H "Content-Type: application/json" \
  -d '{"mode": "LIVE"}'

# Вернуться в PAPER
curl -X POST http://localhost:3019/api/executor/mode \
  -H "Content-Type: application/json" \
  -d '{"mode": "PAPER"}'
```

### Manual Execution (для тестирования)

```bash
curl -X POST http://localhost:3019/api/executor/manual \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTCUSDT",
    "recommendation": "BUY",
    "confidence": 0.85
  }'
```

## 📈 Ожидаемый Workflow

### 1. Скрининг (каждые 15 минут)

Screener анализирует рынок и публикует сигналы:

```
screener.signal.STRONG_BUY { symbol: "BTCUSDT", confidence: 0.85 }
```

### 2. Sentiment Analysis (каждые 5 минут)

Sentiment service анализирует Telegram и Twitter:

```
sentiment.analysis { symbol: "BTCUSDT", overall: 0.65, confidence: 0.8 }
```

### 3. Signal Processing

Strategy Executor получает сигналы и обрабатывает:

- Проверяет confidence (min 0.6)
- Фильтрует по типу (только BUY/STRONG_BUY)
- Добавляет в очередь pending signals

### 4. Risk Check

Перед исполнением проверяет:

- Max open positions (не превышен?)
- Position size limits
- Leverage limits
- Available balance

### 5. Order Execution

**PAPER MODE:**

```
📝 PAPER TRADE executed:
  Symbol: BTCUSDT
  Side: BUY
  Quantity: 0.001
  Price: $50000
  Stop-Loss: $47500
  Take-Profit: $55000
```

**LIVE MODE:**

```
💰 LIVE ORDER executed:
  Order ID: abc123
  Symbol: BTCUSDT
  Quantity: 0.001
  Price: $50000
```

### 6. Position Monitoring

Автоматически мониторит позицию:

- Stop-loss: $47500 (5% ниже)
- Take-profit: $55000 (10% выше)
- Trailing stop: 3% от пика

Когда цена достигает условий:

```
risk.position.auto-close {
  reason: "Take-profit triggered",
  price: $55000,
  pnl: +$500
}
```

## 🔧 Troubleshooting

### Нет сигналов

1. Проверьте Screener запущен:

```bash
curl http://localhost:3017/health
```

2. Запустите скрининг вручную:

```bash
curl -X POST http://localhost:3017/api/screener/run \
  -H "Content-Type: application/json" \
  -d '{"timeframe": "15m"}'
```

3. Проверьте NATS:

```bash
nats sub "screener.signal.>" --server nats://nats.balkhaev.com:4222
```

### Sentiment Service не получает данные

1. Проверьте telega и twity:

```bash
curl http://localhost:3000/health
curl http://localhost:8000/health
```

2. Проверьте данные:

```bash
curl http://localhost:3000/signals
curl "http://localhost:8000/twitter/search?query=BTC&limit=5"
```

### Orders не исполняются

1. Проверьте режим:

```bash
curl http://localhost:3019/api/executor/config
```

2. Проверьте auto-execute enabled:

```json
{ "autoExecute": true }
```

3. Проверьте pending signals:

```bash
curl http://localhost:3019/api/executor/pending
```

4. Проверьте risk limits:

```bash
curl http://localhost:3013/api/risk/limits/your_user_id
```

## ⚠️ ВАЖНЫЕ ПРАВИЛА

### Перед переходом на LIVE:

1. ✅ Протестировать в PAPER минимум 2 недели
2. ✅ Win Rate > 55%
3. ✅ Max Drawdown < 15%
4. ✅ Stable profit 3+ дня подряд
5. ✅ Установить stop-loss на ВСЕХ позициях
6. ✅ Начать с малых сумм ($100-500)
7. ✅ Max position size = 2% баланса
8. ✅ No leverage в первые 3 месяца

### Risk Management:

- 🚫 Никогда не рисковать >2% на сделку
- 🚫 Max 5 открытых позиций
- 🚫 Daily loss limit 5% портфеля
- ✅ Stop-loss ОБЯЗАТЕЛЕН
- ✅ Weekly profit: выводить 50%

## 📊 Expected Performance

### Conservative (Paper Trading)

- Win Rate: 50-55%
- Avg Trade: 5-10 trades/day
- Monthly Return: 10-15%
- Max Drawdown: 15-20%

### With Good Sentiment (Optimistic)

- Win Rate: 60-65%
- Avg Trade: 10-15 trades/day
- Monthly Return: 20-30%
- Max Drawdown: 20-25%

## 📚 Следующие шаги

1. **Week 1-2**: Paper trading, мониторинг логов
2. **Week 3-4**: Оптимизация parameters, добавление фильтров
3. **Month 2**: Добавление sentiment в скрининг
4. **Month 3**: LIVE trading с малыми суммами

## 🆘 Support

- Logs: `/logs/*.log`
- Health: `http://localhost:PORT/health`
- Stats: `http://localhost:3019/api/executor/stats`
- NATS: `nats sub ">" --server nats://nats.balkhaev.com:4222`

Удачной торговли! 🚀
