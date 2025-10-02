# Telega API Reference

Base URL: `http://localhost:3005`

## Channel Management

### Subscribe to Channel

```http
POST /channels/subscribe
Content-Type: application/json

{
  "channelId": "cryptosignalschannel"
}
```

**Response:**

```json
{
  "message": "Successfully subscribed",
  "subscription": {
    "channelId": "cryptosignalschannel",
    "addedAt": "2025-10-04T12:00:00.000Z",
    "active": true
  }
}
```

---

### Unsubscribe from Channel

```http
POST /channels/unsubscribe
Content-Type: application/json

{
  "channelId": "cryptosignalschannel"
}
```

**Response:**

```json
{
  "message": "Successfully unsubscribed",
  "channelId": "cryptosignalschannel"
}
```

---

### List All Channels

```http
GET /channels
```

**Response:**

```json
{
  "subscriptions": [
    {
      "channelId": "cryptosignalschannel",
      "addedAt": "2025-10-04T12:00:00.000Z",
      "active": true
    }
  ],
  "activeChannels": ["cryptosignalschannel"],
  "total": 1,
  "active": 1
}
```

---

### Activate Channel

```http
POST /channels/{channelId}/activate
```

**Response:**

```json
{
  "message": "Channel subscription activated",
  "channelId": "cryptosignalschannel"
}
```

---

### Deactivate Channel

```http
POST /channels/{channelId}/deactivate
```

**Response:**

```json
{
  "message": "Channel subscription deactivated",
  "channelId": "cryptosignalschannel"
}
```

---

## Messages

### Get Channel Messages

```http
GET /channels/{channelId}/messages?limit=10
```

**Query Parameters:**

- `limit` (optional): Number of messages, default 10, max 100

**Response:**

```json
{
  "channelId": "cryptosignalschannel",
  "limit": 10,
  "count": 10,
  "messages": [
    {
      "id": 12345,
      "date": 1696411200,
      "message": "📩 #BTCUSDT 1h | Short-Term...",
      "views": 1234,
      "forwards": 10,
      "editDate": null,
      "fromId": null,
      "peerId": {...}
    }
  ]
}
```

---

### Get Recent Messages from All Channels

```http
GET /channels/messages/recent?limit=5
```

**Query Parameters:**

- `limit` (optional): Messages per channel, default 10, max 100

**Response:**

```json
{
  "channels": [
    {
      "channelId": "cryptosignalschannel",
      "count": 5,
      "messages": [...]
    },
    {
      "channelId": "tradingsignals",
      "count": 5,
      "messages": [...]
    }
  ],
  "total": 2,
  "limitPerChannel": 5,
  "errors": []
}
```

---

## Service Status

### Get Status

```http
GET /status
```

**Response:**

```json
{
  "server": {
    "uptime": 1234.5,
    "memory": {
      "rss": 123456789,
      "heapTotal": 123456789,
      "heapUsed": 123456789
    },
    "timestamp": "2025-10-04T12:00:00.000Z"
  },
  "telegram": {
    "connected": true,
    "isConnecting": false,
    "hasClient": true
  },
  "userbot": {
    "running": true,
    "subscribedChannels": ["cryptosignalschannel", "tradingsignals"]
  },
  "environment": {
    "nodeEnv": "development"
  }
}
```

---

### Health Check

```http
GET /health
```

**Response:**

```json
{
  "status": "running",
  "service": "telega",
  "timestamp": "2025-10-04T12:00:00.000Z",
  "uptime": 1234.5,
  "connections": {
    "userbotRunning": true,
    "telegramConnected": true,
    "telegramConnecting": false,
    "natsConnected": true
  }
}
```

---

## Error Responses

### 400 Bad Request

```json
{
  "error": "channelId is required"
}
```

### 400 Not Subscribed

```json
{
  "error": "Not subscribed to this channel",
  "channelId": "cryptosignalschannel",
  "hint": "Use POST /channels/subscribe to subscribe first"
}
```

### 500 Internal Server Error

```json
{
  "error": "Failed to fetch messages from channel"
}
```

---

## NATS Topic

All messages are published to: `telega.message`

### Message Format

```typescript
{
  channelId: string // Channel ID (without @)
  messageId: number // Telegram message ID
  text: string // Message text
  date: number // Message date (Unix timestamp)
  views: number | null // View count
  forwards: number | null // Forward count
  timestamp: number // Received timestamp (Unix ms)
}
```

---

## Examples

### cURL

```bash
# Subscribe
curl -X POST http://localhost:3005/channels/subscribe \
  -H "Content-Type: application/json" \
  -d '{"channelId": "cryptosignalschannel"}'

# Get messages
curl http://localhost:3005/channels/cryptosignalschannel/messages?limit=10

# Status
curl http://localhost:3005/status
```

### JavaScript/TypeScript

```typescript
// Subscribe
const response = await fetch("http://localhost:3005/channels/subscribe", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ channelId: "cryptosignalschannel" }),
})

// Get messages
const messages = await fetch(
  "http://localhost:3005/channels/cryptosignalschannel/messages?limit=10"
).then((r) => r.json())

// Listen to NATS
import { createNatsClient } from "@aladdin/shared/nats"

const nats = await createNatsClient()
await nats.subscribe("telega.message", (message) => {
  console.log(`[${message.channelId}] ${message.text}`)
})
```

---

## Notes

- Channel IDs should not include `@` symbol
- Maximum 100 messages per request
- Messages are returned newest first
- Subscriptions persist in Redis across restarts
- NATS publishing is fire-and-forget (async)
- No authentication required (use within protected network)
