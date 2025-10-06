/**
 * Общие типы для всей платформы Aladdin
 */

// ============ Рыночные данные ============

export type Tick = {
  timestamp: number;
  symbol: string;
  price: number;
  volume: number;
  exchange: string;
  bid: number;
  ask: number;
  bidVolume: number;
  askVolume: number;
};

export type Candle = {
  timestamp: number;
  symbol: string;
  timeframe: Timeframe;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
  trades: number;
  exchange: string;
};

export type Timeframe = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d" | "1w";

export type OrderBook = {
  symbol: string;
  exchange: string;
  timestamp: number;
  bids: [number, number][]; // [price, volume][]
  asks: [number, number][];
};

export type AggTrade = {
  timestamp: number; // Event time in milliseconds
  symbol: string;
  tradeId: number;
  price: number;
  quantity: number;
  isBuyerMaker: boolean;
  exchange: string;
};

// ============ Торговля ============

export type OrderType =
  | "MARKET"
  | "LIMIT"
  | "STOP_LOSS"
  | "TAKE_PROFIT"
  | "STOP_LOSS_LIMIT"
  | "TAKE_PROFIT_LIMIT";
export type OrderSide = "BUY" | "SELL";
export type OrderStatus =
  | "PENDING"
  | "OPEN"
  | "FILLED"
  | "PARTIALLY_FILLED"
  | "CANCELLED"
  | "REJECTED"
  | "EXPIRED";
export type PositionSide = "LONG" | "SHORT";

export type Order = {
  id: string;
  userId: string;
  portfolioId?: string;
  symbol: string;
  type: OrderType;
  side: OrderSide;
  quantity: number;
  price?: number;
  stopPrice?: number;
  status: OrderStatus;
  filledQty: number;
  avgPrice?: number;
  exchange: string;
  exchangeOrderId?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type Trade = {
  id: string;
  orderId: string;
  portfolioId: string;
  userId: string;
  symbol: string;
  side: OrderSide;
  price: number;
  quantity: number;
  quoteQuantity: number;
  fee: number;
  feeCurrency: string;
  exchange: string;
  isMaker: boolean;
  timestamp: Date;
};

export type Position = {
  id: string;
  portfolioId: string;
  symbol: string;
  quantity: number;
  entryPrice: number;
  averagePrice: number;
  currentPrice: number;
  value: number;
  pnl: number;
  pnlPercent: number;
  side: PositionSide;
  createdAt: Date;
  updatedAt: Date;
};

// ============ Портфель ============

export type Portfolio = {
  id: string;
  userId: string;
  name: string;
  balance: number;
  initialBalance: number;
  currency: string;
  totalValue: number;
  totalPnl: number;
  totalPnlPercent: number;
  positions: Position[];
  createdAt: Date;
  updatedAt: Date;
};

export type PortfolioSnapshot = {
  timestamp: Date;
  portfolioId: string;
  userId: string;
  totalValue: number;
  totalPnl: number;
  dailyPnl: number;
  positions: Position[];
  balances: Record<string, number>;
};

export type Balance = {
  asset: string;
  free: number;
  locked: number;
  total: number;
};

// ============ Риски ============

export type RiskMetrics = {
  timestamp: Date;
  portfolioId: string;
  userId: string;
  var95: number; // Value at Risk 95%
  var99: number; // Value at Risk 99%
  sharpeRatio: number;
  maxDrawdown: number;
  leverage: number;
  exposure: number;
  marginUsed: number;
  marginAvailable: number;
};

export type RiskLimit = {
  id: string;
  userId: string;
  portfolioId?: string;
  type: "MAX_LEVERAGE" | "MAX_POSITION_SIZE" | "MAX_DAILY_LOSS" | "MIN_MARGIN";
  value: number;
  enabled: boolean;
};

export type RiskAlert = {
  id: string;
  portfolioId: string;
  userId: string;
  type: "HIGH_RISK" | "MARGIN_CALL" | "LIMIT_EXCEEDED";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  message: string;
  data: Record<string, unknown>;
  timestamp: Date;
  acknowledged: boolean;
};

// ============ Аналитика ============

export type TechnicalIndicator = {
  timestamp: number;
  symbol: string;
  indicator: string;
  value: number | Record<string, number>;
};

export type Signal = {
  id: string;
  timestamp: Date;
  symbol: string;
  type: "BUY" | "SELL" | "HOLD";
  strength: number; // 0-100
  indicators: string[];
  reason: string;
};

export type BacktestResult = {
  id: string;
  strategyName: string;
  symbol: string;
  timeframe: Timeframe;
  startDate: Date;
  endDate: Date;
  initialBalance: number;
  finalBalance: number;
  totalReturn: number;
  totalReturnPercent: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  totalTrades: number;
  profitableTrades: number;
  losingTrades: number;
  averageProfit: number;
  averageLoss: number;
  profitFactor: number;
};

// ============ NATS Messages ============

export type MarketTickMessage = {
  type: "market.tick";
  data: Tick;
};

export type OrderCreatedMessage = {
  type: "trading.order.created";
  data: Order;
};

export type OrderFilledMessage = {
  type: "trading.order.filled";
  data: {
    order: Order;
    trades: Trade[];
  };
};

export type PositionUpdatedMessage = {
  type: "trading.position.updated";
  data: Position;
};

export type PortfolioBalanceUpdatedMessage = {
  type: "portfolio.balance.updated";
  data: {
    portfolioId: string;
    balance: number;
    totalValue: number;
  };
};

export type RiskAlertMessage = {
  type: "risk.alert";
  data: RiskAlert;
};

// ============ HTTP Responses ============

export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: number;
};

