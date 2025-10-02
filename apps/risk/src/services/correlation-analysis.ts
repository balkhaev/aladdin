/**
 * Correlation Analysis Service
 *
 * Provides professional-grade correlation analysis for portfolio risk management:
 * - Pearson correlation matrix
 * - Rolling correlations
 * - Diversification scoring
 * - Correlated pairs detection
 * - Risk concentration analysis
 */

import type { ClickHouseClient } from "@aladdin/shared/clickhouse";
import type { Logger } from "@aladdin/shared/logger";

/**
 * Correlation Matrix Result
 */
export type CorrelationMatrix = {
  symbols: string[];
  matrix: number[][];
  timestamp: Date;
};

/**
 * Correlation Metrics
 */
export type CorrelationMetrics = {
  avgCorrelation: number;
  maxCorrelation: number;
  minCorrelation: number;
  diversificationScore: number;
  highlyCorrelated: Array<{
    symbol1: string;
    symbol2: string;
    correlation: number;
  }>;
  uncorrelated: Array<{
    symbol1: string;
    symbol2: string;
    correlation: number;
  }>;
};

/**
 * Rolling Correlation Point
 */
export type RollingCorrelationPoint = {
  timestamp: Date;
  correlation: number;
};

/**
 * Time window options
 */
export type TimeWindow = "7d" | "30d" | "90d" | "1y";

// Constants
const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;
const MILLISECONDS_PER_DAY =
  HOURS_PER_DAY *
  MINUTES_PER_HOUR *
  SECONDS_PER_MINUTE *
  MILLISECONDS_PER_SECOND;

export class CorrelationAnalysisService {
  constructor(
    private clickhouse: ClickHouseClient,
    private logger: Logger
  ) {}

  /**
   * Calculate correlation matrix for portfolio assets
   */
  async calculateCorrelationMatrix(params: {
    symbols: string[];
    window: TimeWindow;
  }): Promise<CorrelationMatrix & CorrelationMetrics> {
    const { symbols, window } = params;

    this.logger.info("Calculating correlation matrix", { symbols, window });

    // Get returns for all symbols
    const windowDays = this.getWindowDays(window);
    const returns = await this.getReturnsMatrix(symbols, windowDays);

    // Calculate correlation matrix
    const matrix = this.calculatePearsonCorrelation(returns);

    // Calculate metrics
    const metrics = this.calculateCorrelationMetrics(symbols, matrix);

    return {
      symbols,
      matrix,
      timestamp: new Date(),
      ...metrics,
    };
  }

  /**
   * Calculate rolling correlation between two assets
   */
  async calculateRollingCorrelation(params: {
    symbol1: string;
    symbol2: string;
    window: number; // days
    rollingWindow: number; // days for each correlation calculation
  }): Promise<RollingCorrelationPoint[]> {
    const { symbol1, symbol2, window, rollingWindow } = params;

    this.logger.info("Calculating rolling correlation", {
      symbol1,
      symbol2,
      window,
      rollingWindow,
    });

    const startDate = new Date(Date.now() - window * MILLISECONDS_PER_DAY);
    const returns1 = await this.getReturns(symbol1, startDate);
    const returns2 = await this.getReturns(symbol2, startDate);

    const rolling: RollingCorrelationPoint[] = [];

    // Calculate correlation for each rolling window
    for (let i = rollingWindow; i < returns1.length; i++) {
      const window1 = returns1.slice(i - rollingWindow, i);
      const window2 = returns2.slice(i - rollingWindow, i);

      const correlation = this.pearsonCorrelation(
        window1.map((r) => r.return),
        window2.map((r) => r.return)
      );

      rolling.push({
        timestamp: returns1[i].timestamp,
        correlation,
      });
    }

    return rolling;
  }

