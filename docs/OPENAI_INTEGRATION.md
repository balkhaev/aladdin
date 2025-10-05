# OpenAI GPT-5 Integration

Интеграция OpenAI GPT-5 для улучшения sentiment analysis в крипто-трейдинг платформе.

## Обзор

Система использует гибридный подход, комбинируя быстрый keyword-based анализ с точным GPT-5 анализом:

- **Keyword-based**: Быстрый, бесплатный, всегда доступен
- **GPT-5**: Точный, понимает контекст, обнаруживает сарказм
- **Hybrid**: Автоматически выбирает лучший метод на основе engagement и уверенности

## Архитектура

### Пакеты

#### @aladdin/ai

Централизованный пакет для работы с OpenAI:

- `OpenAIClientWrapper` - клиент с rate limiting и retry logic
- `GPTSentimentAnalyzer` - анализ sentiment через GPT с batch processing
- `AICacheService` - кэширование результатов на 24 часа
- `HybridSentimentAnalyzer` - гибридная логика выбора keyword/GPT

### Оптимизация бюджета

GPT-5 используется выборочно для:

1. **Высокий engagement** - твиты/посты с >50 лайков/upvotes
2. **Низкая уверенность** - когда keyword confidence < 0.3
3. **Нейтральный score** - когда keyword score близок к 0

Дополнительная оптимизация:

- **Batch processing** - до 10 текстов в одном запросе
- **Кэширование** - результаты сохраняются на 24 часа
- **Rate limiting** - максимум 100 запросов/час
- **Fallback** - откат на keyword-based при ошибках

## Конфигурация

### Environment Variables

Добавьте в `.env` файл сервиса (например, `apps/scraper/.env`):

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-proj-your-api-key-here
OPENAI_MODEL=gpt-4o  # Will be gpt-5 when available
OPENAI_SENTIMENT_ENABLED=true

# Sentiment Mode
# - keyword: только keyword-based (бесплатно)
# - ai: только GPT (дорого, максимальная точность)
# - hybrid: автоматический выбор (рекомендуется)
SENTIMENT_MODE=hybrid

# AI Configuration
AI_CACHE_TTL_HOURS=24
AI_MAX_BATCH_SIZE=10
AI_MAX_REQUESTS_PER_HOUR=100
AI_MAX_REQUESTS_PER_MINUTE=10

# Hybrid Analyzer Thresholds
AI_HIGH_ENGAGEMENT_THRESHOLD=50
AI_LOW_CONFIDENCE_THRESHOLD=0.3
```

### Режимы работы

#### 1. AI-only (по умолчанию с ключом)

**При наличии OPENAI_API_KEY автоматически включается анализ всех сообщений через GPT:**

```bash
OPENAI_API_KEY=sk-...
# SENTIMENT_MODE автоматически = ai
# Все твиты, Reddit посты, Telegram сообщения анализируются GPT
```

#### 2. Hybrid (экономия бюджета)

**Выборочное использование GPT только для важных сообщений:**

```bash
OPENAI_API_KEY=sk-...
SENTIMENT_MODE=hybrid
AI_HIGH_ENGAGEMENT_THRESHOLD=50
AI_LOW_CONFIDENCE_THRESHOLD=0.3
# GPT используется только для high-engagement контента
```

#### 3. Keyword-only (отключить GPT)

**Отключить GPT даже при наличии ключа:**

```bash
OPENAI_API_KEY=sk-...
SENTIMENT_MODE=keyword
# или
OPENAI_SENTIMENT_ENABLED=false
```

#### 4. Без ключа (keyword-only по умолчанию)

```bash
# Без OPENAI_API_KEY
# Автоматически использует только keyword анализ
```

## API Endpoints

### Sentiment Analysis

Существующие endpoints автоматически используют hybrid analyzer:

```bash
# Анализ sentiment для символа
GET /api/social/sentiment/BTCUSDT

# Batch анализ
POST /api/social/sentiment/analyze-batch
{
  "symbols": ["BTCUSDT", "ETHUSDT"]
}
```

### AI Statistics

Новые endpoints для мониторинга:

```bash
# Получить статистику AI
GET /api/social/ai/stats
```

Response:

```json
{
  "success": true,
  "data": {
    "enabled": true,
    "gptAvailable": true,
    "hybridStats": {
      "totalAnalyses": 1250,
      "keywordOnly": 890,
      "gptOnly": 360,
      "gptFallbacks": 12
    },
    "gptStats": {
      "totalRequests": 45,
      "successfulRequests": 44,
      "failedRequests": 1,
      "cacheHits": 315,
      "cacheMisses": 45
    },
    "openAIStats": {
      "totalRequests": 45,
      "requestsLastHour": 12,
      "requestsLastMinute": 2
    },
    "cacheStats": {
      "size": 450,
      "oldestEntry": 1696507200000,
      "newestEntry": 1696593600000
    }
  }
}
```

```bash
# Очистить AI cache
POST /api/social/ai/cache/clear

