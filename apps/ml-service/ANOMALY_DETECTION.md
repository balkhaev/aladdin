# Anomaly Detection

## Overview

The Anomaly Detection service identifies unusual market behavior and potential risks in cryptocurrency markets. It detects patterns like pump & dump schemes and flash crash risks, providing early warnings and actionable recommendations.

---

## Anomaly Types

### 1. Pump & Dump Detection

**What it detects:**

- Coordinated price manipulation
- Artificial volume spikes
- Unsustainable price increases

**Indicators analyzed:**

- **Volume Spike** - Sudden increase in trading volume (>100%)
- **Price Increase** - Rapid price appreciation (>10%)
- **Rapidity Score** - How quickly the price is rising
- **Sustainability Score** - Whether the price can hold

**Scoring:**

- 0-30 points: Volume spike analysis
- 0-30 points: Price increase magnitude
- 0-20 points: Speed of price movement
- 0-20 points: Likelihood of reversal (low sustainability)

**Risk Levels:**

- **80-100**: CRITICAL - Very likely pump & dump
- **70-79**: HIGH - Strong indicators
- **60-69**: MEDIUM - Some warning signs
- **50-59**: LOW - Mild concerns

---

### 2. Flash Crash Risk

**What it detects:**

- High liquidation risk
- Order book imbalances
- Potential cascading liquidations

**Indicators analyzed:**

- **Liquidation Risk** - Based on volatility and liquidity
- **Order Book Imbalance** - Sell/buy ratio
- **Market Depth** - Available liquidity at ±2%
- **Cascade Risk** - Probability of liquidation chain reaction

**Scoring:**

- 0-40 points: Liquidation risk level
- 0-30 points: Order book imbalance
- 0-30 points: Low market depth

**Risk Levels:**

- **80-100**: CRITICAL - Imminent crash risk
- **70-79**: HIGH - Dangerous conditions
- **60-69**: MEDIUM - Elevated risk
- **50-59**: LOW - Some risk present

---

## API Usage

### Detect Anomalies

**Endpoint:** `POST /api/ml/anomalies/detect`

**Request:**

```json
{
  "symbol": "BTCUSDT",
  "lookbackMinutes": 60
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "symbol": "BTCUSDT",
    "anomalies": [
      {
        "type": "PUMP_AND_DUMP",
        "severity": "HIGH",
        "confidence": 75.5,
        "timestamp": 1633024800000,
        "symbol": "BTCUSDT",
        "description": "Potential pump & dump detected (76% confidence). Volume spike: 450%, Price increase: 25.3%. Rapid price movement with low sustainability.",
        "metrics": {
          "volumeSpike": 450.2,
          "priceIncrease": 25.3,
          "rapidityScore": 85.0,
          "sustainabilityScore": 35.0,
          "score": 75.5
        },
        "recommendations": [
          "🚨 Avoid buying - high pump & dump risk",
          "Consider taking profits if already in position",
          "Set tight stop losses",
          "Unusual volume spike - exercise caution",
          "Price unlikely to sustain - expect reversal",
          "Extremely rapid price movement - likely manipulation",
          "Monitor for sudden price reversal",
          "Check social media for coordinated activity"
        ]
      }
    ],
    "detectedAt": 1633024800000
  },
  "timestamp": 1633024800000
}
```

---

## Frontend Components

### 1. AnomalyAlertsPanel

**Location:** `apps/web/src/components/ml/anomaly-alerts-panel.tsx`

**Usage:**

```tsx
import { AnomalyAlertsPanel } from "../components/ml/anomaly-alerts-panel"

;<AnomalyAlertsPanel />
```

**Features:**

- Symbol selection
- Lookback period configuration (5-1440 minutes)
- Auto-refresh (every minute)
- Real-time detection
- Error handling

---

### 2. AnomalyAlertCard

**Location:** `apps/web/src/components/ml/anomaly-alert-card.tsx`

**Usage:**

```tsx
import { AnomalyAlertCard } from "../components/ml/anomaly-alert-card"

;<AnomalyAlertCard anomaly={anomalyData} />
```

**Features:**

- Color-coded severity (red/orange/yellow/blue)
- Confidence progress bar
- Icon for anomaly type
- Recommendations list
- Timestamp

---

## React Query Hooks

### useDetectAnomalies

**Location:** `apps/web/src/hooks/use-anomaly-detection.ts`

**Usage:**

```tsx
import { useDetectAnomalies } from "../hooks/use-anomaly-detection"

const { data, isLoading, error, refetch } = useDetectAnomalies(
  {
    symbol: "BTCUSDT",
    lookbackMinutes: 60,
  },
  {
    enabled: true,
    refetchInterval: 60000, // Refresh every minute
  }
)
```

---

## Recommendations

### Pump & Dump

**CRITICAL/HIGH Severity:**

- 🚨 Avoid buying - high manipulation risk
- Take profits if already in position
- Set tight stop-loss orders
- Expect sudden price reversal

**MEDIUM Severity:**

- Exercise caution with new positions
- Monitor volume and price closely
- Check social media for coordination

