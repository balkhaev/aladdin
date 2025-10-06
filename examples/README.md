# Coffee Platform Examples

Практические примеры использования новой архитектуры Coffee Trading Platform.

## Обзор примеров

### 1. [Basic Service](./01-basic-service.ts)

Простой микросервис с минимальной конфигурацией.

**Темы:**

- Создание BaseService
- Настройка HTTP endpoints
- Базовая структура сервиса

**Запуск:**

```bash
bun run examples/01-basic-service.ts
```

### 2. [Service with Database](./02-service-with-database.ts)

Сервис с доступом к PostgreSQL через Prisma ORM.

**Темы:**

- Интеграция с PostgreSQL
- CRUD операции
- Использование Prisma client

**Запуск:**

```bash
bun run examples/02-service-with-database.ts
```

### 3. [Service with Caching](./03-service-with-cache.ts)

Сервис с Redis кэшированием для оптимизации производительности.

**Темы:**

- Redis кэширование
- Упрощенный cache API (`this.cache`)
- Cache invalidation
- Cache statistics

**Запуск:**

```bash
bun run examples/03-service-with-cache.ts
```

### 4. [Service with Events](./04-service-with-events.ts)

Event-driven архитектура с NATS messaging.

**Темы:**

- Event publishing через NATS
- Event subscription
- Event handlers
- Inter-service communication

**Запуск:**

```bash
bun run examples/04-service-with-events.ts
```

### 5. [Service with WebSocket](./05-service-with-websocket.ts)

Real-time сервис с WebSocket поддержкой.

**Темы:**

- BaseWebSocketHandler
- WebSocket subscriptions
- Real-time broadcasting
- NATS + WebSocket integration

**Запуск:**

```bash
bun run examples/05-service-with-websocket.ts
```

### 6. [Service with RouteBuilder](./06-service-with-route-builder.ts)

Type-safe роутинг с автоматической валидацией.

**Темы:**

- RouteBuilder fluent API
- Автоматическая валидация (Zod)
- Type-safe параметры и query
- Auth requirements
- Route groups
- Error handling
- 80% меньше boilerplate кода!

**Запуск:**

```bash
bun run examples/06-service-with-route-builder.ts
```

## Prerequisites

Перед запуском примеров убедитесь, что у вас запущены:

```bash
# PostgreSQL
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password postgres

# Redis
docker run -d -p 6379:6379 redis

# NATS
docker run -d -p 4222:4222 nats
```

Или используйте docker-compose:

```bash
bun run infra:up
```

## Environment Variables

Создайте `.env` файл в корне проекта:

```bash
# Copy from .env.example
cp .env.example .env

# Required for examples
DATABASE_URL=postgresql://postgres:password@localhost:5432/coffee
REDIS_URL=redis://localhost:6379
NATS_URL=nats://localhost:4222
```

## Структура примеров

Каждый пример следует единому паттерну:

```typescript
// 1. Define service class
class MyService extends BaseService {
  getServiceName() {
    return "my-service"
  }

  // Business logic here
}

// 2. Initialize service
await initializeService({
  serviceName: "my-service",
  port: 3000,

  createService: (deps) => new MyService(deps),

  setupRoutes: (app, service) => {
    // Define HTTP endpoints
  },

  dependencies: {
    // Declare required infrastructure
  },
})
```

## Common Patterns

### Using Cache

```typescript
// Get from cache
const data = await this.cache.get(key)

// Set to cache with TTL
await this.cache.set(key, value, 300) // 5 minutes

// Delete from cache
await this.cache.delete(key)

// Get cache stats
const stats = await this.cache.getStats()
```

### Publishing Events

```typescript
// Publish event to NATS
await this.publishEvent("orders.created", {
  orderId: "123",
  total: 100,
})
```

### Subscribing to Events

```typescript
// Subscribe to NATS events
await this.subscribeToEvents("payments.*", async (data) => {
  // Handle event
  console.log("Payment event:", data)
})
```

### Using Service Client

```typescript
// Call another service
const result = await this.client.marketData.getQuote("BTCUSDT")
```

### WebSocket Broadcasting

```typescript
// Broadcast to all clients
this.broadcast({
  type: "notification",
  message: "Hello everyone!",
})

// Broadcast to specific channel
this.broadcastToChannel("orders", {
  type: "order.created",
  data: orderData,
})
```

## Testing Examples

Каждый пример можно протестировать через HTTP и WebSocket:

### HTTP Endpoints

```bash
# Example 1: Basic Service
curl http://localhost:3020/api/hello/John

# Example 2: Database Service
curl -X POST http://localhost:3021/api/users \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User"}'

# Example 3: Cache Service
curl http://localhost:3022/api/products/prod-1

# Example 4: Event Service
curl -X POST http://localhost:3023/api/orders \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-1","items":[{"productId":"prod-1","quantity":2}]}'
```

### WebSocket Connections

```javascript
// Example 5: WebSocket Service
const ws = new WebSocket("ws://localhost:3024/ws/notifications")

ws.onopen = () => {
  // Subscribe to channel
  ws.send(
    JSON.stringify({
      type: "subscribe",
      channel: "notifications",
    })
  )
}

ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  console.log("Received:", data)
}
```

## Next Steps

После изучения примеров:

1. **Создайте свой сервис** - используйте примеры как шаблон
2. **Изучите документацию** - смотрите `docs/` для подробностей
3. **Используйте Gateway** - интегрируйте сервис с API Gateway
4. **Добавьте тесты** - используйте `packages/testing` (когда будет готов)

## Resources

- [Architecture Guide](../docs/ARCHITECTURE.md)
- [Gateway Guide](../docs/GATEWAY.md)
- [WebSocket Guide](../docs/WEBSOCKET.md)
- [Development Guide](../docs/DEVELOPMENT.md)

## Troubleshooting

### Port Already in Use

```bash
# Find process using port
lsof -i :3020

# Kill process
kill -9 <PID>
```

### Database Connection Failed

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Check connection
psql postgresql://postgres:password@localhost:5432/coffee
```

### NATS Connection Failed

```bash
# Check NATS is running
docker ps | grep nats

# Test connection
curl http://localhost:8222/varz
```

### Redis Connection Failed

```bash
# Check Redis is running
docker ps | grep redis

# Test connection
redis-cli ping
```

## Contributing

Если вы хотите добавить новый пример:

1. Создайте файл `XX-example-name.ts`
2. Следуйте существующему паттерну
3. Добавьте описание в этот README
4. Убедитесь, что пример работает автономно

## License

См. основной LICENSE файл проекта.
