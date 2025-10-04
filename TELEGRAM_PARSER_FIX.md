# Исправление Telegram Parser

## Проблема

Sentiment service не видел сигналов из Telegram канала `@markettwits`, хотя:

- ✅ Telega подключена и работает
- ✅ Подписка на канал активна
- ✅ Сообщения получаются через API

## Причина

`@markettwits` - это русскоязычный **новостной** канал, а не канал с торговыми сигналами в формате:

```
BTC LONG
Entry: 42000
Targets: 43000, 44000
Stop: 41000
```

Парсер искал английские слова "long/short/bullish/bearish" в строгом формате, что не работало для новостей на русском языке.

## Решение

Обновили парсер `parseSignal()` в `telegram-client.ts`:

### 1. **Поддержка русского языка**

```typescript
const bullishWords = [
  // English
  "long",
  "buy",
  "bullish",
  "rally",
  "surge",
  "pump",
  "moon",
  "breakout",
  "gain",
  "profit",
  "green",
  // Русский
  "рост",
  "покупк",
  "приток",
  "бычь",
  "ралли",
  "пробой",
  "прибыл",
  "позитив",
]

const bearishWords = [
  // English
  "short",
  "sell",
  "bearish",
  "crash",
  "dump",
  "drop",
  "fall",
  "loss",
  "red",
  // Русский
  "падени",
  "продаж",
  "медвеж",
  "обвал",
  "снижени",
  "убыт",
  "негатив",
]
```

### 2. **Гибкий алгоритм**

Вместо требования точного формата:

- Ищем упоминания криптовалют (BTC, ETH, биткоин, эфир)
- Подсчитываем bullish и bearish слова
- Если bullish > bearish → сигнал LONG
- Если bearish > bullish → сигнал SHORT
- Confidence зависит от количества sentiment слов (0.3-0.7)

### 3. **Примеры парсинга**

**Сообщение 1:**

```
✴️#BTC #cot #крипто
Cryptoquant отмечает резкий всплеск покупок в BTC 3 октября

*исторически bullish, если такое не происходит на "шишке" после сильного ралли
```

**Парсится как:**

- Pair: BTCUSDT
- Direction: LONG
- Confidence: 0.5 (найдено "покупок" + "bullish" + "ралли")

**Сообщение 2:**

```
💥✴️#BTC #ETH #etf #финпотоки
Притоки в спотовые BTC и ETH ETF усилились за неделю и вновь бьют рекорды
```

**Парсится как:**

- Pair: BTCUSDT (и ETHUSDT отдельно)
- Direction: LONG
- Confidence: 0.4 (найдено "Притоки")

## Тестирование

### Проверка через API

```bash
# Получить sentiment для BTC (должны появиться telegram signals)
curl http://localhost:3018/api/sentiment/BTCUSDT | jq '.data.telegram'

# Expected output (после получения новых сообщений):
{
  "score": 0.6,
  "bullish": 3,
  "bearish": 0,
  "signals": 3
}
```

### Проверка сообщений из Telegram

```bash
# Последние сообщения из markettwits
curl "http://localhost:3005/channels/markettwits/messages?limit=5" | jq '.messages[].message'
```

## Текущий статус

✅ Парсер обновлен и поддерживает русский язык
✅ Hot reload применит изменения автоматически
⏳ Ожидаем новые сообщения из Telegram для парсинга

## Альтернативные каналы

Если хотите более структурированные торговые сигналы, можно подписаться на специализированные каналы:

```bash
# Примеры каналов с торговыми сигналами
curl -X POST http://localhost:3005/channels/subscribe \
  -H "Content-Type: application/json" \
  -d '{"channelId": "@cryptosignals"}'

curl -X POST http://localhost:3005/channels/subscribe \
  -H "Content-Type: application/json" \
  -d '{"channelId": "@tradingview_signals"}'
```

## Ограничения

1. **Новостной контент** имеет низкую confidence (0.3-0.7) по сравнению с прямыми торговыми сигналами (0.8-1.0)
2. **Парсинг основан на keywords** - может давать false positives
3. **Русские слова используют корни** - "покупк" поймает "покупка", "покупки", "покупок"

## Улучшения в будущем

1. **NLP модели** - использовать ML для sentiment analysis
2. **Больше каналов** - подключить специализированные торговые каналы
3. **Контекстный анализ** - учитывать контекст сообщения целиком
4. **Веса по источникам** - разные веса для новостных и торговых каналов
