/**
 * Beta Calculator
 *
 * Beta measures portfolio sensitivity to market movements:
 * - Beta = 1.0: Portfolio moves exactly with market
 * - Beta > 1.0: Portfolio is more volatile than market (amplifies moves)
 * - Beta < 1.0: Portfolio is less volatile than market (dampens moves)
 * - Beta = 0.0: Portfolio uncorrelated with market
 * - Beta < 0.0: Portfolio moves opposite to market
 *
 * For crypto, we use BTC as market proxy (like S&P 500 in traditional finance).
 */

import type { ClickHouseClient } from "@aladdin/clickhouse";
import type { Logger } from "@aladdin/logger";

export type BetaResult = {
  /** Beta coefficient */
  beta: number;
  /** Alpha (excess return vs market) */
  alpha: number;
  /** R-squared (how much variance explained by market) */
  rSquared: number;
  /** Correlation with market */
  correlation: number;
  /** Portfolio returns used */
  portfolioReturns: number[];
  /** Market (BTC) returns used */
  marketReturns: number[];
  /** Time period */
  period: {
    from: Date;
    to: Date;
  };
  /** Calculated at */
  calculatedAt: Date;
};

export type MultiMarketBeta = {
  /** Beta to BTC (crypto market proxy) */
  btcBeta: BetaResult;
  /** Beta to ETH (alternative market proxy) */
  ethBeta?: BetaResult;
  /** Market regime detected */
  marketRegime: "BULL" | "BEAR" | "SIDEWAYS";
  /** Systematic risk (market-driven) */
  systematicRisk: number;
  /** Idiosyncratic risk (portfolio-specific) */
  idiosyncraticRisk: number;
};

// Constants
const MILLISECONDS_PER_DAY = 86_400_000;
const MIN_SAMPLES = 10;
const DEFAULT_DAYS = 30;
const BULL_THRESHOLD = 0.05;
const BEAR_THRESHOLD = -0.05;
const PERCENT_MULTIPLIER = 100;

export class BetaCalculator {
  constructor(
    private clickhouse: ClickHouseClient,
    private logger: Logger
  ) {}

  /**
   * Calculate beta to BTC (primary market proxy)
   */
  async calculateBeta(params: {
    portfolioId: string;
    days?: number;
    marketSymbol?: string;
  }): Promise<BetaResult> {
    const {
      portfolioId,
      days = DEFAULT_DAYS,
      marketSymbol = "BTCUSDT",
    } = params;

    this.logger.info("Calculating beta", { portfolioId, days, marketSymbol });

    const startDate = new Date(Date.now() - days * MILLISECONDS_PER_DAY);
    const endDate = new Date();

    // Get portfolio returns
    const portfolioReturns = await this.getPortfolioReturns(
      portfolioId,
      startDate,
      endDate
    );

    // Get market returns
    const marketReturns = await this.getMarketReturns(
      marketSymbol,
      startDate,
      endDate
    );

    // Align returns (same length)
    const minLength = Math.min(portfolioReturns.length, marketReturns.length);
    const alignedPortfolio = portfolioReturns.slice(0, minLength);
    const alignedMarket = marketReturns.slice(0, minLength);

    if (alignedPortfolio.length < MIN_SAMPLES) {
      throw new Error(
        `Insufficient data for beta calculation. Required: ${MIN_SAMPLES} samples, got: ${alignedPortfolio.length}`
      );
    }

    // Calculate beta using linear regression
    const { beta, alpha, rSquared, correlation } =
      this.calculateLinearRegression(alignedMarket, alignedPortfolio);

    this.logger.info("Beta calculated", {
      portfolioId,
      beta,
      alpha,
      rSquared,
      correlation,
    });

    return {
      beta,
      alpha,
      rSquared,
      correlation,
      portfolioReturns: alignedPortfolio,
      marketReturns: alignedMarket,
      period: { from: startDate, to: endDate },
      calculatedAt: new Date(),
    };
  }

