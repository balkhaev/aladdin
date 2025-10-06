# API Gateway Package

## Overview

`@aladdin/gateway` provides a comprehensive solution for building API gateways with built-in service discovery, health monitoring, request proxying, and circuit breaker support.

## Architecture

The Gateway package consists of three main components:

1. **ServiceRegistry** - Manages service registration and health monitoring
2. **ProxyMiddleware** - Handles request forwarding with resilience patterns
3. **BaseGatewayService** - Base class for gateway services

## Features

- ✅ Service registration and discovery
- ✅ Automatic health checking
- ✅ Request proxying with retry and circuit breaker
- ✅ Path rewriting for backward compatibility
- ✅ Aggregated health status
- ✅ Integration with BaseService patterns

## Installation

```bash
bun add @aladdin/gateway
```

## Basic Usage

### 1. Using BaseGatewayService

```typescript
import { BaseGatewayService } from "@aladdin/gateway"
import { initializeService } from "@aladdin/service/bootstrap"

const gateway = await initializeService({
  serviceName: "gateway",
  port: 3000,

  createService: (deps) =>
    new BaseGatewayService({
      ...deps,
      services: {
        "market-data": process.env.MARKET_DATA_URL || "http://localhost:3010",
        trading: process.env.TRADING_URL || "http://localhost:3011",
        portfolio: process.env.PORTFOLIO_URL || "http://localhost:3012",
        analytics: process.env.ANALYTICS_URL || "http://localhost:3014",
      },
      healthCheckInterval: 30_000, // 30 seconds
    }),

  setupRoutes: (app, gateway) => {
    // Setup proxy routes
    gateway.setupProxyRoutes(app)

    // Custom gateway routes
    app.get("/health/services", async (c) => {
      const health = gateway.getAggregatedHealth()
      return c.json(health)
    })
  },

  dependencies: {
    postgres: true,
    nats: true,
  },
})
```

### 2. Service Registry

The `ServiceRegistry` manages microservices and their health status:

```typescript
import { ServiceRegistry } from "@aladdin/gateway"

const registry = new ServiceRegistry({
  services: {
    "market-data": "http://localhost:3010",
    trading: "http://localhost:3011",
  },
  healthCheckInterval: 30_000,
  logger,
})

// Check if service is healthy
if (registry.isServiceHealthy("market-data")) {
  console.log("Market data service is healthy")
}

// Get all services health
const allHealth = registry.getAllServicesHealth()
console.log(allHealth)
```

#### ServiceRegistry API

- `registerService(config)` - Register a new service
- `unregisterService(name)` - Remove a service
- `getServiceUrl(name)` - Get service URL
- `isServiceHealthy(name)` - Check if service is healthy
- `getServiceHealth(name)` - Get health status for a service
- `getAllServicesHealth()` - Get health status for all services
- `stop()` - Stop health checking

### 3. Proxy Middleware

The `ProxyMiddleware` forwards requests to microservices with resilience:

```typescript
import { createProxyMiddleware } from "@aladdin/gateway"

app.use(
  "/api/market-data/*",
  createProxyMiddleware("market-data", {
    serviceRegistry: registry,
    logger,
    enableRetry: true,
    enableCircuitBreaker: true,
    timeout: 10_000,
  })
)
```

#### Features

- **Automatic Retry** - Retries failed requests (configurable)
- **Circuit Breaker** - Prevents cascading failures
- **Health Checking** - Rejects requests to unhealthy services
- **Header Forwarding** - Forwards relevant headers
- **Body Forwarding** - Supports POST/PUT/PATCH requests
- **Timeout Support** - Configurable request timeouts

### 4. Path Rewriting

Support for backward compatibility through path rewriting:

```typescript
import { createProxyWithRewrite } from "@aladdin/gateway"

app.use(
  "*",
  createProxyWithRewrite(
    {
      serviceRegistry: registry,
      logger,
    },
    {
      "/api/macro/*": {
        target: "market-data",
        rewrite: "/api/market-data/macro/*",
      },
      "/api/sentiment/*": {
        target: "analytics",
        rewrite: "/api/analytics/sentiment/*",
      },
    }
  )
)
```

## Advanced Usage

### Custom Gateway Service

Extend `BaseGatewayService` for custom functionality:

```typescript
import { BaseGatewayService, type GatewayServiceConfig } from "@aladdin/gateway"

class CustomGateway extends BaseGatewayService {
  constructor(config: GatewayServiceConfig) {
    super(config)
  }

  // Add custom methods
  async getCustomMetrics() {
    return {
      totalRequests: this.requestCount,
      services: this.registry.getAllServicesHealth(),
    }
  }

  protected override async onStart() {
    await super.onStart()
    // Custom initialization
  }
}
```

### Health Check Aggregation

Get aggregated health status for all services:

```typescript
const health = gateway.getAggregatedHealth()
console.log(health)
// {
//   gateway: "ok",
//   services: {
//     "market-data": true,
//     "trading": false,
//     "portfolio": true,
//   },
//   allHealthy: false,
//   timestamp: 1234567890
// }
```

### Circuit Breaker Configuration