**LOW Severity:**

- Normal monitoring
- Be aware of elevated activity

---

### Flash Crash Risk

**CRITICAL/HIGH Severity:**

- 🚨 Reduce position size immediately
- Use stop-limit orders (not stop-market)
- Avoid high leverage
- Consider hedging with options

**MEDIUM Severity:**

- Monitor funding rates
- Reduce leverage if needed
- Watch order book depth

**LOW Severity:**

- Normal risk management
- Be aware of liquidation levels

---

## Algorithm Details

### Pump & Dump Detection

```typescript
// Volume spike calculation
avgRecentVolume = sum(last 10 candles) / 10
avgOldVolume = sum(older candles) / count
volumeSpike = ((avgRecentVolume - avgOldVolume) / avgOldVolume) * 100

// Price momentum
priceIncrease = ((lastPrice - firstPrice) / firstPrice) * 100

// Rapidity score (0-100)
maxPriceChange = max(|priceChange per minute|)
rapidityScore = min(maxPriceChange * 10, 100)

// Sustainability score (0-100)
priceStd = standardDeviation(recent prices)
sustainabilityScore = max(0, 100 - (priceStd / avgPrice) * 100)

// Final score (0-100)
score = volumeWeight * volumeScore
      + priceWeight * priceScore
      + rapidityWeight * rapidityScore
      + (100 - sustainabilityScore) * sustainabilityWeight
```

---

### Flash Crash Risk

```typescript
// Volatility calculation
returns = log(price[i] / price[i - 1])
volatility = standardDeviation(returns) * sqrt(periods)

// Liquidation risk (0-100)
liquidationRisk = min((volatility * 100) / (marketDepth / 100000), 100)

// Cascade risk (0-100)
cascadeRisk = liquidationRisk * 0.6 + (orderBookImbalance > 1.5 ? 40 : 0)

// Final score (0-100)
score =
  liquidationWeight * liquidationRisk +
  imbalanceWeight * imbalanceScore +
  depthWeight * depthScore
```

---

## Configuration

### Lookback Period

- **5-15 minutes**: Very short-term, high sensitivity
- **30-60 minutes**: Medium-term, balanced (recommended)
- **120-240 minutes**: Long-term, lower sensitivity
- **1440 minutes (24h)**: Daily analysis

### Thresholds

**Volume Spike:**

- > 500%: Very high risk
- > 300%: High risk
- > 200%: Medium risk
- > 100%: Low risk

**Price Increase:**

- > 50%: Very high risk
- > 30%: High risk
- > 20%: Medium risk
- > 10%: Low risk

**Liquidation Risk:**

- > 70%: Critical
- > 50%: High
- > 30%: Medium
- > 20%: Low

---

## Limitations

### Current

1. **No Social Media Integration** - socialMediaBuzz always 0
2. **No Whale Detection** - whaleActivity always false
3. **Simplified Order Book** - mock data for imbalance/depth
4. **No Real Liquidation Data** - estimated from volatility

### Future Enhancements

1. **Twitter/Reddit Integration** - Real social sentiment
2. **On-chain Whale Tracking** - Large transfers detection
3. **Order Book Integration** - Real-time depth/imbalance
4. **Exchange Liquidation Data** - Actual liquidation levels
5. **Multi-exchange Analysis** - Cross-exchange manipulation
6. **Historical Pattern Matching** - ML-based detection
7. **Alert System** - Push notifications for anomalies
8. **Backtesting** - Historical anomaly detection accuracy

---

## Best Practices

### For Traders

1. **Don't Ignore Warnings** - Take CRITICAL/HIGH alerts seriously
2. **Use Stop Losses** - Always protect downside
3. **Verify Manually** - Check charts and order books
4. **Multiple Timeframes** - Look at different lookback periods
5. **Risk Management** - Never risk more than you can lose

### For Developers

1. **Regular Updates** - Keep detection algorithms current
2. **Monitor Performance** - Track false positives/negatives
3. **User Feedback** - Gather trader input on alerts
4. **Test Thoroughly** - Backtest on historical data
5. **Document Changes** - Log algorithm modifications

---

## Examples

### High-Risk Pump & Dump

```
Symbol: SHITCOIN
Volume Spike: 850%
Price Increase: 45%
Rapidity: 92/100
Sustainability: 12/100
Score: 88/100 (CRITICAL)

Recommendations:
- DO NOT BUY
- Exit immediately if holding
- Likely coordinated pump
- Dump expected within minutes
```

### Flash Crash Warning

```
Symbol: BTCUSDT
Liquidation Risk: 85%
Order Book Imbalance: 2.5x
Market Depth: $250K
Volatility: Very High
Score: 82/100 (CRITICAL)

Recommendations:
- Reduce leverage NOW
- Set stop-limit orders
- Expect 10-20% cascade drop
- High liquidation risk
```

---

## Credits

Built with:

- **ClickHouse** - Historical data analysis
- **TypeScript** - Type safety
- **Zod** - Schema validation
- **React Query** - Data fetching
- **Lucide Icons** - UI icons
