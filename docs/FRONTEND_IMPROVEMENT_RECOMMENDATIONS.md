# Рекомендации по дальнейшему улучшению фронтенда

## Анализ от: 5 октября 2025

---

## 🎯 Найденные паттерны дублирования и возможности улучшения

### 1. **Дублирование форматирования в таблицах** 🔴 ВЫСОКИЙ ПРИОРИТЕТ

#### Проблема:

В 6+ компонентах дублируются одни и те же функции форматирования:

**Компоненты с дублированием:**

- `positions-table-enhanced.tsx` (строки 45-64)
- Множество других таблиц

```typescript
// Дублируется в каждой таблице:
const formatCurrency = (value: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)

const formatPercent = (value: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100)

const getPnlColor = (pnl: number) => {
  if (pnl > 0) return "text-green-600"
  if (pnl < 0) return "text-red-600"
  return "text-muted-foreground"
}
```

#### Решение:

✅ Использовать уже созданные функции из `lib/formatters.ts`:

- `formatCurrency()`
- `formatPercent()`
- `getPnLColor()`

**Файлы для рефакторинга:**

- `components/portfolio/positions-table-enhanced.tsx`
- `components/futures-positions-table.tsx`
- `components/orders-table.tsx`
- `components/portfolio/correlations-table.tsx`
- И другие таблицы

**Ожидаемое сокращение:** ~150-200 строк дублированного кода

---

### 2. **API fetching паттерны** 🟡 СРЕДНИЙ ПРИОРИТЕТ

#### Проблема:

В хуках дублируется логика API вызовов:

```typescript
// Повторяется в ~15 хуках:
const response = await fetch(`${API_BASE_URL}/api/analytics/...`, {
  credentials: "include",
})

if (!response.ok) {
  throw new Error("Failed to fetch ...")
}

const result = await response.json()
return result.data
```

#### Решение:

Создать универсальную функцию `lib/api/client.ts` (уже есть, но не везде используется):

```typescript
// lib/api/client.ts (расширить существующий)
export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    credentials: "include",
    ...options,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.message || `API Error: ${response.status}`)
  }

  const result = await response.json()
  return result.data
}

// Использование:
export function useSentiment(symbol: string) {
  return useQuery({
    queryKey: ["sentiment", symbol],
    queryFn: () =>
      apiRequest<CompositeSentiment>(`/api/analytics/sentiment/${symbol}`),
  })
}
```

**Файлы для рефакторинга:**

- Все хуки в `hooks/`
- Особенно: `use-sentiment.ts`, `use-indicators.ts`, `use-market-overview.ts`, и др.

**Ожидаемое сокращение:** ~300-400 строк кода

---

### 3. **Loading states в Dialog/Form компонентах** 🟢 НИЗКИЙ ПРИОРИТЕТ

#### Проблема:

Каждый Dialog имеет свою логику управления состоянием открытия/закрытия:

```typescript
// Повторяется в 10+ диалогах:
const [open, setOpen] = useState(false)

// В компоненте:
;<Dialog onOpenChange={setOpen} open={open}>
  <DialogTrigger asChild>
    <Button onClick={() => setOpen(true)}>...</Button>
  </DialogTrigger>
  <DialogContent>
    {/* форма */}
    {mutation.isPending && <Loader />}
  </DialogContent>
</Dialog>
```

#### Решение:

Создать хук `useDialog`:

```typescript
// hooks/use-dialog.ts
export function useDialog() {
  const [open, setOpen] = useState(false)

  const openDialog = useCallback(() => setOpen(true), [])
  const closeDialog = useCallback(() => setOpen(false), [])
  const toggleDialog = useCallback(() => setOpen((prev) => !prev), [])

  return {
    open,
    openDialog,
    closeDialog,
    toggleDialog,
    dialogProps: {
      open,
      onOpenChange: setOpen,
    },
  }
}

// Использование:
const { dialogProps, closeDialog } = useDialog()

;<Dialog {...dialogProps}>{/* content */}</Dialog>
```

**Файлы для рефакторинга:**

- `add-position-dialog.tsx`
- `optimization-dialog.tsx`
- `create-portfolio-dialog.tsx`
- `edit-position-dialog.tsx`
- `rebalancing-dialog.tsx`
- `add-exchange-credential-dialog.tsx`

**Ожидаемое сокращение:** ~50-100 строк кода

---

### 4. **WebSocket подключения** 🔴 ВЫСОКИЙ ПРИОРИТЕТ

#### Проблема:

WebSocket логика дублируется в нескольких хуках.

**Компоненты с WebSocket:**

- `use-websocket.ts` - базовый хук
- `use-risk-ws.ts` - риск метрики
- `use-orders-ws.ts` - ордера
- `use-positions-ws.ts` - позиции
- `use-candles-ws.ts` - свечи
- `use-order-book-ws.ts` - order book
- `use-recent-trades-ws.ts` - сделки
- `use-market-data-ws.ts` - рыночные данные

#### Решение:

Создать переиспользуемую фабрику WebSocket хуков:

