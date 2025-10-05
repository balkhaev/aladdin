# Возможности платформы

Полное описание функций и возможностей платформы Aladdin.

**Версия:** 2.1  
**Статус:** Production Ready ✅

---

## 📊 Combined Sentiment Analysis

Объединяет сигналы из Analytics (35%), Futures (25%), Order Book (15%), Social (25%).  
Score range: -100 (bearish) → +100 (bullish)

**API:** `/api/analytics/sentiment/:symbol/combined`

---

## 📈 Futures Market

Мониторинг Funding Rates и Open Interest с 3 бирж.  
**API:** `/api/market-data/:symbol/funding-rate/all`

---

## 🤖 Machine Learning

**LSTM + Hybrid + Ensemble predictions** с +5-15% улучшением  
**Anomaly Detection:** Pump & Dump, Flash Crash  
**Backtesting:** Simple, Walk-forward, Model comparison  
**HPO:** Grid Search, Random Search

📖 **[Подробный ML Guide →](./ML_GUIDE.md)**

---

## 🎯 Smart Order Routing (SOR)

**Статус:** ✅ Production Ready

Автоматический выбор лучшей биржи для исполнения ордеров.

### Стратегии

1. **Best Price** - лучшая цена на одной бирже
2. **Best Execution** - баланс цены, комиссий, ликвидности
3. **Fastest** - минимальная latency
4. **Split** - разделение ордера между биржами
5. **Smart** - адаптивный выбор

### Scoring

Composite score учитывает:

- Price (цена на бирже)
- Fees (комиссии)
- Latency (задержка)
- Liquidity (ликвидность)

**Adaptive weights** на основе urgency:

- Low: price 60%, fees 20%, liquidity 15%, latency 5%
- Medium: price 50%, fees 15%, liquidity 20%, latency 15%
- High: latency 40%, price 30%, liquidity 20%, fees 10%

**API:**

```bash
POST /api/trading/smart-routing
GET /api/trading/compare-prices?symbol=BTCUSDT
```

---

## 🎲 Algorithmic Execution

**Статус:** ✅ Production Ready

Профессиональные алгоритмы исполнения для минимизации market impact.

### VWAP (Volume Weighted Average Price)

Распределяет исполнение пропорционально историческому объему.

**Преимущества:**

- Минимизирует market impact
- Следует естественному ритму рынка
- Оптимально для крупных ордеров (1+ час)

**Когда использовать:** Крупные ордера (>1% дневного объема)

### TWAP (Time Weighted Average Price)

Равномерно распределяет исполнение во времени.

**Преимущества:**

- Простота и предсказуемость
- Не требует historical data
- Равномерная нагрузка на рынок

**Когда использовать:** Средние ордера, период 5-60 минут

### Iceberg Orders

Скрывает общий размер ордера.

**Преимущества:**

- Скрывает намерения от рынка
- Предотвращает front-running
- Защита от манипуляций

**Когда использовать:** Очень крупные ордера, необходимость скрыть размер

**API:**

```bash
POST /api/trading/executor/algorithmic
GET /api/trading/executor/algorithmic
DELETE /api/trading/executor/algorithmic/:id
```

---

## ⚠️ Risk Management

**VaR/CVaR:** Оценка потенциальных убытков (95%, 99% confidence)  
**Stress Testing:** 5 сценариев (Crypto Winter, Flash Crash, Exchange Hack, etc.)  
**Portfolio Optimization:** Markowitz Mean-Variance, Efficient Frontier  
**Rebalancing:** Threshold, Time, Volatility-based strategies

**API:** `/api/portfolio/:id/risk/var`, `/api/portfolio/:id/risk/optimize`

---

## 📱 Social Media Integration

**Источники:** Twitter/X (15 KOL), Reddit (8 subreddits), Telegram  
**NLP Analysis:** Weighted lexicon, Intensifiers, Negators  
**Storage:** ClickHouse (90-day TTL)

**API:** `/api/scraper/sentiment/:symbol`

---

## 🚀 Redis Caching

**Ускорение:** 7-24x для критических операций  
**Экономия:** ~$1,000/месяц  
**TTL:** 1s (prices) → 1h (static data)

**API:** `/api/analytics/cache/stats`

---

## 📊 Technical Analysis

**Статус:** ✅ Production Ready

### Индикаторы

