# News & Full GPT Integration - Summary

## ✅ Что добавлено

### 1. Автоматический AI режим при наличии ключа

**Ключевое изменение**: Теперь при наличии `OPENAI_API_KEY` все сообщения автоматически анализируются через GPT.

#### До:

```bash
# По умолчанию: keyword-only
# Нужно было явно указывать SENTIMENT_MODE=ai
```

#### После:

```bash
# Просто добавьте ключ:
OPENAI_API_KEY=sk-proj-...
# Автоматически: ВСЕ твиты, Reddit посты, Telegram сообщения → GPT
```

### 2. News Analyzer

Создан специализированный анализатор для крипто-новостей:

**Файлы:**

- `packages/ai/src/news-analyzer.ts` - GPT анализатор новостей
- `docs/migrations/crypto-news.sql` - таблица для хранения новостей с AI анализом

**Возможности:**

- Sentiment score (-1 to 1)
- Market impact (bullish/bearish/neutral/mixed)
- AI-generated summary
- Key points extraction
- Affected coins identification
- Confidence score

**API методы в scraper service:**

- `analyzeNews()` - анализ одной новости
- `analyzeNewsBatch()` - batch анализ новостей
- `storeNewsWithAnalysis()` - сохранение с AI результатами

### 3. Обновленная документация

Все документы обновлены с учетом нового поведения:

- `.env.example` - новые defaults
- `docs/OPENAI_INTEGRATION.md` - режимы работы
- Логирование теперь показывает режим работы

## 🎯 Режимы работы

### AI Mode (по умолчанию с ключом)

```bash
OPENAI_API_KEY=sk-proj-...
# Автоматически анализируются ВСЕ сообщения:
# ✅ Все Twitter твиты
# ✅ Все Reddit посты
# ✅ Все Telegram сообщения
# ✅ Все крипто-новости
```

**Логи:**

```
[INFO] OpenAI GPT sentiment analysis initialized:
  mode=ai, message="All messages will be analyzed with GPT"
```

### Hybrid Mode (экономия)

```bash
OPENAI_API_KEY=sk-proj-...
SENTIMENT_MODE=hybrid
AI_HIGH_ENGAGEMENT_THRESHOLD=50
# Только важные сообщения через GPT
```

### Keyword Mode (отключить GPT)

```bash
OPENAI_API_KEY=sk-proj-...
SENTIMENT_MODE=keyword
# или
OPENAI_SENTIMENT_ENABLED=false
```

## 📊 Что анализируется через GPT

| Источник | AI Mode | Hybrid Mode | Keyword Mode |
| -------- | ------- | ----------- | ------------ |
| Twitter  | ✅ Всё  | 🎯 Важное   | ❌ Keyword   |
| Reddit   | ✅ Всё  | 🎯 Важное   | ❌ Keyword   |
| Telegram | ✅ Всё  | 🎯 Важное   | ❌ Keyword   |
| News     | ✅ Всё  | ✅ Всё      | ❌ Нет       |

## 💰 Стоимость

### AI Mode (все через GPT):

- **1000 сообщений/день** = $0.60/день = **$18/месяц**
- **С кэшем (70%)**: **~$5.40/месяц**

### Hybrid Mode (30% через GPT):

- **1000 сообщений/день** = $0.18/день = **$5.40/месяц**
- **С кэшем (70%)**: **~$1.60/месяц**

### Рекомендация:

1. Начните с **AI mode** для максимальной точности
2. Мониторьте стоимость через `/api/social/ai/stats`
3. Переключитесь на **Hybrid** если бюджет ограничен
4. Используйте **Keyword** при тестировании без затрат

## 🚀 Как использовать

### Для социальных сетей (уже работает):

```bash
# Просто запустите с ключом:
OPENAI_API_KEY=sk-proj-... bun run dev:scraper

# Проверьте:
curl http://localhost:3018/api/social/sentiment/BTCUSDT
```

В логах увидите:

```
[INFO] Twitter sentiment analysis completed:
  symbol=BTCUSDT, tweets=75, score=0.42,
  gptUsed=75, keywordUsed=0  # ← Все через GPT!
```

### Для новостей (новый функционал):