  /**
   * Get correlation matrix for portfolio
   */
  async getPortfolioCorrelations(params: {
    portfolioId: string;
    window: TimeWindow;
  }): Promise<CorrelationMatrix & CorrelationMetrics> {
    const { portfolioId, window } = params;

    // Get portfolio symbols from database
    const symbols = await this.getPortfolioSymbols(portfolioId);

    if (symbols.length < 2) {
      throw new Error(
        "Portfolio must have at least 2 positions for correlation analysis"
      );
    }

    return this.calculateCorrelationMatrix({ symbols, window });
  }

  /**
   * Get returns matrix for multiple symbols
   */
  private async getReturnsMatrix(
    symbols: string[],
    days: number
  ): Promise<Map<string, number[]>> {
    const startDate = new Date(Date.now() - days * MILLISECONDS_PER_DAY);
    const returnsMap = new Map<string, number[]>();

    for (const symbol of symbols) {
      const returns = await this.getReturns(symbol, startDate);
      returnsMap.set(
        symbol,
        returns.map((r) => r.return)
      );
    }

    return returnsMap;
  }

  /**
   * Get daily returns for a symbol
   */
  private async getReturns(
    symbol: string,
    startDate: Date
  ): Promise<Array<{ timestamp: Date; return: number }>> {
    const TIMEFRAME_1D = "1d";

    const query = `
      WITH daily_prices AS (
        SELECT
          toDate(timestamp) as date,
          argMax(close, timestamp) as close
        FROM aladdin.candles
        WHERE symbol = {symbol:String}
          AND timestamp >= {startDate:DateTime}
          AND timeframe = {timeframe:String}
        GROUP BY date
        ORDER BY date
      )
      SELECT
        date,
        close,
        (close - lag(close) OVER (ORDER BY date)) / nullIf(lag(close) OVER (ORDER BY date), 0) as return
      FROM daily_prices
      ORDER BY date
    `;

    const data = await this.clickhouse.query<{
      date: string;
      close: string;
      return: string;
    }>(query, {
      symbol,
      startDate: this.formatDate(startDate),
      timeframe: TIMEFRAME_1D,
    });

    // Filter out null returns (first row) in application code
    return data
      .filter((row) => row.return !== null && !Number.isNaN(Number(row.return)))
      .map((row) => ({
        timestamp: new Date(row.date),
        return: Number.parseFloat(row.return),
      }));
  }

