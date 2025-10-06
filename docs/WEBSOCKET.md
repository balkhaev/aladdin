# WebSocket Handler Guide

## Overview

`@aladdin/websocket` provides a powerful base class for implementing WebSocket handlers with built-in support for authentication, rate limiting, subscription management, NATS integration, and event caching.

## Features

- ✅ Rate limiting
- ✅ Authentication with timeout
- ✅ Ping/pong heartbeat
- ✅ Subscription management
- ✅ Event caching and deduplication
- ✅ NATS integration
- ✅ Channel broadcasting
- ✅ Automatic cleanup

## Installation

```bash
bun add @aladdin/websocket
```

## Basic Usage

### 1. Extend BaseWebSocketHandler

```typescript
import {
  BaseWebSocketHandler,
  type BaseWebSocketData,
} from "@aladdin/websocket"
import type { Logger } from "@aladdin/logger"
import type { NatsClient } from "@aladdin/messaging"
import type { ServerWebSocket } from "bun"

// Define your WebSocket data type
type MyWebSocketData = BaseWebSocketData & {
  userId?: string
  authenticated: boolean
}

// Define your message types
type MyClientMessage = {
  type: "subscribe" | "unsubscribe" | "custom"
  channel?: string
  data?: unknown
}

class MyWebSocketHandler extends BaseWebSocketHandler<
  MyWebSocketData,
  MyClientMessage
> {
  constructor(natsClient: NatsClient, logger: Logger) {
    super({
      logger,
      natsClient,
      requireAuth: true,
      authTimeout: 5000,
      enableEventCache: true,
      rateLimit: {
        windowMs: 1000,
        maxMessages: 10,
      },
    })
  }

  // Implement required methods
  protected handleSubscribe(
    ws: ServerWebSocket<MyWebSocketData>,
    data: MyClientMessage
  ): void {
    if (!data.channel) {
      this.sendError(ws, "Channel is required")
      return
    }

    // Subscribe client to channel
    this.subscribeToChannel(ws.data.clientId, data.channel)

    this.sendMessage(ws, {
      type: "subscribed",
      channel: data.channel,
      timestamp: Date.now(),
    })
  }

  protected handleUnsubscribe(
    ws: ServerWebSocket<MyWebSocketData>,
    data: MyClientMessage
  ): void {
    if (!data.channel) {
      this.sendError(ws, "Channel is required")
      return
    }

    // Unsubscribe client from channel
    this.unsubscribeFromChannel(ws.data.clientId, data.channel)

    this.sendMessage(ws, {
      type: "unsubscribed",
      channel: data.channel,
      timestamp: Date.now(),
    })
  }

  // Override authentication
  protected override isAuthenticated(
    ws: ServerWebSocket<MyWebSocketData>
  ): boolean {
    return ws.data.authenticated
  }

  protected override handleAuth(
    ws: ServerWebSocket<MyWebSocketData>,
    data: MyClientMessage
  ): void {
    // Verify token (simplified)
    const token = data.token as string
    if (token === "valid-token") {
      ws.data.authenticated = true
      ws.data.userId = "user-123"

      // Clear auth timeout
      this.clearAuthTimeout(ws.data.clientId)

      this.sendMessage(ws, {
        type: "authenticated",
        userId: ws.data.userId,
        timestamp: Date.now(),
      })
    } else {
      this.sendError(ws, "Invalid token")
      ws.close(1008, "Authentication failed")
    }
  }

  // Setup NATS subscriptions
  protected override async setupNatsSubscriptions(): Promise<void> {
    // Subscribe to NATS events and broadcast to WebSocket clients
    await this.subscribeNatsAndBroadcast(
      "orders.*", // NATS subject
      "orders" // WebSocket channel
    )

    await this.subscribeNatsAndBroadcast("portfolio.*", "portfolio")
  }
}
```

### 2. Use in Service

```typescript
import { initializeService } from "@aladdin/service/bootstrap"

type WebSocketData = BaseWebSocketData & {
  userId?: string
  authenticated: boolean
}

let wsHandler: MyWebSocketHandler

await initializeService<MyService, WebSocketData>({
  serviceName: "my-service",
  port: 3000,

  createService: (deps) => new MyService(deps),

  afterInit: async (_service, deps) => {
    wsHandler = new MyWebSocketHandler(deps.natsClient!, deps.logger)
    await wsHandler.initialize()
  },

  websocket: {
    enabled: true,
    path: "/ws",
    handlers: {
      open: (ws) => wsHandler.onOpen(ws),
      message: (ws, message) => wsHandler.onMessage(ws, message),
      close: (ws, code, reason) => wsHandler.onClose(ws, code, reason),
    },
    createWebSocketData: () => ({
      clientId: crypto.randomUUID(),
      messageCount: 0,
      lastMessageTime: Date.now(),
      lastPingTime: Date.now(),
      authenticated: false,
    }),
  },
})
```

