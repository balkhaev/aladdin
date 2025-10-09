# API Client - Единый формат вызовов

## 📋 Обзор

Все API вызовы в приложении используют **единый централизованный клиент** из `lib/api/client.ts`. Это обеспечивает:

- ✅ Единообразную обработку ошибок
- ✅ Автоматическое добавление `credentials: "include"` для сессий
- ✅ Таймауты для всех запросов
- ✅ Типизацию через TypeScript
- ✅ Консистентный формат ответов (`ApiResponse<T>`)

## 🏗️ Архитектура

```plaintext
Frontend (localhost:3001)
    ↓
lib/api/client.ts (apiGet, apiPost, apiPut, apiDelete, apiPatch)
    ↓
API_CONFIG.BASE_URL (http://localhost:3000 в dev)
    ↓
API Gateway (localhost:3000)
    ↓
Микросервисы (analytics, market-data, ml-service, scraper, etc.)
```

## 📦 Базовые функции

### `apiGet<T>(path, params?, options?)`

GET запрос с query parameters

```typescript
import { apiGet } from "./client"

// Простой запрос
const data = await apiGet<User>("/api/users/me")

// С параметрами
const results = await apiGet<ScreenerResult[]>("/api/screener/results", {
  limit: 100,
  timeframe: "1h",
})
```

### `apiPost<T>(path, body?, options?)`

POST запрос с JSON телом

```typescript
import { apiPost } from "./client"

// С телом запроса
const prediction = await apiPost<PredictionResult>("/api/ml/predict", {
  symbol: "BTCUSDT",
  horizon: "1h",
})

// Без тела
const result = await apiPost<TriggerResult>("/api/social/queues/trigger")
```

### `apiPut<T>(path, body?, options?)`

PUT запрос (обновление)

```typescript
import { apiPut } from "./client"

const updated = await apiPut<User>("/api/users/profile", {
  name: "New Name",
  email: "new@email.com",
})
```

### `apiDelete<T>(path, options?)`

DELETE запрос

```typescript
import { apiDelete } from "./client"

await apiDelete<void>("/api/ml/models/BTCUSDT")
```

### `apiPatch<T>(path, body?, options?)`

PATCH запрос (частичное обновление)

```typescript
import { apiPatch } from "./client"

const updated = await apiPatch<User>("/api/users/settings", {
  theme: "dark",
})
```

## 📝 Структура API файлов

Все API клиенты следуют единой структуре:

```typescript
/**
 * [Service Name] API Client
 * Unified API client using apiGet/apiPost/apiPut/apiDelete/apiPatch
 */

import { apiGet, apiPost, apiPut, apiDelete, apiPatch } from "./client"

// ==================== Types ====================

export type EntityType = {
  id: string
  name: string
  // ...
}

export type EntityListResponse = {
  items: EntityType[]
  total: number
}

// ==================== API Functions ====================

/**
 * Get entity by ID
 */
export async function getEntity(id: string): Promise<EntityType> {
  return apiGet<EntityType>(`/api/entities/${id}`)
}

/**
 * List all entities
 */
export async function listEntities(
  limit = 100,
  offset = 0
): Promise<EntityListResponse> {
  return apiGet<EntityListResponse>("/api/entities", { limit, offset })
}

/**
 * Create a new entity
 */
export async function createEntity(
  data: Omit<EntityType, "id">
): Promise<EntityType> {
  return apiPost<EntityType>("/api/entities", data)
}

/**
 * Update an entity
 */
export async function updateEntity(
  id: string,
  data: Partial<EntityType>
): Promise<EntityType> {
  return apiPatch<EntityType>(`/api/entities/${id}`, data)
}

/**
 * Delete an entity
 */
export async function deleteEntity(id: string): Promise<void> {
  return apiDelete<void>(`/api/entities/${id}`)
}
```

## 🎯 Примеры рефакторинга

### ❌ До (старый стиль)

```typescript
import { API_BASE_URL } from "../runtime-env"

export async function getScraperStatus(): Promise<ScraperStatus> {
  const response = await fetch(`${API_BASE_URL}/api/social/scrapers/status`, {
    credentials: "include",
  })

  if (!response.ok) {
    throw new Error(`Failed to get scraper status: ${response.statusText}`)
  }

  const data = await response.json()
  return data.data
}
```