# Удалить expired entries
POST /api/social/ai/cache/cleanup
```

## Стоимость

### Примерные расчеты (GPT-4o)

**Input**: $2.50 / 1M tokens  
**Output**: $10.00 / 1M tokens

Средний твит/пост: ~30 tokens input, ~50 tokens output = $0.0006

#### AI mode (все сообщения через GPT):

- 1000 твитов/день = 1000 GPT calls = $0.60/день = **$18/месяц**
- С кэшем (70% hit rate): **~$5.40/месяц**

#### Hybrid mode (30% через GPT):

- 1000 твитов/день = 300 GPT calls = $0.18/день = **$5.40/месяц**
- С кэшем (70% hit rate): **~$1.60/месяц**

**Рекомендация**: Начните с AI mode, затем переключитесь на Hybrid если стоимость высокая.

### Оптимизация стоимости

1. **Переключиться на Hybrid mode**

   ```bash
   SENTIMENT_MODE=hybrid
   AI_HIGH_ENGAGEMENT_THRESHOLD=100  # Только очень популярные
   AI_LOW_CONFIDENCE_THRESHOLD=0.2   # Только очень неуверенные
   ```

2. **Уменьшить rate limits**

   ```bash
   AI_MAX_REQUESTS_PER_HOUR=50
   AI_MAX_REQUESTS_PER_MINUTE=5
   ```

3. **Увеличить кэш TTL**

   ```bash
   AI_CACHE_TTL_HOURS=48
   ```

4. **Переключиться на keyword-only**

   ```bash
   SENTIMENT_MODE=keyword  # Отключить GPT полностью
   ```

## Мониторинг

### Логирование

Сервис логирует:

- Использование GPT vs keyword для каждого анализа
- Cache hit rate
- Rate limit hits
- Ошибки API

Пример лога:

```
[INFO] Twitter sentiment analysis completed:
  symbol=BTCUSDT, tweets=75, score=0.42,
  gptUsed=15, keywordUsed=60
```

### Метрики

Используйте endpoint `/api/social/ai/stats` для:

- Мониторинга cache hit rate (должен быть >70%)
- Отслеживания GPT fallback rate (должен быть <5%)
- Проверки rate limit usage
- Оценки стоимости (requests \* avg cost)

## Troubleshooting

### GPT не используется

Проверьте:

1. `OPENAI_API_KEY` установлен
2. `OPENAI_SENTIMENT_ENABLED=true`
3. Engagement достаточно высокий (`AI_HIGH_ENGAGEMENT_THRESHOLD`)
4. Rate limit не превышен (см. `/api/social/ai/stats`)

### Высокая стоимость

Решения:

1. Увеличить thresholds (меньше GPT calls)
2. Уменьшить `AI_MAX_REQUESTS_PER_HOUR`
3. Переключиться в `keyword` mode
4. Проверить cache hit rate

### Rate limit errors

Решения:

1. Увеличить `AI_MAX_REQUESTS_PER_HOUR`
2. Уменьшить `AI_MAX_BATCH_SIZE`
3. Добавить задержку между запросами

## Развитие

### Будущие улучшения

1. **Fine-tuning** - обучить модель на крипто-данных
2. **Sentiment streaming** - real-time анализ новых твитов
3. **Multi-language** - поддержка русского, китайского
4. **Entity recognition** - извлечение упомянутых монет/бирж
5. **Trend detection** - обнаружение viral постов

### Интеграция в другие сервисы

Пакет `@aladdin/ai` можно использовать в:

- **Analytics** - объяснение трендов и аномалий
- **Trading** - генерация торговых рекомендаций
- **Portfolio** - персонализированные инсайты
- **ML Service** - feature engineering

## Примеры использования

### В коде (TypeScript)

```typescript
import {
  OpenAIClientWrapper,
  AICacheService,
  GPTSentimentAnalyzer,
} from "@aladdin/ai"

// Инициализация
const client = new OpenAIClientWrapper(
  {
    apiKey: process.env.OPENAI_API_KEY!,
    model: "gpt-4o",
  },
  logger
)

const cache = new AICacheService(logger, 24)
const analyzer = new GPTSentimentAnalyzer(client, cache, logger)

// Анализ одного текста
const result = await analyzer.analyzeSingle("Bitcoin to the moon! 🚀")
console.log(result)
// { score: 0.85, confidence: 0.92, positive: 2, negative: 0, ... }

// Batch анализ
const results = await analyzer.analyzeBatch([
  "BTC crashing hard",
  "ETH looking bullish",
  "Neutral market conditions",
])
```

### Тестирование

```bash
# Тестирование с реальным API
OPENAI_API_KEY=sk-... SENTIMENT_MODE=ai bun test

# Тестирование без API (keyword-only)
SENTIMENT_MODE=keyword bun test
```

## Безопасность

⚠️ **Важно**:

- Никогда не коммитить `OPENAI_API_KEY` в git
- Использовать `.env` файлы (добавлены в `.gitignore`)
- Ротация API ключей каждые 90 дней
- Мониторинг usage через OpenAI dashboard

## Поддержка

При проблемах:

1. Проверить логи в `/logs/scraper-*.log`
2. Проверить `/api/social/ai/stats`
3. Проверить OpenAI dashboard для quota/billing
4. Создать issue в репозитории