  /**
   * Calculate beta to multiple markets (BTC and ETH)
   */
  async calculateMultiMarketBeta(
    portfolioId: string,
    days = DEFAULT_DAYS
  ): Promise<MultiMarketBeta> {
    this.logger.info("Calculating multi-market beta", { portfolioId, days });

    // Calculate beta to BTC
    const btcBeta = await this.calculateBeta({
      portfolioId,
      days,
      marketSymbol: "BTCUSDT",
    });

    // Calculate beta to ETH
    let ethBeta: BetaResult | undefined;
    try {
      ethBeta = await this.calculateBeta({
        portfolioId,
        days,
        marketSymbol: "ETHUSDT",
      });
    } catch (error) {
      this.logger.warn("Could not calculate ETH beta", { error });
    }

    // Detect market regime
    const marketRegime = this.detectMarketRegime(btcBeta.marketReturns);

    // Calculate systematic vs idiosyncratic risk
    const { systematicRisk, idiosyncraticRisk } = this.decomposeRisk(btcBeta);

    return {
      btcBeta,
      ethBeta,
      marketRegime,
      systematicRisk,
      idiosyncraticRisk,
    };
  }

  /**
   * Calculate rolling beta (time-varying beta)
   */
  async calculateRollingBeta(params: {
    portfolioId: string;
    totalDays: number;
    windowDays: number;
    marketSymbol?: string;
  }): Promise<Array<{ date: Date; beta: number; rSquared: number }>> {
    const {
      portfolioId,
      totalDays,
      windowDays,
      marketSymbol = "BTCUSDT",
    } = params;

    this.logger.info("Calculating rolling beta", {
      portfolioId,
      totalDays,
      windowDays,
      marketSymbol,
    });

    const startDate = new Date(Date.now() - totalDays * MILLISECONDS_PER_DAY);
    const endDate = new Date();

    const portfolioReturns = await this.getPortfolioReturns(
      portfolioId,
      startDate,
      endDate
    );
    const marketReturns = await this.getMarketReturns(
      marketSymbol,
      startDate,
      endDate
    );

    const minLength = Math.min(portfolioReturns.length, marketReturns.length);
    const rollingBetas: Array<{ date: Date; beta: number; rSquared: number }> =
      [];

    // Calculate beta for each rolling window
    for (let i = windowDays; i < minLength; i++) {
      const portfolioWindow = portfolioReturns.slice(i - windowDays, i);
      const marketWindow = marketReturns.slice(i - windowDays, i);

      const { beta, rSquared } = this.calculateLinearRegression(
        marketWindow,
        portfolioWindow
      );

      rollingBetas.push({
        date: new Date(startDate.getTime() + i * MILLISECONDS_PER_DAY),
        beta,
        rSquared,
      });
    }

    return rollingBetas;
  }

  /**
   * Get portfolio daily returns from ClickHouse
   */
  private async getPortfolioReturns(
    portfolioId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number[]> {
    const query = `
      WITH daily_values AS (
        SELECT
          toDate(timestamp) as date,
          argMax(totalValue, timestamp) as value
        FROM aladdin.portfolio_snapshots
        WHERE portfolioId = {portfolioId:String}
          AND timestamp >= {startDate:DateTime}
          AND timestamp <= {endDate:DateTime}
        GROUP BY date
        ORDER BY date
      )
      SELECT
        date,
        value,
        (value - lag(value) OVER (ORDER BY date)) / nullIf(lag(value) OVER (ORDER BY date), 0) as return
      FROM daily_values
      WHERE return IS NOT NULL
      ORDER BY date
    `;

    const data = await this.clickhouse.query<{
      date: string;
      value: string;
      return: string;
    }>(query, {
      portfolioId,
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate),
    });

    return data.map((row) => Number.parseFloat(row.return));
  }