### ✅ После (новый стиль)

```typescript
import { apiGet } from "./client"

export async function getScraperStatus(): Promise<ScraperStatus> {
  return apiGet<ScraperStatus>("/api/social/scrapers/status")
}
```

### ❌ До (с параметрами)

```typescript
export async function getOrderBook(
  symbol: string,
  limit = 20
): Promise<OrderBook> {
  const params = new URLSearchParams({
    limit: limit.toString(),
  })

  const response = await fetch(
    `${API_BASE_URL}/api/market-data/orderbook/${symbol}?${params}`,
    {
      credentials: "include",
    }
  )

  if (!response.ok) {
    throw new Error("Failed to fetch order book")
  }

  const result = await response.json()
  return result.data
}
```

### ✅ После (с параметрами)

```typescript
export async function getOrderBook(
  symbol: string,
  limit = 20
): Promise<OrderBook> {
  return apiGet<OrderBook>(`/api/market-data/orderbook/${symbol}`, { limit })
}
```

## 🔧 Обработка ошибок

Все API функции автоматически выбрасывают `ApiError` при ошибках:

```typescript
import { ApiError } from "./client"

try {
  const data = await apiGet<PredictionResult>("/api/ml/predict")
} catch (error) {
  if (error instanceof ApiError) {
    console.error("API Error:", error.code, error.message, error.status)
    // error.code - код ошибки (NETWORK_ERROR, TIMEOUT, etc.)
    // error.message - описание ошибки
    // error.status - HTTP статус код
  }
}
```

## 📚 Типы ошибок

- `NETWORK_ERROR` - сетевая ошибка
- `TIMEOUT` - таймаут запроса (по умолчанию 30 секунд)
- `PARSE_ERROR` - ошибка парсинга JSON
- `UNKNOWN_ERROR` - неизвестная ошибка
- Или код из `data.error.code` от API Gateway

## ⚙️ Настройки

Конфигурация в `lib/config.ts`:

```typescript
export const API_CONFIG = {
  BASE_URL: API_BASE_URL, // http://localhost:3000 в dev
  WS_URL: WS_BASE_URL, // ws://localhost:3000 в dev
  REQUEST_TIMEOUT: 30_000, // 30 секунд
}
```

## 🚀 Использование в React Query

```typescript
import { useQuery } from "@tanstack/react-query"
import { getScraperStatus } from "@/lib/api/social"

export function useScraperStatus() {
  return useQuery<ScraperStatus, Error>({
    queryKey: ["scraper-status"],
    queryFn: getScraperStatus,
    refetchInterval: 30_000, // Refresh every 30 seconds
  })
}
```

## 📋 Чеклист для новых API

При добавлении нового API эндпоинта:

- [ ] Создать типы в начале файла
- [ ] Использовать `apiGet`/`apiPost`/`apiPut`/`apiDelete`/`apiPatch`
- [ ] Добавить JSDoc комментарии
- [ ] Экспортировать функцию и типы
- [ ] **НЕ** использовать прямой `fetch`
- [ ] **НЕ** импортировать `API_BASE_URL` напрямую
- [ ] Проверить что типы соответствуют backend API

## 📦 Список API клиентов

- ✅ `analytics.ts` - аналитика и метрики
- ✅ `anomaly.ts` - детекция аномалий
- ✅ `backtest.ts` - бэктестинг стратегий
- ✅ `bybit-opportunities.ts` - арбитражные возможности Bybit
- ✅ `client.ts` - базовый HTTP клиент
- ✅ `exchange-credentials.ts` - учетные данные бирж
- ✅ `executor.ts` - исполнение торговых стратегий
- ✅ `macro.ts` - макроэкономические данные
- ✅ `market-data.ts` - рыночные данные
- ✅ `ml.ts` - ML предсказания и модели
- ✅ `on-chain.ts` - on-chain метрики
- ✅ `portfolio.ts` - портфель
- ✅ `risk.ts` - риск-менеджмент
- ✅ `screener.ts` - скринер активов
- ✅ `social.ts` - социальные данные и скраперы
- ✅ `trading.ts` - торговые операции

---

**Все API клиенты следуют этому стандарту!** 🎉