```typescript
// lib/websocket-factory.ts
export function createWebSocketHook<T>(
  topic: string,
  options?: {
    transform?: (data: unknown) => T
    onMessage?: (data: T) => void
  }
) {
  return function useTypedWebSocket(
    params?: Record<string, string>,
    enabled = true
  ) {
    const [data, setData] = useState<T | null>(null)
    const [isConnected, setIsConnected] = useState(false)

    useEffect(() => {
      if (!enabled) return

      const ws = connectWebSocket(topic, params)

      ws.on("message", (raw) => {
        const transformed = options?.transform?.(raw) ?? (raw as T)
        setData(transformed)
        options?.onMessage?.(transformed)
      })

      ws.on("connect", () => setIsConnected(true))
      ws.on("disconnect", () => setIsConnected(false))

      return () => ws.disconnect()
    }, [enabled, JSON.stringify(params)])

    return { data, isConnected }
  }
}

// Использование:
export const useOrdersWebSocket = createWebSocketHook<Order[]>("orders", {
  transform: (data) => data as Order[],
})
```

**Ожидаемое сокращение:** ~200-300 строк кода

---

### 5. **Компоненты Badge для статусов** 🟡 СРЕДНИЙ ПРИОРИТЕТ

#### Проблема:

Логика отображения статусов дублируется:

```typescript
// Повторяется в 5+ местах:
const getStatusBadge = (status: string) => {
  switch (status) {
    case "active":
      return <Badge variant="default">Active</Badge>
    case "pending":
      return <Badge variant="secondary">Pending</Badge>
    case "cancelled":
      return <Badge variant="destructive">Cancelled</Badge>
    // ...
  }
}
```

#### Решение:

Создать универсальный компонент `StatusBadge`:

```typescript
// components/ui/status-badge.tsx
type StatusConfig = {
  variant: "default" | "secondary" | "destructive" | "outline"
  label: string
  icon?: React.ReactNode
}

const STATUS_CONFIGS: Record<string, StatusConfig> = {
  active: { variant: "default", label: "Active" },
  pending: { variant: "secondary", label: "Pending" },
  cancelled: { variant: "destructive", label: "Cancelled" },
  // ...
}

export function StatusBadge({
  status,
  config,
}: {
  status: string
  config?: Partial<StatusConfig>
}) {
  const defaultConfig =
    STATUS_CONFIGS[status.toLowerCase()] || STATUS_CONFIGS.default
  const finalConfig = { ...defaultConfig, ...config }

  return (
    <Badge variant={finalConfig.variant}>
      {finalConfig.icon}
      {finalConfig.label}
    </Badge>
  )
}
```

**Файлы для использования:**

- `orders-table.tsx`
- `futures-positions-table.tsx`
- `executor-stats-card.tsx`
- И другие компоненты со статусами

**Ожидаемое сокращение:** ~80-100 строк кода

---

### 6. **Query keys константы** 🟢 НИЗКИЙ ПРИОРИТЕТ

#### Проблема:

Query keys для React Query разбросаны по всем хукам:

```typescript
// В каждом хуке свой query key:
queryKey: ["sentiment", symbol],
queryKey: ["market-overview"],
queryKey: ["portfolio-summary", portfolioId],
// ...
```

#### Решение:

Централизовать query keys:

```typescript
// lib/query-keys.ts
export const queryKeys = {
  sentiment: {
    all: ['sentiment'] as const,
    detail: (symbol: string) => [...queryKeys.sentiment.all, symbol] as const,
    batch: (symbols: string[]) => [...queryKeys.sentiment.all, 'batch', symbols] as const,
  },
  portfolio: {
    all: ['portfolio'] as const,
    detail: (id: string) => [...queryKeys.portfolio.all, id] as const,
    summary: (id: string, params?: object) => [...queryKeys.portfolio.detail(id), 'summary', params] as const,
  },
  market: {
    overview: ['market', 'overview'] as const,
    ticker: (symbol: string) => ['market', 'ticker', symbol] as const,
  },
} as const;

// Использование:
queryKey: queryKeys.sentiment.detail(symbol),
```

**Преимущества:**

- Типобезопасность
- Централизованное управление
- Легче инвалидировать связанные запросы
- Автокомплит в IDE

**Ожидаемое улучшение:** Лучшая поддерживаемость, нет дублирования строк

---

### 7. **Конфигурация polling/refetch интервалов** 🟡 СРЕДНИЙ ПРИОРИТЕТ

#### Проблема:

Интервалы обновления разбросаны по хукам:

```typescript
// Разные значения в разных хуках:
refetchInterval: 120_000, // 2 minutes
refetchInterval: 60_000,  // 1 minute
refetchInterval: 30_000,  // 30 seconds
// ...
```

#### Решение:

Централизовать конфигурацию:

```typescript
// lib/query-config.ts
export const QUERY_CONFIG = {
  refetchIntervals: {
    realtime: 5_000,      // 5 seconds - для real-time данных
    fast: 30_000,         // 30 seconds - для быстро меняющихся данных
    normal: 60_000,       // 1 minute - обычное обновление
    slow: 300_000,        // 5 minutes - медленно меняющиеся данные
    verySlow: 600_000,    // 10 minutes - редко меняющиеся данные
  },
  staleTime: {
    realtime: 0,
    fast: 15_000,
    normal: 30_000,
    slow: 120_000,
  },
} as const;

// Использование:
refetchInterval: QUERY_CONFIG.refetchIntervals.normal,
staleTime: QUERY_CONFIG.staleTime.normal,
```

