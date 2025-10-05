import { BaseService } from "@aladdin/service";
import { NotFoundError } from "@aladdin/http/errors";
import type { Candle } from "@aladdin/core";

/**
 * Format date to ClickHouse DateTime format (YYYY-MM-DD HH:MM:SS)
 */
function formatDateForClickHouse(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export type TechnicalIndicators = {
  symbol: string;
  timestamp: Date;
  RSI?: {
    value: number;
    signal: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL";
  };
  MACD?: {
    macd: number;
    signal: number;
    histogram: number;
  };
  EMA?: {
    ema12: number;
    ema26: number;
  };
  SMA?: {
    sma20: number;
    sma50: number;
    sma200: number;
  };
  BB?: {
    upper: number;
    middle: number;
    lower: number;
    bandwidth: number;
  };
};

export type StatisticsResult = {
  totalTrades: number;
  totalVolume: number;
  totalPnL: number;
  winRate: number;
  avgProfit: number;
  avgLoss: number;
  sharpeRatio: number;
  maxDrawdown: number;
};

export type BacktestResult = {
  strategy: string;
  symbol: string;
  from: string;
  to: string;
  initialBalance: number;
  finalBalance: number;
  totalReturn: number;
  totalReturnPercent: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  trades: Array<{
    timestamp: Date;
    type: "BUY" | "SELL";
    price: number;
    quantity: number;
    pnl?: number;
  }>;
};

/**
 * Analytics Service - технические индикаторы и анализ
 */
export class AnalyticsService extends BaseService {
  getServiceName(): string {
    return "analytics";
  }

  /**
   * Get cache service (публичный метод для использования в routes)
   */
  getCache(keyPrefix?: string, defaultTTL?: number) {
    return this.getCacheService(keyPrefix, defaultTTL);
  }

  protected onInit(): Promise<void> {
    if (!this.clickhouse) {
      throw new Error("ClickHouse is required for Analytics Service");
    }
    this.logger.info("Analytics Service initialized");
    return Promise.resolve();
  }

  protected onHealthCheck(): Promise<Record<string, boolean>> {
    return Promise.resolve({
      clickhouse: this.clickhouse !== undefined,
    });
  }

  /**
   * Calculate technical indicators for a symbol
   */
  async calculateIndicators(
    symbol: string,
    indicators: string[],
    timeframe: string,
    limit: number
  ): Promise<TechnicalIndicators> {
    this.logger.info("Calculating indicators", {
      symbol,
      indicators,
      timeframe,
    });

    // Get candles from ClickHouse
    const candles = await this.getCandles(symbol, timeframe, limit);

    if (candles.length === 0) {
      throw new NotFoundError(`Candle data for ${symbol}`);
    }

    const result: TechnicalIndicators = {
      symbol,
      timestamp: new Date(),
    };

    // Calculate requested indicators
    for (const indicator of indicators) {
      if (indicator === "RSI") {
        result.RSI = this.calculateRSI(candles);
      } else if (indicator === "MACD") {
        result.MACD = this.calculateMACD(candles);
      } else if (indicator === "EMA") {
        result.EMA = this.calculateEMA(candles);
      } else if (indicator === "SMA") {
        result.SMA = this.calculateSMA(candles);
      } else if (indicator === "BB") {
        result.BB = this.calculateBollingerBands(candles);
      }
    }

    return result;
  }

  /**
   * Calculate RSI (Relative Strength Index)
   */
  private calculateRSI(
    candles: Candle[],
    period = 14
  ): TechnicalIndicators["RSI"] {
    if (candles.length < period + 1) {
      throw new Error(
        `Not enough data for RSI calculation (need ${period + 1} candles)`
      );
    }

    // Calculate price changes
    const changes: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      changes.push(candles[i].close - candles[i - 1].close);
    }

    // Separate gains and losses
    const gains = changes.map((change) => (change > 0 ? change : 0));
    const losses = changes.map((change) => (change < 0 ? Math.abs(change) : 0));

    // Calculate average gains and losses
    const avgGain =
      gains.slice(-period).reduce((sum, gain) => sum + gain, 0) / period;
    const avgLoss =
      losses.slice(-period).reduce((sum, loss) => sum + loss, 0) / period;

    // Calculate RS and RSI
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);

    // Determine signal
    let signal: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL" = "NEUTRAL";
    if (rsi > 70) {
      signal = "OVERBOUGHT";
    } else if (rsi < 30) {
      signal = "OVERSOLD";
    }

    return { value: rsi, signal };
  }

  /**
   * Calculate MACD (Moving Average Convergence Divergence)
   */
  private calculateMACD(candles: Candle[]): TechnicalIndicators["MACD"] {
    const closes = candles.map((c) => c.close);

    // Calculate EMA12 and EMA26 for all periods
    const ema12Values: number[] = [];
    const ema26Values: number[] = [];

    for (let i = 0; i < closes.length; i++) {
      ema12Values.push(this.calculateEMAValue(closes.slice(0, i + 1), 12));
      ema26Values.push(this.calculateEMAValue(closes.slice(0, i + 1), 26));
    }

    // MACD line = EMA12 - EMA26
    const macdValues = ema12Values.map((ema12, i) => ema12 - ema26Values[i]);

    // Signal line - 9-period EMA of MACD values
    const signal = this.calculateEMAValue(macdValues, 9);
    const macd = macdValues.at(-1) ?? 0;

    // Histogram = MACD - Signal
    const histogram = macd - signal;

    return { macd, signal, histogram };
  }

  /**
   * Calculate EMA (Exponential Moving Average)
   */
  private calculateEMA(candles: Candle[]): TechnicalIndicators["EMA"] {
    const closes = candles.map((c) => c.close);

    const ema12 = this.calculateEMAValue(closes, 12);
    const ema26 = this.calculateEMAValue(closes, 26);

    return { ema12, ema26 };
  }

  /**
   * Calculate SMA (Simple Moving Average)
   */
  private calculateSMA(candles: Candle[]): TechnicalIndicators["SMA"] {
    const closes = candles.map((c) => c.close);

    const sma20 = this.calculateSMAValue(closes, 20);
    const sma50 = this.calculateSMAValue(closes, 50);
    const sma200 = this.calculateSMAValue(closes, 200);

    return { sma20, sma50, sma200 };
  }

  /**
   * Calculate Bollinger Bands
   */
  private calculateBollingerBands(
    candles: Candle[],
    period = 20,
    stdDev = 2
  ): TechnicalIndicators["BB"] {
    const closes = candles.map((c) => c.close);
    const recentCloses = closes.slice(-period);

    // Middle band (SMA)
    const middle = this.calculateSMAValue(closes, period);

    // Calculate standard deviation
    const variance =
      recentCloses.reduce((sum, close) => sum + (close - middle) ** 2, 0) /
      period;
    const standardDeviation = Math.sqrt(variance);

    // Upper and lower bands
    const upper = middle + stdDev * standardDeviation;
    const lower = middle - stdDev * standardDeviation;

    // Bandwidth
    const bandwidth = ((upper - lower) / middle) * 100;

    return { upper, middle, lower, bandwidth };
  }

  /**
   * Helper: Calculate EMA value
   */
  private calculateEMAValue(values: number[], period: number): number {
    if (values.length < period) {
      // Not enough data, return last value
      return values.at(-1) ?? 0;
    }

    const multiplier = 2 / (period + 1);
    let ema = this.calculateSMAValue(values.slice(0, period), period);

    // Calculate EMA for remaining values
    for (let i = period; i < values.length; i++) {
      ema = (values[i] - ema) * multiplier + ema;
    }

    return ema;
  }

  /**
   * Helper: Calculate SMA value
   */
  private calculateSMAValue(values: number[], period: number): number {
    const recentValues = values.slice(-period);
    const sum = recentValues.reduce((total, value) => total + value, 0);
    return sum / recentValues.length;
  }

  /**
   * Get candles from ClickHouse
   */
  private async getCandles(
    symbol: string,
    timeframe: string,
    limit: number
  ): Promise<Candle[]> {
    const query = `
      SELECT 
        timestamp,
        symbol,
        open,
        high,
        low,
        close,
        volume
      FROM aladdin.candles
      WHERE symbol = {symbol:String}
        AND timeframe = {timeframe:String}
      ORDER BY timestamp DESC
      LIMIT {limit:UInt32}
    `;

    const data = await this.clickhouse.query<{
      timestamp: string;
      symbol: string;
      timeframe: string;
      open: string;
      high: string;
      low: string;
      close: string;
      volume: string;
    }>(query, { symbol, timeframe, limit });

    return data
      .map((row) => ({
        timestamp: new Date(row.timestamp),
        symbol: row.symbol,
        timeframe: row.timeframe,
        open: Number.parseFloat(row.open),
        high: Number.parseFloat(row.high),
        low: Number.parseFloat(row.low),
        close: Number.parseFloat(row.close),
        volume: Number.parseFloat(row.volume),
      }))
      .reverse(); // Reverse to get chronological order
  }

  /**
   * Get statistics for a portfolio
   */
  async getStatistics(
    portfolioId: string,
    from: Date,
    to: Date
  ): Promise<StatisticsResult> {
    this.logger.info("Getting statistics", { portfolioId, from, to });

    // Get trades from ClickHouse
    const query = `
      SELECT 
        price,
        quantity,
        side,
        pnl
      FROM aladdin.trades
      WHERE portfolioId = {portfolioId:String}
        AND timestamp >= {from:DateTime}
        AND timestamp <= {to:DateTime}
      ORDER BY timestamp ASC
    `;

    const trades = await this.clickhouse.query<{
      price: string;
      quantity: string;
      side: string;
      pnl: string;
    }>(query, {
      portfolioId,
      from: formatDateForClickHouse(from),
      to: formatDateForClickHouse(to),
    });

    // Calculate statistics
    const totalTrades = trades.length;
    const totalVolume = trades.reduce(
      (sum: number, t: { quantity: string }) =>
        sum + Number.parseFloat(t.quantity),
      0
    );
    const totalPnL = trades.reduce(
      (sum: number, t: { pnl: string }) =>
        sum + Number.parseFloat(t.pnl || "0"),
      0
    );

    const winningTrades = trades.filter(
      (t: { pnl: string }) => Number.parseFloat(t.pnl || "0") > 0
    );
    const losingTrades = trades.filter(
      (t: { pnl: string }) => Number.parseFloat(t.pnl || "0") < 0
    );

    const winRate =
      totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;

    const avgProfit =
      winningTrades.length > 0
        ? winningTrades.reduce(
            (sum: number, t: { pnl: string }) => sum + Number.parseFloat(t.pnl),
            0
          ) / winningTrades.length
        : 0;

    const avgLoss =
      losingTrades.length > 0
        ? losingTrades.reduce(
            (sum: number, t: { pnl: string }) => sum + Number.parseFloat(t.pnl),
            0
          ) / losingTrades.length
        : 0;

    // Calculate returns from P&L values
    const returns = trades
      .map((t: { pnl: string }) => Number.parseFloat(t.pnl || "0"))
      .filter((pnl) => pnl !== 0);

    // Calculate Sharpe ratio
    const sharpeRatio = this.calculateSharpeRatio(returns);

    // Get portfolio snapshots for max drawdown
    const snapshotsQuery = `
      SELECT 
        totalValue
      FROM aladdin.portfolio_snapshots
      WHERE portfolioId = {portfolioId:String}
        AND timestamp >= {from:DateTime}
        AND timestamp <= {to:DateTime}
      ORDER BY timestamp ASC
    `;

    const snapshots = await this.clickhouse.query<{
      totalValue: string;
    }>(snapshotsQuery, {
      portfolioId,
      from: formatDateForClickHouse(from),
      to: formatDateForClickHouse(to),
    });

    const portfolioValues = snapshots.map((s) =>
      Number.parseFloat(s.totalValue)
    );
    const maxDrawdown = this.calculateMaxDrawdown(portfolioValues);

    return {
      totalTrades,
      totalVolume,
      totalPnL,
      winRate,
      avgProfit,
      avgLoss,
      sharpeRatio,
      maxDrawdown,
    };
  }

  /**
   * Run backtest for a trading strategy
   */
  async runBacktest(
    symbol: string,
    strategy: string,
    from: Date,
    to: Date,
    initialBalance: number,
    parameters?: Record<string, string | number>
  ): Promise<BacktestResult> {
    this.logger.info("Running backtest", { symbol, strategy, from, to });

    // Get historical candles
    const candles = await this.getHistoricalCandles(symbol, from, to);

    if (candles.length === 0) {
      throw new NotFoundError(`Historical data for ${symbol}`);
    }

    // Initialize backtest state
    let balance = initialBalance;
    let position = 0;
    let entryPrice = 0;
    const trades: BacktestResult["trades"] = [];

    // Run strategy on historical data
    for (let i = 50; i < candles.length; i++) {
      const currentCandles = candles.slice(0, i + 1);
      const currentPrice = currentCandles[i].close;

      // Generate trading signal based on strategy
      const signal = this.generateStrategySignal(
        strategy,
        currentCandles,
        parameters
      );

      // Execute trades based on signal
      if (signal === "BUY" && position === 0 && balance > 0) {
        // Enter long position
        const quantity = balance / currentPrice;
        position = quantity;
        entryPrice = currentPrice;
        balance = 0;

        trades.push({
          timestamp: currentCandles[i].timestamp,
          type: "BUY",
          price: currentPrice,
          quantity,
        });
      } else if (signal === "SELL" && position > 0) {
        // Exit long position
        const saleQuantity = position; // Save quantity before zeroing
        const saleValue = saleQuantity * currentPrice;
        const pnl = saleValue - saleQuantity * entryPrice;
        balance = saleValue;
        position = 0;

        trades.push({
          timestamp: currentCandles[i].timestamp,
          type: "SELL",
          price: currentPrice,
          quantity: saleQuantity, // Use saved quantity
          pnl,
        });
      }
    }

    // Close any open position at the end
    if (position > 0) {
      const lastCandle = candles.at(-1);
      if (!lastCandle) {
        throw new Error("No candles available to close position");
      }

      const finalPrice = lastCandle.close;
      const finalQuantity = position; // Save quantity before zeroing
      const saleValue = finalQuantity * finalPrice;
      const pnl = saleValue - finalQuantity * entryPrice;
      balance = saleValue;
      position = 0;

      trades.push({
        timestamp: lastCandle.timestamp,
        type: "SELL",
        price: finalPrice,
        quantity: finalQuantity, // Use saved quantity
        pnl,
      });
    }

    // Calculate results
    const finalBalance = balance;
    const totalReturn = finalBalance - initialBalance;
    const totalReturnPercent = (totalReturn / initialBalance) * 100;

    const winningTrades = trades.filter((t) => (t.pnl ?? 0) > 0);
    const losingTrades = trades.filter((t) => (t.pnl ?? 0) < 0);
    const winRate =
      trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;

    // Calculate portfolio values over time for drawdown and returns
    const portfolioValues: number[] = [initialBalance];
    let currentBalance = initialBalance;
    let currentPosition = 0;

    for (const trade of trades) {
      if (trade.type === "BUY") {
        currentBalance -= trade.quantity * trade.price;
        currentPosition = trade.quantity;
      } else {
        currentBalance += trade.quantity * trade.price;
        currentPosition = 0;
      }

      // Calculate total portfolio value
      const portfolioValue =
        currentBalance +
        currentPosition * (candles.at(-1)?.close ?? trade.price);
      portfolioValues.push(portfolioValue);
    }

    // Calculate returns from portfolio values
    const returns: number[] = [];
    for (let i = 1; i < portfolioValues.length; i++) {
      const returnValue =
        (portfolioValues[i] - portfolioValues[i - 1]) / portfolioValues[i - 1];
      returns.push(returnValue);
    }

    // Calculate Sharpe ratio and max drawdown
    const sharpeRatio = this.calculateSharpeRatio(returns);
    const maxDrawdown = this.calculateMaxDrawdown(portfolioValues);

    return {
      strategy,
      symbol,
      from: from.toISOString(),
      to: to.toISOString(),
      initialBalance,
      finalBalance,
      totalReturn,
      totalReturnPercent,
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate,
      maxDrawdown,
      sharpeRatio,
      trades,
    };
  }

  /**
   * Generate trading signal based on strategy
   */
  private generateStrategySignal(
    strategy: string,
    candles: Candle[],
    _parameters?: Record<string, string | number>
  ): "BUY" | "SELL" | "HOLD" {
    if (strategy === "SMA_CROSS") {
      // SMA crossover strategy
      const sma = this.calculateSMA(candles);
      const lastCandle = candles.at(-1);
      if (!lastCandle) return "HOLD"; // Return valid value instead of null

      const currentPrice = lastCandle.close;

      if (currentPrice > sma.sma50) {
        return "BUY";
      }
      if (currentPrice < sma.sma50) {
        return "SELL";
      }
    } else if (strategy === "RSI_OVERSOLD") {
      // RSI oversold strategy
      const rsi = this.calculateRSI(candles);

      if (rsi.signal === "OVERSOLD") {
        return "BUY";
      }
      if (rsi.signal === "OVERBOUGHT") {
        return "SELL";
      }
    } else if (strategy === "MACD_CROSS") {
      // MACD crossover strategy
      const macd = this.calculateMACD(candles);

      if (macd.histogram > 0) {
        return "BUY";
      }
      if (macd.histogram < 0) {
        return "SELL";
      }
    } else if (strategy === "BB_BOUNCE") {
      // Bollinger Bands bounce strategy
      const bb = this.calculateBollingerBands(candles);
      const lastCandle = candles.at(-1);
      if (!lastCandle) return "HOLD"; // Return valid value instead of null

      const currentPrice = lastCandle.close;

      if (currentPrice < bb.lower) {
        return "BUY";
      }
      if (currentPrice > bb.upper) {
        return "SELL";
      }
    }

    return "HOLD";
  }

  /**
   * Get historical candles from ClickHouse
   */
  private async getHistoricalCandles(
    symbol: string,
    from: Date,
    to: Date
  ): Promise<Candle[]> {
    const query = `
      SELECT 
        timestamp,
        symbol,
        timeframe,
        open,
        high,
        low,
        close,
        volume
      FROM aladdin.candles
      WHERE symbol = {symbol:String}
        AND timestamp >= {from:DateTime}
        AND timestamp <= {to:DateTime}
      ORDER BY timestamp ASC
    `;

    const data = await this.clickhouse.query<{
      timestamp: string;
      symbol: string;
      timeframe: string;
      open: string;
      high: string;
      low: string;
      close: string;
      volume: string;
    }>(query, {
      symbol,
      from: formatDateForClickHouse(from),
      to: formatDateForClickHouse(to),
    });

    return data.map((row) => ({
      timestamp: new Date(row.timestamp),
      symbol: row.symbol,
      timeframe: row.timeframe,
      open: Number.parseFloat(row.open),
      high: Number.parseFloat(row.high),
      low: Number.parseFloat(row.low),
      close: Number.parseFloat(row.close),
      volume: Number.parseFloat(row.volume),
    }));
  }

  /**
   * Generate portfolio report with comprehensive analytics
   */
  async generateReport(
    portfolioId: string,
    from: Date,
    to: Date
  ): Promise<{
    portfolioId: string;
    period: { from: Date; to: Date };
    statistics: StatisticsResult;
    riskMetrics: {
      var95: number;
      var99: number;
      sharpeRatio: number;
      maxDrawdown: number;
    };
    trades: Array<{
      timestamp: string;
      symbol: string;
      side: string;
      price: number;
      quantity: number;
      pnl: number;
    }>;
    generatedAt: Date;
  }> {
    this.logger.info("Generating report", { portfolioId, from, to });

    // Get statistics
    const statistics = await this.getStatistics(portfolioId, from, to);

    // Get trades
    const tradesQuery = `
      SELECT 
        timestamp,
        symbol,
        side,
        price,
        quantity,
        pnl
      FROM aladdin.trades
      WHERE portfolioId = {portfolioId:String}
        AND timestamp >= {from:DateTime}
        AND timestamp <= {to:DateTime}
      ORDER BY timestamp DESC
    `;

    const tradesData = await this.clickhouse.query<{
      timestamp: string;
      symbol: string;
      side: string;
      price: string;
      quantity: string;
      pnl: string;
    }>(tradesQuery, {
      portfolioId,
      from: formatDateForClickHouse(from),
      to: formatDateForClickHouse(to),
    });

    const trades = tradesData.map((t) => ({
      timestamp: t.timestamp,
      symbol: t.symbol,
      side: t.side,
      price: Number.parseFloat(t.price),
      quantity: Number.parseFloat(t.quantity),
      pnl: Number.parseFloat(t.pnl || "0"),
    }));

    // Get risk metrics
    const riskMetricsQuery = `
      SELECT 
        var95,
        var99,
        sharpeRatio,
        maxDrawdown
      FROM aladdin.risk_metrics
      WHERE portfolioId = {portfolioId:String}
        AND timestamp >= {from:DateTime}
        AND timestamp <= {to:DateTime}
      ORDER BY timestamp DESC
      LIMIT 1
    `;

    const riskMetricsData = await this.clickhouse.query<{
      var95: string;
      var99: string;
      sharpeRatio: string;
      maxDrawdown: string;
    }>(riskMetricsQuery, {
      portfolioId,
      from: formatDateForClickHouse(from),
      to: formatDateForClickHouse(to),
    });

    const riskMetrics =
      riskMetricsData.length > 0
        ? {
            var95: Number.parseFloat(riskMetricsData[0].var95),
            var99: Number.parseFloat(riskMetricsData[0].var99),
            sharpeRatio: Number.parseFloat(riskMetricsData[0].sharpeRatio),
            maxDrawdown: Number.parseFloat(riskMetricsData[0].maxDrawdown),
          }
        : {
            var95: 0,
            var99: 0,
            sharpeRatio: statistics.sharpeRatio,
            maxDrawdown: statistics.maxDrawdown,
          };

    return {
      portfolioId,
      period: { from, to },
      statistics,
      riskMetrics,
      trades,
      generatedAt: new Date(),
    };
  }

  /**
   * Calculate Sharpe Ratio from returns
   * Sharpe Ratio = (mean return - risk-free rate) / standard deviation of returns
   */
  private calculateSharpeRatio(returns: number[], riskFreeRate = 0.02): number {
    if (returns.length < 2) {
      return 0;
    }

    // Calculate mean return
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;

    // Calculate standard deviation
    const variance =
      returns.reduce((sum, r) => sum + (r - meanReturn) ** 2, 0) /
      returns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) {
      return 0;
    }

    // Annualize the Sharpe ratio (assuming daily returns)
    const dailyRiskFreeRate = riskFreeRate / 365;
    const sharpeRatio =
      ((meanReturn - dailyRiskFreeRate) / stdDev) * Math.sqrt(365);

    return sharpeRatio;
  }

  /**
   * Calculate Maximum Drawdown from portfolio values
   * Max Drawdown = (Trough Value - Peak Value) / Peak Value
   */
  private calculateMaxDrawdown(values: number[]): number {
    if (values.length < 2) {
      return 0;
    }

    let maxDrawdown = 0;
    let peak = values[0];

    for (const value of values) {
      // Update peak if current value is higher
      if (value > peak) {
        peak = value;
      }

      // Calculate drawdown from peak
      const drawdown = (peak - value) / peak;

      // Update max drawdown if current drawdown is larger
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    // Return as percentage
    return maxDrawdown * 100;
  }

  /**
   * Get market overview - top movers, volume leaders, and market stats
   */
  async getMarketOverview(period = "24h"): Promise<{
    topGainers: Array<{
      symbol: string;
      price: number;
      change24h: number;
      changePercent24h: number;
      volume24h: number;
      high24h: number;
      low24h: number;
    }>;
    topLosers: Array<{
      symbol: string;
      price: number;
      change24h: number;
      changePercent24h: number;
      volume24h: number;
      high24h: number;
      low24h: number;
    }>;
    volumeLeaders: Array<{
      symbol: string;
      price: number;
      volume24h: number;
      volumeUsd: number;
      trades24h: number;
    }>;
    marketStats: {
      totalVolume24h: number;
      totalSymbols: number;
      avgVolatility: number;
      gainersCount: number;
      losersCount: number;
      unchangedCount: number;
      timestamp: Date;
    };
  }> {
    this.logger.info("Getting market overview", { period });

    // Calculate time range (24h by default)
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Query for 24h price changes and volumes
    // Get the most recent price and price from ~24h ago for each symbol
    const query = `
      WITH 
        all_prices AS (
          SELECT
            symbol,
            timestamp,
            close,
            volume,
            trades,
            high,
            low
          FROM aladdin.candles
          WHERE timeframe = '1h'
          GROUP BY symbol, timestamp, close, volume, trades, high, low
        ),
        current_prices AS (
          SELECT
            symbol,
            argMax(close, timestamp) AS current_price,
            max(timestamp) AS last_timestamp
          FROM all_prices
          GROUP BY symbol
        ),
        day_ago_prices AS (
          SELECT
            symbol,
            argMax(close, timestamp) AS day_ago_price
          FROM all_prices
          WHERE timestamp <= {oneDayAgo:DateTime}
          GROUP BY symbol
        ),
        volume_stats AS (
          SELECT
            symbol,
            sum(volume) AS volume_24h,
            sum(trades) AS trades_24h,
            max(high) AS high_24h,
            min(low) AS low_24h,
            stddevPop(close) / nullIf(avg(close), 0) * 100 AS volatility
          FROM all_prices
          WHERE timestamp >= {oneDayAgo:DateTime}
          GROUP BY symbol
        )
      SELECT
        c.symbol AS symbol,
        c.current_price AS current_price,
        d.day_ago_price AS day_ago_price,
        c.current_price - d.day_ago_price AS change_24h,
        (c.current_price - d.day_ago_price) / d.day_ago_price * 100 AS change_percent_24h,
        v.volume_24h AS volume_24h,
        v.trades_24h AS trades_24h,
        v.high_24h AS high_24h,
        v.low_24h AS low_24h,
        v.volatility AS volatility
      FROM current_prices c
      INNER JOIN day_ago_prices d ON c.symbol = d.symbol
      INNER JOIN volume_stats v ON c.symbol = v.symbol
      WHERE d.day_ago_price > 0
      ORDER BY change_percent_24h DESC
    `;

    const data = await this.clickhouse.query<{
      symbol: string;
      current_price: string;
      day_ago_price: string;
      change_24h: string;
      change_percent_24h: string;
      volume_24h: string;
      trades_24h: string;
      high_24h: string;
      low_24h: string;
      volatility: string;
    }>(query, {
      oneDayAgo: formatDateForClickHouse(oneDayAgo),
    });

    // Parse data
    const marketData = data.map((row) => ({
      symbol: row.symbol,
      price: Number.parseFloat(row.current_price),
      change24h: Number.parseFloat(row.change_24h),
      changePercent24h: Number.parseFloat(row.change_percent_24h),
      volume24h: Number.parseFloat(row.volume_24h),
      trades24h: Number.parseInt(row.trades_24h, 10),
      high24h: Number.parseFloat(row.high_24h),
      low24h: Number.parseFloat(row.low_24h),
      volatility: Number.parseFloat(row.volatility),
    }));

    // Get top gainers (top 10)
    const topGainers = marketData
      .filter((d) => d.changePercent24h > 0)
      .sort((a, b) => b.changePercent24h - a.changePercent24h)
      .slice(0, 10)
      .map((d) => ({
        symbol: d.symbol,
        price: d.price,
        change24h: d.change24h,
        changePercent24h: d.changePercent24h,
        volume24h: d.volume24h,
        high24h: d.high24h,
        low24h: d.low24h,
      }));

    // Get top losers (bottom 10 by change percentage, regardless of sign)
    const topLosers = marketData
      .sort((a, b) => a.changePercent24h - b.changePercent24h)
      .slice(0, 10)
      .map((d) => ({
        symbol: d.symbol,
        price: d.price,
        change24h: d.change24h,
        changePercent24h: d.changePercent24h,
        volume24h: d.volume24h,
        high24h: d.high24h,
        low24h: d.low24h,
      }));

    // Get volume leaders (top 10 by volume in USD)
    const volumeLeaders = marketData
      .map((d) => ({
        symbol: d.symbol,
        price: d.price,
        volume24h: d.volume24h,
        volumeUsd: d.volume24h * d.price,
        trades24h: d.trades24h,
      }))
      .sort((a, b) => b.volumeUsd - a.volumeUsd)
      .slice(0, 10);

    // Calculate market stats (total volume in USD)
    const totalVolume24h = marketData.reduce(
      (sum, d) => sum + d.volume24h * d.price,
      0
    );
    const totalSymbols = marketData.length;
    const avgVolatility =
      marketData.reduce((sum, d) => sum + d.volatility, 0) / totalSymbols;

    // Calculate market breadth
    const gainersCount = marketData.filter(
      (d) => d.changePercent24h > 0
    ).length;
    const losersCount = marketData.filter((d) => d.changePercent24h < 0).length;
    const unchangedCount = totalSymbols - gainersCount - losersCount;

    return {
      topGainers,
      topLosers,
      volumeLeaders,
      marketStats: {
        totalVolume24h,
        totalSymbols,
        avgVolatility,
        gainersCount,
        losersCount,
        unchangedCount,
        timestamp: now,
      },
    };
  }

  /**
   * Get advanced performance metrics for a portfolio
   */
  async getAdvancedMetrics(
    portfolioId: string,
    from: Date,
    to: Date,
    benchmark = "BTC"
  ): Promise<{
    portfolioId: string;
    period: { from: Date; to: Date };
    performance: {
      sharpeRatio: number;
      sortinoRatio: number;
      calmarRatio: number;
      informationRatio: number;
      omegaRatio: number;
      ulcerIndex: number;
      maxDrawdown: number;
    };
    trading: {
      totalTrades: number;
      winningTrades: number;
      losingTrades: number;
      winRate: number;
      profitFactor: number;
      avgWin: number;
      avgLoss: number;
      largestWin: number;
      largestLoss: number;
      consecutiveWins: number;
      consecutiveLosses: number;
    };
    generatedAt: Date;
  }> {
    // Import advanced metrics functions dynamically
    const {
      calculateSortinoRatio,
      calculateCalmarRatio,
      calculateInformationRatio,
      calculateOmegaRatio,
      calculateUlcerIndex,
      calculateTradingStats,
    } = await import("./performance/advanced-metrics");

    this.logger.info("Getting advanced metrics", {
      portfolioId,
      from,
      to,
      benchmark,
    });

    // Get portfolio history from ClickHouse
    const timeframeDays =
      (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
    const history = await this.getPortfolioHistory(portfolioId, from, to);

    // Calculate returns
    const returns: number[] = [];
    for (let i = 1; i < history.length; i++) {
      const currentValue = history[i].totalValue;
      const previousValue = history[i - 1].totalValue;
      const dailyReturn = (currentValue - previousValue) / previousValue;
      returns.push(dailyReturn);
    }

    const portfolioValues = history.map((h) => h.totalValue);

    // Get benchmark returns (BTC by default)
    const benchmarkSymbol = `${benchmark}USDT`;
    const benchmarkReturns = await this.getBenchmarkReturns(
      benchmarkSymbol,
      from,
      to
    );

    // Get trades for trading stats
    const tradesQuery = `
      SELECT price, quantity, side, pnl
      FROM aladdin.trades
      WHERE portfolioId = {portfolioId:String}
        AND timestamp >= {from:DateTime}
        AND timestamp <= {to:DateTime}
      ORDER BY timestamp ASC
    `;

    const tradesData = await this.clickhouse.query<{
      price: string;
      quantity: string;
      side: string;
      pnl: string;
    }>(tradesQuery, {
      portfolioId,
      from: formatDateForClickHouse(from),
      to: formatDateForClickHouse(to),
    });

    const trades = tradesData.map((t) => ({
      pnl: Number.parseFloat(t.pnl || "0"),
    }));

    // Calculate all metrics
    const sortinoRatio = calculateSortinoRatio(returns);
    const calmarRatio = calculateCalmarRatio(portfolioValues, timeframeDays);

    // Sync portfolio and benchmark returns to same length
    const minLength = Math.min(returns.length, benchmarkReturns.length);
    const syncedPortfolioReturns = returns.slice(0, minLength);
    const syncedBenchmarkReturns = benchmarkReturns.slice(0, minLength);

    const informationRatio =
      minLength > 0
        ? calculateInformationRatio({
            portfolioReturns: syncedPortfolioReturns,
            benchmarkReturns: syncedBenchmarkReturns,
          })
        : 0;

    const omegaRatio = calculateOmegaRatio(returns);
    const ulcerIndex = calculateUlcerIndex(portfolioValues);
    const maxDrawdown = this.calculateMaxDrawdown(portfolioValues);
    const sharpeRatio = this.calculateSharpeRatio(returns);
    const tradingStats = calculateTradingStats(trades);

    return {
      portfolioId,
      period: { from, to },
      performance: {
        sharpeRatio,
        sortinoRatio,
        calmarRatio,
        informationRatio,
        omegaRatio,
        ulcerIndex,
        maxDrawdown,
      },
      trading: tradingStats,
      generatedAt: new Date(),
    };
  }

  /**
   * Get portfolio history from ClickHouse (helper)
   */
  private async getPortfolioHistory(
    portfolioId: string,
    from: Date,
    to: Date
  ): Promise<Array<{ timestamp: Date; totalValue: number }>> {
    const query = `
      SELECT timestamp, totalValue
      FROM aladdin.portfolio_snapshots
      WHERE portfolioId = {portfolioId:String}
        AND timestamp >= {from:DateTime}
        AND timestamp <= {to:DateTime}
      ORDER BY timestamp ASC
    `;

    const data = await this.clickhouse.query<{
      timestamp: string;
      totalValue: string;
    }>(query, {
      portfolioId,
      from: formatDateForClickHouse(from),
      to: formatDateForClickHouse(to),
    });

    return data.map((row) => ({
      timestamp: new Date(row.timestamp),
      totalValue: Number.parseFloat(row.totalValue),
    }));
  }

  /**
   * Get benchmark returns (helper)
   */
  private async getBenchmarkReturns(
    symbol: string,
    from: Date,
    to: Date
  ): Promise<number[]> {
    const query = `
      WITH daily_prices AS (
        SELECT
          toDate(timestamp) as date,
          argMax(close, timestamp) as close
        FROM aladdin.candles
        WHERE symbol = {symbol:String}
          AND timestamp >= {from:DateTime}
          AND timestamp <= {to:DateTime}
          AND timeframe = '1d'
        GROUP BY date
        ORDER BY date
      ),
      returns_calc AS (
        SELECT
          date,
          close,
          (close - lag(close) OVER (ORDER BY date)) / nullIf(lag(close) OVER (ORDER BY date), 0) as return
        FROM daily_prices
      )
      SELECT
        date,
        close,
        return
      FROM returns_calc
      WHERE return IS NOT NULL
      ORDER BY date
    `;

    const data = await this.clickhouse.query<{
      date: string;
      close: string;
      return: string;
    }>(query, {
      symbol,
      from: formatDateForClickHouse(from),
      to: formatDateForClickHouse(to),
    });

    return data.map((row) => Number.parseFloat(row.return));
  }
}
