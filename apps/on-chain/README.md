# On-Chain Sentiment Service

Microservice for tracking blockchain on-chain metrics and sentiment indicators.

## Quick Start

```bash
# Install dependencies
bun install

# Copy environment variables
cp .env.example .env

# Add your API keys to .env:
# - ETHERSCAN_API_KEY (get from https://etherscan.io/apis)
# - CMC_API_KEY (get from https://coinmarketcap.com/api/)

# Start development server
bun run dev

# Or from root
bun run dev:on-chain
```

## Features

- 🐋 **Whale Transaction Tracking** - Monitor large transactions (>10 BTC, >100 ETH)
- 💱 **Exchange Flow Analysis** - Track crypto moving in/out of exchanges
- 👥 **Active Address Metrics** - Count unique active addresses (24h)
- 📈 **NVT Ratio** - Network Value to Transactions ratio for valuation
- 💰 **Market Cap Integration** - Real-time market cap from CoinMarketCap
- 🕐 **Periodic Updates** - Automatic data fetching every 5-15 minutes
- 💾 **ClickHouse Storage** - Efficient time-series data storage
- 📡 **NATS Events** - Real-time metric updates via message bus

## Supported Blockchains

- Bitcoin (BTC)
- Ethereum (ETH)

More chains can be added by creating new fetchers in `src/fetchers/`.

## API Endpoints

- `GET /health` - Health check
- `GET /api/on-chain/metrics/:blockchain` - Historical metrics
- `GET /api/on-chain/metrics/latest/:blockchain` - Latest metrics
- `GET /api/on-chain/overview` - All chains overview
- `GET /api/on-chain/exchange-flows/:blockchain` - Exchange flow aggregates
- `GET /api/on-chain/status` - Scheduler status

## Architecture

```
src/
├── index.ts                 # Main entry point
├── fetchers/                # Blockchain data fetchers
│   ├── base.ts             # Abstract base with rate limiting
│   ├── bitcoin.ts          # Bitcoin fetcher (Blockchair API)
│   ├── ethereum.ts         # Ethereum fetcher (Etherscan API)
│   └── types.ts            # Fetcher interfaces
├── services/
│   ├── scheduler.ts        # Periodic metric fetching
│   └── market-cap-provider.ts  # CoinMarketCap integration
├── validation/
│   └── schemas.ts          # Zod validation schemas
└── middleware/
    └── validation.ts       # Request validation middleware
```

## Configuration

Key environment variables:

```bash
PORT=3015                        # Service port
UPDATE_INTERVAL_MS=300000        # Update interval (5 minutes)
WHALE_THRESHOLD_BTC=10           # BTC whale threshold
WHALE_THRESHOLD_ETH=100          # ETH whale threshold
ENABLED_CHAINS=BTC,ETH           # Comma-separated chain list
```

## NATS Events

The service publishes metrics to:

- `on-chain.metrics.btc` - Bitcoin metrics
- `on-chain.metrics.eth` - Ethereum metrics

## Free API Tiers

- **Blockchair**: 30 req/min (no auth)
- **Etherscan**: 5 req/sec, 100k req/day
- **CoinMarketCap**: 10k req/month

## Documentation

Full documentation: [/docs/ON_CHAIN.md](../../docs/ON_CHAIN.md)

## Development

```bash
# Watch mode
bun --watch src/index.ts

# Build
bun run build

# Start production
bun run start
```

## License

Part of the Aladdin trading platform.