## Features

### 1. Rate Limiting

Rate limiting prevents clients from overwhelming the server:

```typescript
super({
  rateLimit: {
    windowMs: 1000, // 1 second window
    maxMessages: 10, // Max 10 messages per second
  },
})
```

When limit is exceeded:

```json
{
  "type": "error",
  "message": "Rate limit exceeded",
  "timestamp": 1234567890
}
```

### 2. Authentication

#### With Authentication

```typescript
super({
  requireAuth: true,
  authTimeout: 5000, // 5 seconds to authenticate
})
```

Client must send auth message within 5 seconds:

```json
{
  "type": "auth",
  "token": "your-jwt-token"
}
```

Response:

```json
{
  "type": "authenticated",
  "userId": "user-123",
  "timestamp": 1234567890
}
```

#### Without Authentication

```typescript
super({
  requireAuth: false,
})
```

### 3. Subscription Management

Track which clients are subscribed to which channels:

```typescript
// Subscribe client to channel
this.subscribeToChannel(clientId, "orders")

// Unsubscribe from channel
this.unsubscribeFromChannel(clientId, "orders")

// Get client's subscriptions
const channels = this.getClientSubscriptions(clientId)

// Get all clients in channel
const clients = this.getChannelClients("orders")

// Broadcast to channel
this.broadcastToChannel("orders", {
  type: "order.created",
  data: orderData,
})
```

### 4. Event Caching

Prevent duplicate events from being sent to clients:

```typescript
super({
  enableEventCache: true,
  eventCacheMaxSize: 1000,
})

// Check if event was sent
if (!this.hasSeenEvent(clientId, eventId)) {
  this.markEventSeen(clientId, eventId)
  this.sendMessage(ws, eventData)
}
```

### 5. NATS Integration

#### Publish to NATS

```typescript
await this.publishToNats("orders.created", {
  orderId: "123",
  symbol: "BTCUSDT",
  side: "buy",
})
```

#### Subscribe and Broadcast

```typescript
// In setupNatsSubscriptions()
await this.subscribeNatsAndBroadcast(
  "orders.*", // NATS subject pattern
  "orders" // WebSocket channel
)
```

When a NATS message arrives on `orders.*`, it's automatically broadcast to all WebSocket clients subscribed to the `orders` channel.

### 6. Ping/Pong Heartbeat

Automatic heartbeat to detect disconnected clients:

```typescript
super({
  pingInterval: 30_000, // Ping every 30 seconds
  pongTimeout: 5000, // Expect pong within 5 seconds
})
```

Client should respond to ping:

```json
// Server -> Client
{ "type": "ping", "timestamp": 1234567890 }

// Client -> Server
{ "type": "pong", "timestamp": 1234567890 }
```

## Advanced Features

### Custom Message Handling

```typescript
protected override handleCustomMessage(
  ws: ServerWebSocket<MyWebSocketData>,
  data: MyClientMessage
): void {
  switch (data.type) {
    case "custom":
      // Handle custom message type
      this.handleCustom(ws, data);
      break;
    default:
      super.handleCustomMessage(ws, data);
  }
}
```

### Client Lifecycle Hooks

```typescript
protected override onClientConnected(ws: ServerWebSocket<MyWebSocketData>): void {
  // Called after client connects
  this.logger.info("New client connected", {
    clientId: ws.data.clientId,
  });
}

protected override onClientDisconnected(
  ws: ServerWebSocket<MyWebSocketData>,
  code: number,
  reason: string
): void {
  // Called before cleanup
  this.logger.info("Client disconnected", {
    clientId: ws.data.clientId,
    code,
    reason,
  });
}
```

### Broadcast Methods

```typescript
// Broadcast to all clients
this.broadcast({
  type: "system.announcement",
  message: "Server maintenance in 5 minutes",
})

// Broadcast to specific channel
this.broadcastToChannel("orders", {
  type: "order.updated",
  data: orderData,
})

// Send to specific client
const ws = this.clients.get(clientId)
if (ws) {
  this.sendMessage(ws, data)
}
```