  /**
   * Calculate Pearson correlation matrix
   */
  private calculatePearsonCorrelation(
    returnsMap: Map<string, number[]>
  ): number[][] {
    const SELF_CORRELATION = 1;
    const INITIAL_VALUE = 0;

    const symbols = Array.from(returnsMap.keys());
    const n = symbols.length;
    const matrix: number[][] = Array.from({ length: n }, () =>
      new Array(n).fill(INITIAL_VALUE)
    );

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = SELF_CORRELATION; // Self-correlation is always 1
        } else {
          const returns1 = returnsMap.get(symbols[i]);
          const returns2 = returnsMap.get(symbols[j]);

          if (returns1 && returns2) {
            matrix[i][j] = this.pearsonCorrelation(returns1, returns2);
          }
        }
      }
    }

    return matrix;
  }

  /**
   * Calculate Pearson correlation coefficient between two arrays
   */
  private pearsonCorrelation(x: number[], y: number[]): number {
    const MIN_SAMPLES = 2;

    const n = Math.min(x.length, y.length);
    if (n < MIN_SAMPLES) return 0;

    const meanX = x.reduce((sum, val) => sum + val, 0) / n;
    const meanY = y.reduce((sum, val) => sum + val, 0) / n;

    let numerator = 0;
    let sumSqX = 0;
    let sumSqY = 0;

    for (let i = 0; i < n; i++) {
      const diffX = x[i] - meanX;
      const diffY = y[i] - meanY;
      numerator += diffX * diffY;
      sumSqX += diffX * diffX;
      sumSqY += diffY * diffY;
    }

    const denominator = Math.sqrt(sumSqX * sumSqY);
    if (denominator === 0) return 0;

    return numerator / denominator;
  }

  /**
   * Calculate correlation metrics
   */
  private calculateCorrelationMetrics(
    symbols: string[],
    matrix: number[][]
  ): CorrelationMetrics {
    const n = symbols.length;
    const correlations: number[] = [];
    const pairs: Array<{
      symbol1: string;
      symbol2: string;
      correlation: number;
    }> = [];

    // Collect all correlations (excluding diagonal)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const corr = matrix[i][j];
        correlations.push(corr);
        pairs.push({
          symbol1: symbols[i],
          symbol2: symbols[j],
          correlation: corr,
        });
      }
    }

    if (correlations.length === 0) {
      return {
        avgCorrelation: 0,
        maxCorrelation: 0,
        minCorrelation: 0,
        diversificationScore: 100,
        highlyCorrelated: [],
        uncorrelated: [],
      };
    }

    const avgCorrelation =
      correlations.reduce((sum, c) => sum + c, 0) / correlations.length;
    const maxCorrelation = Math.max(...correlations);
    const minCorrelation = Math.min(...correlations);

    // Diversification score: 100 means perfectly uncorrelated, 0 means perfectly correlated
    const MAX_SCORE = 100;
    const diversificationScore = Math.max(
      0,
      Math.min(MAX_SCORE, (1 - avgCorrelation) * MAX_SCORE)
    );

    const HIGH_CORRELATION_THRESHOLD = 0.7;
    const LOW_CORRELATION_THRESHOLD = 0.3;
    const MAX_PAIRS = 10;

    // Find highly correlated pairs (> 0.7)
    const highlyCorrelated = pairs
      .filter((p) => p.correlation > HIGH_CORRELATION_THRESHOLD)
      .sort((a, b) => b.correlation - a.correlation)
      .slice(0, MAX_PAIRS);

    // Find uncorrelated pairs (< 0.3)
    const uncorrelated = pairs
      .filter((p) => Math.abs(p.correlation) < LOW_CORRELATION_THRESHOLD)
      .sort((a, b) => Math.abs(a.correlation) - Math.abs(b.correlation))
      .slice(0, MAX_PAIRS);

    return {
      avgCorrelation,
      maxCorrelation,
      minCorrelation,
      diversificationScore,
      highlyCorrelated,
      uncorrelated,
    };
  }

  /**
   * Get portfolio symbols from database
   */
  private async getPortfolioSymbols(portfolioId: string): Promise<string[]> {
    // Get latest portfolio snapshot and parse positions
    const query = `
      SELECT positions
      FROM aladdin.portfolio_snapshots
      WHERE portfolioId = {portfolioId:String}
      ORDER BY timestamp DESC
      LIMIT 1
    `;

    const data = await this.clickhouse.query<{ positions: string }>(query, {
      portfolioId,
    });

    if (data.length === 0) {
      return [];
    }

    // Parse positions JSON and extract symbols with quantity > 0
    try {
      const positions = JSON.parse(data[0].positions) as Array<{
        symbol: string;
        quantity: number;
      }>;

      const symbols = positions
        .filter((p) => p.quantity > 0)
        .map((p) => p.symbol)
        .sort();

      // Return unique symbols
      return [...new Set(symbols)];
    } catch (error) {
      this.logger.error("Failed to parse portfolio positions", { error });
      return [];
    }
  }

  /**
   * Convert time window to days
   */
  private getWindowDays(window: TimeWindow): number {
    const WINDOW_DAYS: Record<TimeWindow, number> = {
      "7d": 7,
      "30d": 30,
      "90d": 90,
      "1y": 365,
    };
    return WINDOW_DAYS[window];
  }

  /**
   * Format date for ClickHouse query
   */
  private formatDate(date: Date): string {
    const PAD_LENGTH = 2;
    const PAD_CHAR = "0";
    const MONTH_OFFSET = 1;

    const pad = (n: number) => n.toString().padStart(PAD_LENGTH, PAD_CHAR);
    return `${date.getFullYear()}-${pad(date.getMonth() + MONTH_OFFSET)}-${pad(
      date.getDate()
    )} 00:00:00`;
  }
}
