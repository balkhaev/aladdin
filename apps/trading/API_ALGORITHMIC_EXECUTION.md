# Algorithmic Execution API

**Version:** 1.0.0  
**Base URL:** `/api/trading/executor`  
**Date:** 5 октября 2025

---

## 📚 Обзор

API для алгоритмического исполнения ордеров с использованием стратегий VWAP, TWAP и Iceberg.

### Возможности

- ✅ Создание алгоритмического исполнения
- ✅ Отслеживание прогресса в real-time через WebSocket
- ✅ Управление активными executions
- ✅ Отмена исполнения
- ✅ Поддержка трех стратегий: VWAP, TWAP, Iceberg

---

## 🔌 REST API Endpoints

### 1. Создать алгоритмическое исполнение

Создает новое алгоритмическое исполнение ордера.

**Endpoint:** `POST /algorithmic`

**Request Body:**

```json
{
  "symbol": "BTCUSDT",
  "side": "BUY",
  "totalQuantity": 10.0,
  "strategy": "VWAP",
  "duration": 3600,
  "volumeProfile": [
    { "hour": 9, "volume": 1500000 },
    { "hour": 10, "volume": 2000000 },
    { "hour": 11, "volume": 1800000 }
  ],
  "maxSliceSize": 1.0,
  "minSliceSize": 0.1
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `symbol` | `string` | ✅ | Торговая пара (e.g., "BTCUSDT") |
| `side` | `"BUY" \| "SELL"` | ✅ | Направление сделки |
| `totalQuantity` | `number` | ✅ | Общее количество для исполнения |
| `strategy` | `"VWAP" \| "TWAP" \| "ICEBERG"` | ✅ | Стратегия исполнения |
| `duration` | `number` | ⚠️ | Длительность (секунды, обязательно для VWAP/TWAP) |
| `sliceInterval` | `number` | ❌ | Интервал между slices (секунды, для TWAP) |
| `visibleQuantity` | `number` | ⚠️ | Видимая часть (обязательно для ICEBERG) |
| `volumeProfile` | `Array<{hour, volume}>` | ❌ | Historical volume data (для VWAP) |
| `minSliceSize` | `number` | ❌ | Минимальный размер slice |
| `maxSliceSize` | `number` | ❌ | Максимальный размер slice |

**Response 200 OK:**

```json
{
  "success": true,
  "data": {
    "executionId": "BTCUSDT-1728123456789",
    "schedule": {
      "strategy": "VWAP",
      "symbol": "BTCUSDT",
      "side": "BUY",
      "totalQuantity": 10.0,
      "slices": [
        {
          "index": 0,
          "timestamp": 1728123456789,
          "quantity": 1.2
        }
        // ... more slices
      ],
      "startTime": 1728123456789,
      "endTime": 1728127056789
    }
  },
  "timestamp": 1728123456789
}
```

**Error Responses:**

```json
// 400 Bad Request - Missing required fields
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Missing required fields: symbol, side, totalQuantity, strategy"
  },
  "timestamp": 1728123456789
}

// 500 Internal Server Error
{
  "success": false,
  "error": {
    "code": "ALGORITHMIC_EXECUTION_FAILED",
    "message": "Algorithmic execution is disabled"
  },
  "timestamp": 1728123456789
}
```

---

### 2. Получить все активные executions

Возвращает список всех активных алгоритмических executions.

**Endpoint:** `GET /algorithmic`

**Response 200 OK:**

```json
{
  "success": true,
  "data": {
    "executions": [
      {
        "executionId": "BTCUSDT-1728123456789",
        "symbol": "BTCUSDT",
        "strategy": "VWAP",
        "status": "IN_PROGRESS",
        "filled": 3.5,
        "remaining": 6.5,
        "totalQuantity": 10.0,
        "completion": 0.35,
        "slicesCompleted": 3,
        "totalSlices": 10,
        "failedSlices": 0
      }
      // ... more executions
    ],
    "count": 1
  },
  "timestamp": 1728123456789
}
```

---

### 3. Получить детали execution

Возвращает полную информацию об execution.

**Endpoint:** `GET /algorithmic/:id`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Execution ID |

**Response 200 OK:**

```json
{
  "success": true,
  "data": {
    "schedule": {
      "strategy": "TWAP",
      "symbol": "ETHUSDT",
      "side": "SELL",
      "totalQuantity": 50.0,
      "slices": [...],
      "startTime": 1728123456789,
      "endTime": 1728124056789
    },
    "status": "IN_PROGRESS",
    "filled": 20.0,
    "remaining": 30.0,
    "currentSliceIndex": 4,
    "failedSlices": [],
    "fills": [
      {
        "sliceIndex": 0,
        "quantity": 5.0,
        "price": 2500.50,
        "timestamp": 1728123500000
      }
      // ... more fills
    ],
    "createdAt": 1728123456789,
    "startedAt": 1728123460000
  },
  "timestamp": 1728123456789
}
```

**Error Responses:**

```json
// 404 Not Found
{
  "success": false,
  "error": {
    "code": "EXECUTION_NOT_FOUND",
    "message": "Execution BTCUSDT-1728123456789 not found"
  },
  "timestamp": 1728123456789
}
```

---

### 4. Отменить execution

Отменяет активное алгоритмическое исполнение.

**Endpoint:** `DELETE /algorithmic/:id`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Execution ID |

**Response 200 OK:**

```json
{
  "success": true,
  "data": {
    "message": "Execution cancelled",
    "executionId": "BTCUSDT-1728123456789"
  },
  "timestamp": 1728123456789
}
```

**Error Responses:**

```json
// 500 Internal Server Error
{
  "success": false,
  "error": {
    "code": "CANCEL_EXECUTION_FAILED",
    "message": "Execution BTCUSDT-1728123456789 not found"
  },
  "timestamp": 1728123456789
}
```

---

## 🔌 WebSocket API

### Подключение

**URL:** `ws://localhost:3016/ws`