export type PaginatedResponse<T = unknown> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
};

// ============ On-Chain Metrics ============

export type WhaleTransaction = {
  transactionHash: string;
  timestamp: number;
  from: string;
  to: string;
  value: number;
  blockchain: string;
};

export type ExchangeFlow = {
  inflow: number;
  outflow: number;
  netFlow: number;
};

export type OnChainMetrics = {
  timestamp: number;
  blockchain: string;
  whaleTransactions: {
    count: number;
    totalVolume: number;
  };
  exchangeFlow: ExchangeFlow;
  activeAddresses: number;
  nvtRatio: number;
  marketCap?: number;
  transactionVolume: number;

  // Advanced on-chain metrics (optional)
  // MVRV Ratio - Market Value to Realized Value
  // Indicates if asset is overvalued (>3.7) or undervalued (<1)
  mvrvRatio?: number;

  // SOPR - Spent Output Profit Ratio
  // >1 means profit-taking, <1 means selling at loss
  sopr?: number;

  // Puell Multiple - Mining revenue relative to 365-day MA
  // Used to identify market cycle tops and bottoms
  puellMultiple?: number;

  // Stock-to-Flow Ratio (BTC only)
  // Scarcity model: higher = more scarce
  stockToFlow?: number;

  // NUPL - Net Unrealized Profit/Loss
  // Network-wide unrealized profit/loss
  nupl?: number;

  // Exchange Reserve - Total balance on exchanges
  // Lower reserves = less selling pressure
  exchangeReserve?: number;

  // Reserve Risk - Price risk relative to HODL confidence
  // Lower = accumulation zone, Higher = distribution zone
  // Formula: (Market Cap / Realized Cap) * (1 - accumulation_score)
  reserveRisk?: number;

  // Accumulation Trend Score - Multi-timeframe accumulation analysis
  // Score: -100 (strong distribution) to +100 (strong accumulation)
  accumulationTrend?: {
    score: number; // -100 to +100
    trend7d: number; // 7-day trend
    trend30d: number; // 30-day trend
    trend90d: number; // 90-day trend
  };

  // HODL Waves - Distribution of realized cap by UTXO age
  // Percentages of total supply by age cohort
  hodlWaves?: {
    under1m: number; // <1 month
    m1to3: number; // 1-3 months
    m3to6: number; // 3-6 months
    m6to12: number; // 6-12 months
    y1to2: number; // 1-2 years
    y2to3: number; // 2-3 years
    y3to5: number; // 3-5 years
    over5y: number; // 5+ years
  };

  // Binary CDD (Coin Days Destroyed)
  // True if old coins are moving (capitulation or distribution signal)
  binaryCDD?: boolean;
};

/**
 * Whale alert types
 */
export type WhaleAlertType =
  | "whale_tx"
  | "exchange_inflow"
  | "exchange_outflow"
  | "large_transfer";

/**
 * Whale alert event
 */
export type WhaleAlert = {
  id?: string;
  timestamp: number;
  blockchain: string;
  alertType: WhaleAlertType;
  transactionHash: string;
  value: number;
  fromAddress: string;
  toAddress: string;
  exchange?: string;
  isInflow?: boolean;
  usdValue?: number;
};

/**
 * Exchange flow detail with address tracking
 */
export type ExchangeFlowDetail = {
  exchange: string;
  blockchain: string;
  inflow: number;
  outflow: number;
  netFlow: number;
  inflowTxCount: number;
  outflowTxCount: number;
  timestamp: number;
};

// ============ Системные события ============

export type SystemEvent = {
  timestamp: Date;
  eventType: string;
  service: string;
  severity: "DEBUG" | "INFO" | "WARN" | "ERROR";
  userId?: string;
  message: string;
  data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};
