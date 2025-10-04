# Market Data Scripts

Скрипты для работы с рыночными данными.

---

## 📥 Import Historical Candles

Скрипт для импорта исторических свечей с Binance API в ClickHouse.

### Использование

```bash
cd apps/market-data

# Импорт BTCUSDT 15m за последние 7 дней (по умолчанию)
bun run scripts/import-historical-candles.ts

# Импорт конкретного символа и таймфрейма
bun run scripts/import-historical-candles.ts ETHUSDT 1h 30

# Импорт за последние 2 дня
bun run scripts/import-historical-candles.ts BTCUSDT 15m 2
```

### Параметры

1. **symbol** - торговая пара (по умолчанию: `BTCUSDT`)
2. **timeframe** - таймфрейм свечей (по умолчанию: `15m`)
   - Доступные: `1m`, `5m`, `15m`, `30m`, `1h`, `4h`, `1d`
3. **days** - количество дней для импорта (по умолчанию: `7`)

### Что делает скрипт

1. **Подключается** к ClickHouse
2. **Вычисляет** временные рамки на основе параметров
3. **Загружает** свечи с Binance API порциями (до 1000 свечей за запрос)
4. **Фильтрует** пустые свечи (volume = 0 или trades = 0)
5. **Сохраняет** в таблицу `aladdin.candles`
6. **Показывает статистику** после завершения

### Особенности

- ✅ Автоматическая пакетная загрузка для больших периодов
- ✅ Фильтрация пустых свечей
- ✅ Обработка ошибок с продолжением работы
- ✅ Задержка 200ms между запросами (безопасно для Binance API)
- ✅ Подробный вывод прогресса

### Ограничения Binance API

- 🔸 **1200 запросов/минуту** (weight limit)
- 🔸 **1000 свечей** максимум за один запрос
- 🔸 Скрипт использует задержку **200ms** между запросами

### Примеры

#### Заполнить пробел в данных за последние 3 дня

```bash
bun run scripts/import-historical-candles.ts BTCUSDT 15m 3
```

#### Загрузить исторические данные по часовым свечам за месяц

```bash
bun run scripts/import-historical-candles.ts BTCUSDT 1h 30
```

#### Импорт для нескольких символов

```bash
bun run scripts/import-historical-candles.ts BTCUSDT 15m 7
bun run scripts/import-historical-candles.ts ETHUSDT 15m 7
bun run scripts/import-historical-candles.ts BNBUSDT 15m 7
```

### Время выполнения

| Период  | Таймфрейм | Примерное время |
| ------- | --------- | --------------- |
| 7 дней  | 15m       | ~1-2 минуты     |
| 7 дней  | 1h        | ~10 секунд      |
| 30 дней | 15m       | ~5-10 минут     |
| 30 дней | 1h        | ~30 секунд      |

### Требования

1. **ClickHouse** должен быть запущен
2. **Binance API** доступен
3. **Переменные окружения** в `.env`:
   ```env
   CLICKHOUSE_HOST=your-clickhouse-host
   CLICKHOUSE_PORT=8123
   CLICKHOUSE_USER=default
   CLICKHOUSE_PASSWORD=your-password
   CLICKHOUSE_DATABASE=aladdin
   ```

### Устранение проблем

#### Ошибка "Binance API error"

- Проверьте доступность Binance API
- Убедитесь, что символ существует и правильно написан

#### Ошибка подключения к ClickHouse

- Проверьте что ClickHouse запущен
- Проверьте переменные окружения
- Убедитесь, что таблица `candles` существует

#### Пустые данные

- Некоторые символы могут не иметь данных за старые периоды
- Скрипт автоматически пропускает пустые свечи