**Protocol:** WebSocket

### Аутентификация

После подключения необходимо отправить auth сообщение:

```json
{
  "type": "auth",
  "token": "user:your-user-id"
}
```

**Response:**

```json
{
  "type": "authenticated",
  "userId": "your-user-id",
  "timestamp": 1728123456789
}
```

### Подписка на execution events

```json
{
  "type": "subscribe",
  "channels": ["executions"]
}
```

**Response:**

```json
{
  "type": "subscribed",
  "channel": "executions",
  "timestamp": 1728123456789
}
```

### События

#### 1. Execution Created

Отправляется при создании нового execution.

```json
{
  "type": "execution",
  "event": "trading.execution.created",
  "data": {
    "executionId": "BTCUSDT-1728123456789",
    "symbol": "BTCUSDT",
    "strategy": "VWAP",
    "totalQuantity": 10.0,
    "slices": 10,
    "startTime": 1728123456789,
    "endTime": 1728127056789
  },
  "timestamp": "2025-10-05T10:00:00.000Z"
}
```

#### 2. Execution Progress

Отправляется при каждом обновлении прогресса (заполнении slice).

```json
{
  "type": "execution",
  "event": "trading.execution.progress",
  "data": {
    "executionId": "BTCUSDT-1728123456789",
    "status": "IN_PROGRESS",
    "filled": 3.5,
    "remaining": 6.5,
    "completion": 0.35
  },
  "timestamp": "2025-10-05T10:05:00.000Z"
}
```

#### 3. Execution Completed

Отправляется при завершении execution.

```json
{
  "type": "execution",
  "event": "trading.execution.completed",
  "data": {
    "executionId": "BTCUSDT-1728123456789",
    "status": "COMPLETED",
    "filled": 10.0,
    "failedSlices": 0
  },
  "timestamp": "2025-10-05T11:00:00.000Z"
}
```

#### 4. Execution Cancelled

Отправляется при отмене execution.

```json
{
  "type": "execution",
  "event": "trading.execution.cancelled",
  "data": {
    "executionId": "BTCUSDT-1728123456789",
    "filled": 3.5,
    "remaining": 6.5
  },
  "timestamp": "2025-10-05T10:30:00.000Z"
}
```

### Отписка

```json
{
  "type": "unsubscribe",
  "channels": ["executions"]
}
```

### Keepalive

Сервер отправляет ping каждые 30 секунд:

```json
{
  "type": "ping",
  "timestamp": 1728123456789
}
```

Клиент должен ответить pong:

```json
{
  "type": "pong"
}
```

---

## 📖 Примеры использования

### JavaScript/TypeScript

#### REST API

```typescript
// Создать VWAP execution
const response = await fetch('/api/trading/executor/algorithmic', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    symbol: 'BTCUSDT',
    side: 'BUY',
    totalQuantity: 10,
    strategy: 'VWAP',
    duration: 3600,
    volumeProfile: [
      { hour: 9, volume: 1500000 },
      { hour: 10, volume: 2000000 },
    ],
  }),
});

const { data } = await response.json();
console.log('Execution ID:', data.executionId);
console.log('Total slices:', data.schedule.slices.length);

// Получить статус
const statusResponse = await fetch(
  `/api/trading/executor/algorithmic/${data.executionId}`
);
const { data: execution } = await statusResponse.json();
console.log('Progress:', execution.filled / execution.schedule.totalQuantity);

// Отменить execution
await fetch(`/api/trading/executor/algorithmic/${data.executionId}`, {
  method: 'DELETE',
});
```

#### WebSocket

```typescript
const ws = new WebSocket('ws://localhost:3016/ws');

ws.onopen = () => {
  // Authenticate
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'user:my-user-id',
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'authenticated') {
    // Subscribe to executions
    ws.send(JSON.stringify({
      type: 'subscribe',
      channels: ['executions'],
    }));
  }
  
  if (message.type === 'execution') {
    switch (message.event) {
      case 'trading.execution.created':
        console.log('New execution:', message.data.executionId);
        break;
      case 'trading.execution.progress':
        console.log('Progress:', message.data.completion * 100 + '%');
        break;
      case 'trading.execution.completed':
        console.log('Execution completed!');
        break;
    }
  }
  
  if (message.type === 'ping') {
    ws.send(JSON.stringify({ type: 'pong' }));
  }
};
```

