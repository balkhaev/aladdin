# Быстрый старт Screener

## 🚀 Запуск

### 1. Убедитесь, что Redis запущен

```bash
# Из корневой директории проекта
docker-compose up -d redis
```

### 2. Установите зависимости (уже установлены)

```bash
cd apps/screener
bun install
```

### 3. Запустите сервис

```bash
# Из корневой директории проекта
bun run dev:screener

# Или напрямую из директории screener
cd apps/screener
bun dev
```

Сервис запустится на порту **3014** и автоматически:

- Выполнит первый скрининг всех USDT пар Binance
- Настроит автоматический скрининг каждые 15 минут

## 📊 Использование API

### Проверка состояния

```bash
curl http://localhost:3015/health
```

### Запустить скрининг вручную

```bash
curl -X POST http://localhost:3015/api/screener/run \
  -H "Content-Type: application/json" \
  -d '{"timeframe": "15m"}'
```

### Получить все результаты

```bash
curl http://localhost:3015/api/screener/results?limit=50
```

### Получить топ сигналов на покупку

```bash
curl http://localhost:3015/api/screener/signals/STRONG_BUY?limit=20
```

Доступные рекомендации:

- `STRONG_BUY` - сильный сигнал на покупку
- `BUY` - сигнал на покупку
- `SELL` - сигнал на продажу
- `STRONG_SELL` - сильный сигнал на продажу

### Получить статистику очереди

```bash
curl http://localhost:3015/api/screener/stats
```

Показывает:

- `waiting` - задач в очереди
- `active` - задач в обработке
- `completed` - выполненных задач
- `failed` - проваленных задач

## 📈 Пример результата анализа

```json
{
  "symbol": "BTCUSDT",
  "timestamp": 1696348800000,
  "timeframe": "15m",
  "indicators": {
    "rsi": 52.3,
    "macd": {
      "macd": 123.45,
      "signal": 120.32,
      "histogram": 3.13
    },
    "ema20": 43250.5,
    "ema50": 42800.3,
    "ema200": 41500.2,
    "bollingerBands": {
      "upper": 44000.0,
      "middle": 43000.0,
      "lower": 42000.0
    },
    "stochastic": {
      "k": 65.2,
      "d": 62.8
    },
    "atr": 250.5,
    "adx": 28.5
  },
  "signals": {
    "trend": "BULLISH",
    "strength": 68,
    "momentum": "STRONG",
    "volatility": "MEDIUM",
    "recommendation": "BUY"
  },
  "price": {
    "current": 43250.5,
    "change24h": 850.3,
    "changePercent24h": 2.01,
    "volume24h": 15234567.89
  }
}
```

## 🔧 Настройка

Редактируйте `.env` файл:

```env
PORT=3015                      # Порт сервиса
REDIS_URL=redis://localhost:6379  # URL Redis
SCREENING_INTERVAL_MINUTES=15  # Интервал скрининга в минутах
CONCURRENT_JOBS=10             # Количество параллельных задач
LOG_LEVEL=info                 # Уровень логирования
```

## 📊 Мониторинг

Логи сохраняются в директории `logs/`:

- `logs/screener-{date}.log` - основные логи
- `logs/screener-error-{date}.log` - ошибки

## 🎯 Производительность

- **~500 символов** анализируются за **3-5 минут**
- **10 параллельных** задач одновременно
- Соблюдение **rate limits Binance** (1200 req/min)
- **Автоматический retry** при ошибках (3 попытки)

## 💡 Технические индикаторы

Скринер использует:

- **RSI** (14) - перекупленность/перепроданность
- **MACD** (12, 26, 9) - тренд и импульс
- **EMA** (20, 50, 200) - тренд
- **SMA** (20, 50, 200) - поддержка/сопротивление
- **Bollinger Bands** (20, 2) - волатильность
- **Stochastic** (14, 3) - моментум
- **ATR** (14) - волатильность
- **ADX** (14) - сила тренда

## 🚨 Troubleshooting

### Сервис не запускается

1. Проверьте, что Redis запущен: `docker ps | grep redis`
2. Проверьте порт 3015: `lsof -i :3015`
3. Проверьте логи: `tail -f logs/screener-error-*.log`

### Медленная обработка

1. Увеличьте `CONCURRENT_JOBS` в `.env`
2. Уменьшите количество символов (фильтруйте по объему)
3. Проверьте rate limits Binance

### Ошибки подключения к Binance

1. Проверьте доступность API: `curl https://api.binance.com/api/v3/ping`
2. Проверьте rate limits
3. Убедитесь, что IP не заблокирован

## 📚 Дополнительная информация

См. полную документацию в [README.md](./README.md)