**Преимущества:**

- Единая точка настройки
- Легко настраивать для разных окружений (dev/prod)
- Консистентность поведения

---

### 8. **Table column configurations** 🟡 СРЕДНИЙ ПРИОРИТЕТ

#### Проблема:

Конфигурация колонок таблиц дублируется:

```typescript
// В каждой таблице повторяется:
<TableHeader>
  <TableRow>
    <TableHead>Column 1</TableHead>
    <TableHead className="text-right">Column 2</TableHead>
    // ...
  </TableRow>
</TableHeader>
```

#### Решение:

Создать data-driven таблицы:

```typescript
// components/ui/data-table.tsx
type ColumnDef<T> = {
  key: keyof T
  header: string
  align?: "left" | "right" | "center"
  render?: (value: T[keyof T], row: T) => React.ReactNode
  sortable?: boolean
}

export function DataTable<T>({
  data,
  columns,
  onRowClick,
}: {
  data: T[]
  columns: ColumnDef<T>[]
  onRowClick?: (row: T) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((col) => (
            <TableHead
              key={String(col.key)}
              className={col.align ? `text-${col.align}` : ""}
            >
              {col.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row, i) => (
          <TableRow key={i} onClick={() => onRowClick?.(row)}>
            {columns.map((col) => (
              <TableCell key={String(col.key)}>
                {col.render
                  ? col.render(row[col.key], row)
                  : String(row[col.key])}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

// Использование:
const columns: ColumnDef<Order>[] = [
  { key: "symbol", header: "Символ" },
  {
    key: "price",
    header: "Цена",
    align: "right",
    render: (price) => formatCurrency(price as number),
  },
  // ...
]

;<DataTable data={orders} columns={columns} />
```

**Преимущества:**

- Декларативный подход
- Легко добавлять сортировку, фильтрацию
- Меньше JSX разметки
- Переиспользуемость

---

## 📊 Суммарная оценка улучшений

| Приоритет  | Улучшение                    | Строк кода | Сложность | Влияние |
| ---------- | ---------------------------- | ---------- | --------- | ------- |
| 🔴 Высокий | 1. Форматирование в таблицах | ~150-200   | Низкая    | Высокое |
| 🔴 Высокий | 4. WebSocket фабрика         | ~200-300   | Средняя   | Высокое |
| 🟡 Средний | 2. API fetching              | ~300-400   | Низкая    | Среднее |
| 🟡 Средний | 5. StatusBadge               | ~80-100    | Низкая    | Среднее |
| 🟡 Средний | 7. Query config              | ~50        | Низкая    | Среднее |
| 🟡 Средний | 8. DataTable                 | ~100-150   | Средняя   | Высокое |
| 🟢 Низкий  | 3. useDialog hook            | ~50-100    | Низкая    | Низкое  |
| 🟢 Низкий  | 6. Query keys                | ~0         | Низкая    | Среднее |

**Итого потенциальное сокращение:** ~930-1,350 строк кода  
**Время реализации:** 4-6 часов работы  
**Улучшение поддерживаемости:** Значительное

---

## 🎯 Рекомендуемый порядок реализации

### Фаза 1 (1-2 часа) - Быстрые победы

1. ✅ Рефакторинг форматирования в таблицах
2. ✅ Создать StatusBadge компонент
3. ✅ Централизовать query config

### Фаза 2 (2-3 часа) - Средняя сложность

4. ✅ Улучшить API client и рефакторить хуки
5. ✅ Создать query keys константы
6. ✅ Создать useDialog hook

### Фаза 3 (2-3 часа) - Высокая сложность

7. ✅ WebSocket фабрика
8. ✅ DataTable компонент

---

## 🔧 Дополнительные архитектурные улучшения

### 9. **Feature-based organization**

Рассмотреть переход от разделения по типу файла к разделению по функциям:

```
❌ Текущая структура:
src/
  components/
  hooks/
  lib/

✅ Улучшенная структура:
src/
  features/
    portfolio/
      components/
      hooks/
      api/
      types.ts
    trading/
      components/
      hooks/
      api/
      types.ts
  shared/
    components/ui/
    lib/
    hooks/
```

### 10. **Type definitions consolidation**

Многие типы дублируются между компонентами и хуками. Создать:

- `types/api.ts` - типы API ответов
- `types/domain.ts` - бизнес логика типы
- `types/ui.ts` - UI компоненты типы

---

## 📝 Заключение

Следующие шаги позволят:

- **Уменьшить кодовую базу** на ~930-1,350 строк
- **Улучшить поддерживаемость** кода
- **Увеличить переиспользование** компонентов
- **Ускорить разработку** новых функций
- **Улучшить типобезопасность** с централизованными query keys

Рекомендую начать с **Фазы 1** - быстрые победы дадут мгновенный результат при минимальных затратах времени.