## Message Protocol

### Standard Messages

#### Connection

```json
// Server -> Client (on connection)
{
  "type": "connected",
  "clientId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": 1234567890
}
```

#### Authentication

```json
// Client -> Server
{
  "type": "auth",
  "token": "eyJhbGciOiJIUzI1NiIs..."
}

// Server -> Client (success)
{
  "type": "authenticated",
  "userId": "user-123",
  "timestamp": 1234567890
}

// Server -> Client (failure)
{
  "type": "error",
  "message": "Invalid token",
  "timestamp": 1234567890
}
```

#### Subscribe

```json
// Client -> Server
{
  "type": "subscribe",
  "channel": "orders"
}

// Server -> Client
{
  "type": "subscribed",
  "channel": "orders",
  "timestamp": 1234567890
}
```

#### Unsubscribe

```json
// Client -> Server
{
  "type": "unsubscribe",
  "channel": "orders"
}

// Server -> Client
{
  "type": "unsubscribed",
  "channel": "orders",
  "timestamp": 1234567890
}
```

#### Ping/Pong

```json
// Server -> Client
{
  "type": "ping",
  "timestamp": 1234567890
}

// Client -> Server
{
  "type": "pong",
  "timestamp": 1234567890
}
```

#### Error

```json
// Server -> Client
{
  "type": "error",
  "message": "Rate limit exceeded",
  "timestamp": 1234567890
}
```

## Configuration Reference

```typescript
{
  logger: Logger,                    // Required
  natsClient?: NatsClient,           // Optional NATS integration
  rateLimit?: {
    windowMs: number,                // Rate limit window (default: 1000ms)
    maxMessages: number,             // Max messages per window (default: 10)
  },
  requireAuth?: boolean,             // Require authentication (default: false)
  pingInterval?: number,             // Ping interval (default: 30000ms)
  pongTimeout?: number,              // Pong timeout (default: 5000ms)
  authTimeout?: number,              // Auth timeout (default: 5000ms)
  enableEventCache?: boolean,        // Enable event caching (default: false)
  eventCacheMaxSize?: number,        // Max cache size (default: 1000)
}
```

## Best Practices

### 1. Always Use Authentication in Production

```typescript
super({
  requireAuth: true,
  authTimeout: 5000,
})
```

### 2. Set Appropriate Rate Limits

```typescript
// For high-frequency trading
super({
  rateLimit: {
    windowMs: 1000,
    maxMessages: 50,
  },
})

// For normal usage
super({
  rateLimit: {
    windowMs: 1000,
    maxMessages: 10,
  },
})
```

### 3. Enable Event Caching for Real-time Updates

```typescript
super({
  enableEventCache: true,
  eventCacheMaxSize: 5000,
})
```

### 4. Use NATS for Service Communication

```typescript
// Publish events to NATS
await this.publishToNats("orders.created", orderData)

// Subscribe to NATS events
await this.subscribeNatsAndBroadcast("orders.*", "orders")
```

### 5. Handle Cleanup Properly

```typescript
protected override onClientDisconnected(
  ws: ServerWebSocket<MyWebSocketData>,
  code: number,
  reason: string
): void {
  // Clean up custom resources
  this.cleanupClientResources(ws.data.clientId);

  // Base class handles:
  // - Removing client from registry
  // - Clearing ping interval
  // - Clearing auth timeout
  // - Unsubscribing from all channels
  // - Clearing event cache
}
```

## Troubleshooting

### Connection Closes Immediately

**Cause**: Authentication timeout

**Solution**: Either:

1. Set `requireAuth: false` if auth not needed
2. Send auth message within `authTimeout` milliseconds

### Rate Limit Errors

**Cause**: Too many messages

**Solution**:

1. Increase rate limits
2. Implement client-side throttling
3. Use batch operations

### Events Not Received

**Causes**:

1. Not subscribed to channel
2. Event cached (duplicate)
3. Client disconnected

**Solutions**:

1. Verify subscription
2. Check event IDs
3. Monitor connection status

### High Memory Usage

**Causes**:

1. Too many event cache entries
2. Large subscription lists
3. Many connected clients

**Solutions**:

1. Reduce `eventCacheMaxSize`
2. Implement subscription limits
3. Scale horizontally

## See Also

- [Gateway Guide](./GATEWAY.md)
- [Architecture Guide](./ARCHITECTURE.md)
- [Development Guide](./DEVELOPMENT.md)
