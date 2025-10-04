# Frontend: Social Sentiment Integration

## ✅ Что добавлено

### 1. **Новый хук: `use-social-sentiment.ts`**

Подключение к sentiment API (port 3018):

- `useSocialSentiment(symbol)` - sentiment для одного символа
- `useBatchSocialSentiment(symbols)` - batch анализ
- `useSentimentHistory(symbol)` - история sentiment
- `useSentimentServicesHealth()` - статус Telegram/Twitter сервисов

### 2. **Компоненты**

#### `SocialSentimentCard`

Полная карточка с детальной информацией:

- Overall sentiment score (-1 to 1)
- Confidence и Strength
- Breakdown по Telegram и Twitter
- Bullish/Bearish/Neutral счетчики

#### `SocialSentimentCompact`

Компактная версия для dashboard:

- Показывает 4-6 символов
- Telegram и Twitter scores
- Overall sentiment

### 3. **Страницы**

#### `/sentiment` - Новая страница

- **Overview tab**: Sentiment для популярных пар
- **Detail tab**: Детальный анализ выбранного символа
- Статус Telegram и Twitter сервисов
- Информация о источниках данных

#### `/market` - Обновлена

Добавлена секция "Social Sentiment" на вкладке Overview

### 4. **Навигация**

В sidebar добавлен пункт "Sentiment" в разделе "Аналитика"

## 🚀 Запуск

```bash
# В отдельных терминалах:

# 1. Запустить sentiment service
cd apps/sentiment
bun dev

# 2. Запустить telega (Telegram)
cd apps/telega
bun dev

# 3. Запустить twity (Twitter)
cd apps/twity
bun dev

# 4. Запустить frontend
cd apps/web
bun dev
```

Frontend будет доступен на `http://localhost:3001`

## 📊 Структура данных

### SocialSentimentAnalysis

```typescript
{
  symbol: "BTCUSDT",
  overall: 0.65,        // -1 (bearish) to 1 (bullish)
  telegram: {
    score: 0.8,
    bullish: 12,
    bearish: 3,
    signals: 15
  },
  twitter: {
    score: 0.5,
    positive: 25,
    negative: 15,
    neutral: 10,
    tweets: 50
  },
  confidence: 0.75,     // 0 to 1
  timestamp: "2025-10-04T..."
}
```

## 🎨 UI/UX Features

### Цветовая индикация

- **Зеленый** - Bullish (score > 0.3)
- **Красный** - Bearish (score < -0.3)
- **Серый** - Neutral (-0.3 to 0.3)

### Strength indicator

- **STRONG** - |score| > 0.7
- **MODERATE** - |score| > 0.4
- **WEAK** - |score| <= 0.4

### Real-time updates

- Данные обновляются каждую минуту
- WebSocket подключение для real-time (если доступно)

## 🔧 Конфигурация

В файле `use-social-sentiment.ts`:

```typescript
const SENTIMENT_API_URL = "http://localhost:3018"
```

Если sentiment service на другом порту, измените URL.

## 📱 Responsive Design

Компоненты адаптивны и работают на:

- Desktop (1920x1080+)
- Laptop (1366x768+)
- Tablet (768px+)
- Mobile (320px+)

## 🐛 Troubleshooting

### Нет данных на фронтенде

1. Проверьте, запущен ли sentiment service:

```bash
curl http://localhost:3018/health
```

2. Проверьте CORS (если нужно):

```bash
curl -H "Origin: http://localhost:3001" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     http://localhost:3018/api/sentiment/BTCUSDT
```

3. Проверьте данные напрямую:

```bash
curl http://localhost:3018/api/sentiment/BTCUSDT
```

### Services не работают

Проверьте статус на странице `/sentiment`:

- Зеленая галочка - ОК
- Красный крест - сервис недоступен

### Ошибки в консоли

Откройте DevTools (F12) и проверьте:

- Network tab - запросы к API
- Console tab - JavaScript ошибки

## 📈 Дальнейшие улучшения

1. **Historical charts** - графики изменения sentiment во времени
2. **Alerts** - уведомления о резких изменениях
3. **WebSocket integration** - real-time обновления через WS
4. **More sources** - Reddit, Discord, новостные сайты
5. **Sentiment correlation** - корреляция с движением цены
6. **Export data** - экспорт данных в CSV/JSON

## 🔗 API Endpoints (используемые фронтендом)

- `GET /api/sentiment/:symbol` - Sentiment для символа
- `GET /api/sentiment/:symbol/history` - История sentiment
- `POST /api/sentiment/analyze-batch` - Batch анализ
- `GET /api/sentiment/services/health` - Статус сервисов

## 📝 Примечания

- **Sentiment service** должен быть запущен отдельно (не через API Gateway)
- Данные кэшируются на 30-60 секунд для снижения нагрузки
- Telegram данные обновляются в real-time через NATS
- Twitter данные подгружаются по запросу через HTTP API

## 🎯 Готово к использованию!

Откройте `http://localhost:3001/sentiment` и начните отслеживать социальный sentiment в реальном времени! 🚀