```typescript
import { NewsInput } from "@aladdin/ai"

// Анализ одной новости
const news: NewsInput = {
  title: "Bitcoin ETF Approved by SEC",
  content: "The SEC has approved...",
  source: "CoinDesk",
  publishedAt: new Date(),
}

const analysis = await service.analyzeNews(news)

console.log(analysis)
// {
//   sentimentScore: 0.85,
//   marketImpact: "bullish",
//   summary: "SEC approval of Bitcoin ETF...",
//   keyPoints: ["Major regulatory milestone", ...],
//   affectedCoins: ["BTC", "ETH"],
//   confidence: 0.92
// }

// Сохранить в ClickHouse
await service.storeNewsWithAnalysis(
  { ...news, id: "news-123", url: "..." },
  analysis
)
```

## 📝 Структура данных News

### ClickHouse Table: `aladdin.crypto_news`

```sql
CREATE TABLE aladdin.crypto_news (
    id String,
    title String,
    content String,
    source String,
    url String,
    published_at DateTime,

    -- AI Analysis Results
    ai_sentiment_score Float32,      -- -1 to 1
    ai_market_impact String,         -- bullish/bearish/neutral/mixed
    ai_summary String,               -- GPT summary
    ai_key_points Array(String),     -- Key takeaways
    ai_affected_coins Array(String), -- Most affected coins
    ai_confidence Float32,           -- 0 to 1
    ai_analyzed_at DateTime,

    symbols Array(String),
    categories Array(String)
)
```

## 🔄 Миграция с предыдущей версии

### Если у вас уже есть `.env`:

```bash
# Было:
OPENAI_API_KEY=sk-...
SENTIMENT_MODE=hybrid  # Ручная настройка

# Теперь:
OPENAI_API_KEY=sk-...
# SENTIMENT_MODE автоматически = ai
# Все сообщения анализируются через GPT

# Хотите вернуть hybrid:
SENTIMENT_MODE=hybrid
```

### Проверка после обновления:

```bash
# 1. Перезапустите сервис
bun run dev:scraper

# 2. Проверьте логи
tail -f logs/scraper-*.log
# Должно быть: "All messages will be analyzed with GPT"

# 3. Проверьте статистику
curl http://localhost:3018/api/social/ai/stats
```

## ⚠️ Важные замечания

### Контроль бюджета:

1. **Мониторинг обязателен**:

   ```bash
   # Проверяйте регулярно:
   curl http://localhost:3018/api/social/ai/stats
   ```

2. **Rate Limiting**:

   ```bash
   AI_MAX_REQUESTS_PER_HOUR=100  # Жесткий лимит
   AI_MAX_REQUESTS_PER_MINUTE=10
   ```

3. **Кэширование**:
   ```bash
   AI_CACHE_TTL_HOURS=24  # Увеличьте для экономии
   ```

### Если стоимость высокая:

```bash
# Опция 1: Hybrid mode
SENTIMENT_MODE=hybrid
AI_HIGH_ENGAGEMENT_THRESHOLD=100

# Опция 2: Уменьшить rate limits
AI_MAX_REQUESTS_PER_HOUR=50

# Опция 3: Keyword only
SENTIMENT_MODE=keyword
```

## 📈 Метрики

### После запуска проверьте:

```bash
curl http://localhost:3018/api/social/ai/stats
```

**Ожидаемый результат в AI mode:**

```json
{
  "hybridStats": {
    "gptOnly": 850, // ← Должно быть ~95-100% от total
    "keywordOnly": 50,
    "totalAnalyses": 900
  },
  "gptStats": {
    "cacheHits": 630, // ← Должно расти со временем
    "cacheMisses": 270
  }
}
```

## ✅ Checklist

- [x] AI mode по умолчанию при наличии ключа
- [x] News Analyzer создан
- [x] ClickHouse таблица для новостей
- [x] API методы для анализа новостей
- [x] Обновлена документация
- [x] Обновлен .env.example
- [x] Логирование режима работы

## 🎉 Готово!

Теперь при наличии `OPENAI_API_KEY`:

- ✅ ВСЕ твиты анализируются через GPT
- ✅ ВСЕ Reddit посты анализируются через GPT
- ✅ ВСЕ Telegram сообщения анализируются через GPT
- ✅ ВСЕ новости анализируются через GPT
- ✅ Автоматическое кэширование снижает стоимость
- ✅ Rate limiting защищает от перерасхода
- ✅ Fallback на keyword при ошибках

**Просто добавьте ключ и всё заработает!** 🚀