**Momentum:**

- RSI (Relative Strength Index)
- MACD (Moving Average Convergence Divergence)
- Stochastic Oscillator

**Trend:**

- EMA (Exponential Moving Average)
- SMA (Simple Moving Average)
- Bollinger Bands

**Volume:**

- Volume analysis
- Volume-weighted indicators
- OBV (On-Balance Volume)

### Backtesting

**Strategies:**

- RSI oversold/overbought
- MACD cross
- Bollinger Bands breakout
- EMA crossover

**Metrics:**

- Total Return
- Win Rate
- Sharpe Ratio
- Sortino Ratio
- Calmar Ratio
- Max Drawdown
- Profit Factor

**API:**

```bash
GET /api/analytics/indicators/:symbol?indicator=RSI&period=14&interval=1h
POST /api/analytics/backtest
```

---

## 🔍 Market Screener

**Статус:** ✅ Production Ready

### Стратегии (11+)

1. RSI Oversold (< 30)
2. RSI Overbought (> 70)
3. MACD Bullish Cross
4. MACD Bearish Cross
5. Bollinger Breakout (upper/lower)
6. Volume Spike (> 200%)
7. Price Breakout (52-week high)
8. EMA Cross (bullish/bearish)
9. Support/Resistance
10. Gap Up/Down
11. Custom strategies

### Автопоиск

- Real-time сканирование
- NATS events publishing
- WebSocket сигналы
- Configurable intervals (1m, 5m, 15m, 1h, 4h, 1d)

**API:**

```bash
GET /api/screener/scan
POST /api/screener/strategies
GET /api/screener/strategies
WS ws://localhost:3017/signals
```

---

## 📈 Market Data

**Статус:** ✅ Production Ready

### Real-time Data

**Multi-Exchange Support:**

- Binance
- Bybit
- OKX

**WebSocket Streaming:**

- Price updates (sub-second)
- Order book snapshots
- Trade executions
- 10,000 msg/sec throughput

### Aggregation

**VWAP Aggregation:**

- Volume-weighted average price
- Cross-exchange price discovery
- Arbitrage opportunities detection

**Arbitrage:**

- Real-time spread calculation
- Exchange comparison
- Execution cost estimation

### Macro Data

**Global Metrics:**

- Total market cap
- 24h volume
- BTC/ETH dominance
- Active cryptocurrencies

**Fear & Greed Index:**

- Daily updates
- Historical data (30+ days)
- 0-100 scale classification

**Trending:**

- Top coins по категориям
- Social volume
- Search trends

### On-Chain Metrics

**BTC & ETH:**

- Whale transactions (>$1M)
- Exchange flows (inflow/outflow)
- Active addresses
- NVT Ratio (Network Value to Transactions)
- Market cap

**API:**

```bash
# Market Data
GET /api/market-data/aggregated/:symbol
GET /api/market-data/arbitrage?minSpread=0.1
WS ws://localhost:3010/ws

# Macro
GET /api/market-data/macro/global
GET /api/market-data/macro/feargreed
GET /api/market-data/macro/trending

# On-Chain
GET /api/market-data/on-chain/metrics/latest/:blockchain
GET /api/market-data/on-chain/whale-transactions/:blockchain
```

---

## 💼 Portfolio Management

**Статус:** ✅ Production Ready

### Возможности

**Multi-Portfolio:**

- Unlimited portfolios
- Different strategies per portfolio
- Portfolio groups

**Position Tracking:**

- Real-time P&L
- Cost basis (FIFO, LIFO, Average)
- Realized/Unrealized gains

**Performance Analytics:**

- Daily/Weekly/Monthly returns
- Sharpe/Sortino/Calmar ratios
- Benchmark comparison
- Attribution analysis

**Import:**

- Manual import
- Exchange integration (Binance, Bybit, OKX)
- CSV import

**API:**

```bash
POST /api/portfolio
GET /api/portfolio/:id
GET /api/portfolio/:id/positions
POST /api/portfolio/:id/import
GET /api/portfolio/:id/performance?days=30
POST /api/portfolio/:id/snapshot
```

---

---

**Все функции протестированы и готовы к production использованию.** ✅

📖 **Документация:** [API Reference](./API_REFERENCE.md) | [Getting Started](./GETTING_STARTED.md) | [ML Guide](./ML_GUIDE.md)