The circuit breaker configuration is inherited from `ServiceConstants`:

```typescript
export const ServiceConstants = {
  CIRCUIT_BREAKER: {
    TIMEOUT: 10_000, // 10 seconds
    ERROR_THRESHOLD: 50, // 50% error rate
    MINIMUM_REQUESTS: 10, // Minimum 10 requests
    RESET_TIMEOUT: 60_000, // 60 seconds
    SUCCESS_THRESHOLD: 2, // 2 successful requests to close
  },
}
```

### Retry Configuration

Retry is configurable and only applies to GET requests by default:

```typescript
export const ServiceConstants = {
  RETRY: {
    MAX_ATTEMPTS: 2, // 2 retries
    INITIAL_DELAY: 500, // 500ms initial delay
    MAX_DELAY: 2000, // 2s maximum delay
    BACKOFF_FACTOR: 2, // Exponential backoff
  },
}
```

## Configuration

### Environment Variables

```bash
# Gateway
GATEWAY_PORT=3000
CORS_ORIGIN=http://localhost:3001

# Service URLs
MARKET_DATA_URL=http://localhost:3010
TRADING_URL=http://localhost:3011
PORTFOLIO_URL=http://localhost:3012
ANALYTICS_URL=http://localhost:3014
SCREENER_URL=http://localhost:3017
SCRAPER_URL=http://localhost:3018

# Health Check
HEALTH_CHECK_INTERVAL=30000
```

### Service Configuration

```typescript
{
  services: {
    "service-name": "http://service-url:port",
  },
  healthCheckInterval: 30_000,     // 30 seconds
  pathRewrites: {                  // Optional
    "/old/path/*": {
      target: "service-name",
      rewrite: "/new/path/*",
    },
  },
}
```

## Migration from Old Gateway

### Before (apps/server/src/index.ts)

```typescript
// 314 lines of manual setup
import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();

app.use("/*", cors({ ... }));

// Manual proxy setup for each service
app.use("/api/market-data/*", async (c) => {
  const targetUrl = `${MARKET_DATA_URL}${c.req.path}`;
  const response = await fetch(targetUrl, { ... });
  return response;
});

// Repeat for each service...
```

### After (using @aladdin/gateway)

```typescript
// ~50 lines with gateway package
import { BaseGatewayService } from "@aladdin/gateway"
import { initializeService } from "@aladdin/service/bootstrap"

await initializeService({
  serviceName: "gateway",
  port: 3000,

  createService: (deps) =>
    new BaseGatewayService({
      ...deps,
      services: {
        "market-data": process.env.MARKET_DATA_URL,
        trading: process.env.TRADING_URL,
        // ... other services
      },
    }),

  setupRoutes: (app, gateway) => {
    gateway.setupProxyRoutes(app)

    // Custom routes only
    app.get("/health/services", async (c) => {
      return c.json(gateway.getAggregatedHealth())
    })
  },
})
```

## Benefits

### 1. Code Reduction

- **Before**: 314 lines of manual gateway code
- **After**: ~50 lines with gateway package
- **Reduction**: 84% less code

### 2. Built-in Resilience

- Automatic retry for failed requests
- Circuit breaker prevents cascading failures
- Health checking rejects requests to unhealthy services

### 3. Monitoring

- Automatic health checks every 30 seconds
- Aggregated health status
- Service availability tracking

### 4. Maintainability

- Single source of truth for proxy logic
- Easy to add/remove services
- Consistent error handling

### 5. Type Safety

- Full TypeScript support
- Type-safe service configuration
- IntelliSense support

## Best Practices

### 1. Health Check Interval

- **Development**: 30 seconds
- **Production**: 10-15 seconds
- **High-traffic**: 5 seconds

### 2. Timeout Configuration

- **Fast services**: 5 seconds
- **Normal services**: 10 seconds
- **Slow services**: 30 seconds

### 3. Circuit Breaker

- Enable for all production deployments
- Adjust thresholds based on service SLA
- Monitor circuit breaker state

### 4. Retry Strategy

- Only retry idempotent requests (GET)
- Limit retry attempts to 2-3
- Use exponential backoff

### 5. Path Rewriting

- Use for backward compatibility
- Document all rewrites
- Plan migration timeline

## Troubleshooting

### Service Shows as Unhealthy

1. Check service URL is correct
2. Verify service is running
3. Check network connectivity
4. Review service logs
5. Verify /health endpoint exists

### High Latency

1. Check health check interval
2. Review timeout configuration
3. Check circuit breaker state
4. Monitor service response times

### Circuit Breaker Open

1. Check service health
2. Review error logs
3. Increase error threshold if needed
4. Verify service capacity

### Requests Failing

1. Check service registry status
2. Verify proxy configuration
3. Review retry settings
4. Check service logs

## Performance

- Health checks are async and non-blocking
- Circuit breaker adds <1ms overhead
- Retry adds latency only on failures
- Registry lookup is O(1)

## See Also

- [Architecture Guide](./ARCHITECTURE.md)
- [WebSocket Guide](./WEBSOCKET.md)
- [Development Guide](./DEVELOPMENT.md)