### Python

```python
import asyncio
import websockets
import json
import requests

# REST API
def create_execution():
    response = requests.post(
        'http://localhost:3016/api/trading/executor/algorithmic',
        json={
            'symbol': 'ETHUSDT',
            'side': 'SELL',
            'totalQuantity': 50,
            'strategy': 'TWAP',
            'duration': 600,
            'sliceInterval': 60,
        }
    )
    return response.json()['data']

# WebSocket
async def subscribe_executions():
    uri = "ws://localhost:3016/ws"
    async with websockets.connect(uri) as websocket:
        # Authenticate
        await websocket.send(json.dumps({
            'type': 'auth',
            'token': 'user:my-user-id'
        }))
        
        # Wait for auth confirmation
        auth_msg = await websocket.recv()
        print(f"Auth: {auth_msg}")
        
        # Subscribe to executions
        await websocket.send(json.dumps({
            'type': 'subscribe',
            'channels': ['executions']
        }))
        
        # Listen for events
        async for message in websocket:
            data = json.loads(message)
            
            if data['type'] == 'execution':
                print(f"Event: {data['event']}")
                print(f"Data: {data['data']}")
            
            if data['type'] == 'ping':
                await websocket.send(json.dumps({'type': 'pong'}))

# Run
execution = create_execution()
print(f"Created execution: {execution['executionId']}")

asyncio.run(subscribe_executions())
```

---

## 📝 Стратегии

### VWAP (Volume Weighted Average Price)

Распределяет ордер пропорционально историческому объему торгов.

**Когда использовать:**
- Крупные ордера (> 1% дневного объема)
- Длительность: 1+ час
- Есть доступ к volume profile

**Параметры:**
- `duration` (required)
- `volumeProfile` (optional, fallback to TWAP)
- `maxSliceSize` (optional)

### TWAP (Time Weighted Average Price)

Равномерно распределяет ордер во времени.

**Когда использовать:**
- Средние ордера
- Длительность: 5-60 минут
- Нет historical volume data

**Параметры:**
- `duration` (required)
- `sliceInterval` (optional, default: 60s)

### Iceberg Orders

Скрывает общий размер ордера, показывая только visible quantity.

**Когда использовать:**
- Очень крупные ордера
- Необходимость скрыть размер позиции
- Защита от front-running

**Параметры:**
- `visibleQuantity` (required)
- `refreshThreshold` (optional, default: 0.8)

---

## 🔒 Security

### Authentication

WebSocket соединения требуют аутентификации. В production используйте JWT токены.

### Rate Limiting

WebSocket: 10 сообщений в секунду на клиента.

REST API: стандартные rate limits применяются.

---

## ⚠️ Error Handling

### Общие ошибки

| Code | HTTP Status | Описание |
|------|-------------|----------|
| `EXECUTOR_NOT_INITIALIZED` | 503 | Executor не инициализирован |
| `INVALID_REQUEST` | 400 | Некорректные параметры |
| `EXECUTION_NOT_FOUND` | 404 | Execution не найден |
| `ALGORITHMIC_EXECUTION_FAILED` | 500 | Ошибка создания execution |
| `CANCEL_EXECUTION_FAILED` | 500 | Ошибка отмены execution |

### WebSocket ошибки

```json
{
  "type": "error",
  "message": "Authentication required",
  "timestamp": 1728123456789
}
```

---

## 📊 Monitoring

### Execution States

- `PENDING` - Создан, ожидает начала
- `IN_PROGRESS` - Исполняется
- `COMPLETED` - Успешно завершен
- `FAILED` - Провален (> 30% failed slices)
- `PAUSED` - Приостановлен

### Metrics

Отслеживайте:
- `activeAlgorithmicExecutions` - количество активных executions
- `completion` - прогресс исполнения (0-1)
- `failedSlices` - количество failed slices
- `averagePrice` - средняя цена исполнения
- `slippage` - проскальзывание

---

## 🔄 Integration with Frontend

### React Example

```tsx
import { useEffect, useState } from 'react';

function ExecutionMonitor({ executionId }: { executionId: string }) {
  const [execution, setExecution] = useState(null);
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3016/ws');
    
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', token: 'user:me' }));
    };
    
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      
      if (msg.type === 'authenticated') {
        ws.send(JSON.stringify({
          type: 'subscribe',
          channels: ['executions']
        }));
      }
      
      if (msg.type === 'execution' && 
          msg.data.executionId === executionId) {
        setProgress(msg.data.completion || 0);
      }
    };
    
    return () => ws.close();
  }, [executionId]);
  
  return (
    <div>
      <h3>Execution: {executionId}</h3>
      <progress value={progress * 100} max={100} />
      <span>{(progress * 100).toFixed(1)}%</span>
    </div>
  );
}
```

---

**Last Updated:** 5 октября 2025  
**Version:** 1.0.0  
**Contact:** Coffee Trading System