  /**
   * Get market (BTC/ETH) daily returns from ClickHouse
   */
  private async getMarketReturns(
    symbol: string,
    startDate: Date,
    endDate: Date
  ): Promise<number[]> {
    const TIMEFRAME_1D = "1d";

    const query = `
      WITH daily_prices AS (
        SELECT
          toDate(timestamp) as date,
          argMax(close, timestamp) as close
        FROM aladdin.candles
        WHERE symbol = {symbol:String}
          AND timestamp >= {startDate:DateTime}
          AND timestamp <= {endDate:DateTime}
          AND timeframe = {timeframe:String}
        GROUP BY date
        ORDER BY date
      )
      SELECT
        date,
        close,
        (close - lag(close) OVER (ORDER BY date)) / nullIf(lag(close) OVER (ORDER BY date), 0) as return
      FROM daily_prices
      WHERE return IS NOT NULL
      ORDER BY date
    `;

    const data = await this.clickhouse.query<{
      date: string;
      close: string;
      return: string;
    }>(query, {
      symbol,
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate),
      timeframe: TIMEFRAME_1D,
    });

    return data.map((row) => Number.parseFloat(row.return));
  }

  /**
   * Calculate linear regression (beta, alpha, R²)
   * y = alpha + beta * x
   * where y = portfolio returns, x = market returns
   */
  private calculateLinearRegression(
    marketReturns: number[],
    portfolioReturns: number[]
  ): {
    beta: number;
    alpha: number;
    rSquared: number;
    correlation: number;
  } {
    const n = marketReturns.length;

    // Calculate means
    const marketMean = marketReturns.reduce((sum, r) => sum + r, 0) / n;
    const portfolioMean = portfolioReturns.reduce((sum, r) => sum + r, 0) / n;

    // Calculate covariance and variance
    let covariance = 0;
    let marketVariance = 0;
    let portfolioVariance = 0;

    for (let i = 0; i < n; i++) {
      const marketDiff = marketReturns[i] - marketMean;
      const portfolioDiff = portfolioReturns[i] - portfolioMean;

      covariance += marketDiff * portfolioDiff;
      marketVariance += marketDiff ** 2;
      portfolioVariance += portfolioDiff ** 2;
    }

    covariance /= n;
    marketVariance /= n;
    portfolioVariance /= n;

    // Calculate beta
    const beta = marketVariance === 0 ? 0 : covariance / marketVariance;

    // Calculate alpha (Jensen's alpha)
    const alpha = portfolioMean - beta * marketMean;

    // Calculate correlation
    const marketStd = Math.sqrt(marketVariance);
    const portfolioStd = Math.sqrt(portfolioVariance);
    const correlation =
      marketStd === 0 || portfolioStd === 0
        ? 0
        : covariance / (marketStd * portfolioStd);

    // Calculate R-squared
    const rSquared = correlation ** 2;

    return { beta, alpha, rSquared, correlation };
  }

  /**
   * Detect market regime based on returns
   */
  private detectMarketRegime(
    marketReturns: number[]
  ): "BULL" | "BEAR" | "SIDEWAYS" {
    const meanReturn =
      marketReturns.reduce((sum, r) => sum + r, 0) / marketReturns.length;

    if (meanReturn > BULL_THRESHOLD) return "BULL";
    if (meanReturn < BEAR_THRESHOLD) return "BEAR";
    return "SIDEWAYS";
  }

  /**
   * Decompose total risk into systematic and idiosyncratic
   */
  private decomposeRisk(betaResult: BetaResult): {
    systematicRisk: number;
    idiosyncraticRisk: number;
  } {
    const { rSquared, portfolioReturns } = betaResult;

    // Calculate portfolio variance
    const portfolioMean =
      portfolioReturns.reduce((sum, r) => sum + r, 0) / portfolioReturns.length;
    const portfolioVariance =
      portfolioReturns.reduce((sum, r) => sum + (r - portfolioMean) ** 2, 0) /
      portfolioReturns.length;

    // Systematic risk = R² * total variance
    // Idiosyncratic risk = (1 - R²) * total variance
    const systematicRisk = rSquared * portfolioVariance * PERCENT_MULTIPLIER;
    const idiosyncraticRisk =
      (1 - rSquared) * portfolioVariance * PERCENT_MULTIPLIER;

    return { systematicRisk, idiosyncraticRisk };
  }

  /**
   * Format date for ClickHouse
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
