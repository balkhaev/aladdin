# Scripts

Утилиты и скрипты для разработки и тестирования.

## Доступные скрипты

### test-cache-performance.ts

Тестирует производительность Redis кэша в Analytics и Market Data сервисах.

**Использование:**

```bash
# Убедитесь что сервисы запущены
bun dev:analytics
bun dev:market-data

# В другом терминале запустите тест
bun scripts/test-cache-performance.ts
```

**Что тестируется:**

- Analytics Service:

  - Technical Indicators (RSI, MACD)
  - Market Overview
  - Combined Sentiment

- Market Data Service:
  - Aggregated Prices
  - Arbitrage Opportunities

**Ожидаемые результаты:**

- Speedup: 7-24x (первый запрос vs второй)
- Cache Hit Rate: 80-95%

**Пример вывода:**

```
╔═══════════════════════════════════════════════════════════╗
║           Redis Cache Performance Test                    ║
╚═══════════════════════════════════════════════════════════╝

=== Analytics Service ===

Testing: Technical Indicators (BTCUSDT)
URL: http://localhost:3014/api/analytics/indicators/BTCUSDT?indicators=RSI,MACD&timeframe=1h&limit=100
Request 1 (cache miss)...
  Time: 187.45ms
Request 2 (cache hit)...
  Time: 8.23ms
Speedup: 22.78x
✓ Cache working!

╔═══════════════════════════════════════════════════════════╗
║                     Summary                               ║
╚═══════════════════════════════════════════════════════════╝

Endpoint                                  1st Req    2nd Req    Speedup    Cache
──────────────────────────────────────────────────────────────────────────────────
Technical Indicators (BTCUSDT)            187.45ms     8.23ms     22.78x       ✓
Market Overview                           245.12ms    10.45ms     23.45x       ✓
Aggregated Price (BTCUSDT)                142.34ms     6.12ms     23.25x       ✓
──────────────────────────────────────────────────────────────────────────────────

Average Speedup: 23.16x
Cache Hit Rate: 100%

🎉 Excellent! Cache is working great!

Expected speedup: 7-24x
```

### apply-clickhouse-schema.ts

Применяет схему ClickHouse (если существует).

```bash
bun scripts/apply-clickhouse-schema.ts
```

## Создание нового скрипта

1. Создайте файл в директории `scripts/`
2. Добавьте shebang: `#!/usr/bin/env bun`
3. Сделайте исполняемым: `chmod +x scripts/your-script.ts`
4. Добавьте документацию в этот README

## Best Practices

- Используйте TypeScript
- Добавляйте комментарии и документацию
- Обрабатывайте ошибки gracefully
- Используйте цветной вывод для читаемости
- Выводите прогресс для длительных операций

