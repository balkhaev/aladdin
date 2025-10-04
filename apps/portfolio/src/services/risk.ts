import { BaseService } from "@aladdin/shared/base-service";
import { NotFoundError } from "@aladdin/shared/errors";
import type { RiskLimit, RiskMetrics } from "@aladdin/shared/types";
import {
  BetaCalculator,
  type BetaResult,
  type MultiMarketBeta,
} from "./beta-calculator";
import { CVaRCalculator, type CVaRResult } from "./cvar-calculator";
import {
  type StressScenario,
  StressTestingEngine,
  type StressTestSummary,
} from "./stress-testing";

/**
 * Format date to ClickHouse DateTime format (YYYY-MM-DD HH:MM:SS)
 */
function formatDateForClickHouse(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// Risk calculation constants
const VAR_95_PERCENTILE = 0.05;
const VAR_99_PERCENTILE = 0.01;
const HIGH_LEVERAGE_THRESHOLD = 5;
const HIGH_LEVERAGE_WARNING_THRESHOLD = 3;
const MIN_HISTORICAL_DAYS = 30;
const DAYS_IN_YEAR = 365;
const PERCENT_MULTIPLIER = 100;

export type VarResult = {
  var95: number;
  var99: number;
  portfolioValue: number;
  historicalReturns: number[];
  calculatedAt: Date;
};

export type ExposureResult = {
  totalExposure: number;
  netExposure: number;
  longExposure: number;
  shortExposure: number;
  leverage: number;
  positions: Array<{
    symbol: string;
    exposure: number;
    percentage: number;
  }>;
};

export type OrderRiskCheckResult = {
  allowed: boolean;
  violations: Array<{
    type: string;
    limit: number;
    current: number;
    projected: number;
  }>;
  warnings: string[];
};

/**
 * Risk Management Service - управление рисками портфелей
 */
export class RiskService extends BaseService {
  private cvarCalculator: CVaRCalculator;
  private stressTestingEngine: StressTestingEngine;
  private betaCalculator: BetaCalculator | null = null;

  constructor(deps: Parameters<typeof BaseService.prototype.constructor>[0]) {
    super(deps);
    this.cvarCalculator = new CVaRCalculator(this.logger);
    this.stressTestingEngine = new StressTestingEngine(this.logger);

    // Initialize beta calculator if ClickHouse is available
    if (this.clickhouse) {
      this.betaCalculator = new BetaCalculator(this.clickhouse, this.logger);
    }
  }

  getServiceName(): string {
    return "risk";
  }

  /**
   * Initialize service and subscribe to NATS events
   */
  protected async onInitialize(): Promise<void> {
    if (!this.natsClient) {
      throw new Error("NATS client is required for Risk Service");
    }

    // Subscribe to portfolio events to monitor risks
    await this.natsClient.subscribe(
      "portfolio.updated",
      this.handlePortfolioUpdate.bind(this)
    );

    await this.natsClient.subscribe(
      "trading.order.filled",
      this.handleOrderFilled.bind(this)
    );
  }

  protected onHealthCheck(): Record<string, boolean> {
    return {
      // Custom health checks can be added here if needed
    };
  }

  /**
   * Calculate Value at Risk (VaR) using historical simulation
   */
  async calculateVaR(
    portfolioId: string,
    confidence = 95,
    timeWindowDays = 30
  ): Promise<VarResult> {
    if (!this.prisma) {
      throw new Error("Database not available");
    }
    if (!this.clickhouse) {
      throw new Error("ClickHouse not available");
    }

    this.logger.info("Calculating VaR", {
      portfolioId,
      confidence,
      timeWindowDays,
    });

    // Get portfolio positions
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: { positions: true },
    });

    if (!portfolio) {
      throw new NotFoundError("Portfolio", portfolioId);
    }

    const currentBalance = Number.parseFloat(portfolio.balance.toString());

    // Get historical portfolio snapshots from ClickHouse
    const MIN_SNAPSHOTS_RECOMMENDED = 30; // Recommended: 30 days of data
    const MIN_SNAPSHOTS_ABSOLUTE = 10; // Absolute minimum: 10 days of data
    const snapshots = await this.getPortfolioHistory(
      portfolioId,
      timeWindowDays
    );

    if (snapshots.length < MIN_SNAPSHOTS_ABSOLUTE) {
      throw new Error(
        `Insufficient historical data for VaR calculation. Required: at least ${MIN_SNAPSHOTS_ABSOLUTE} days, Available: ${snapshots.length} days. Please wait for more portfolio history to accumulate.`
      );
    }

    // Warn if data is below recommended threshold
    if (snapshots.length < MIN_SNAPSHOTS_RECOMMENDED) {
      this.logger.warn("VaR calculation with limited historical data", {
        portfolioId,
        available: snapshots.length,
        recommended: MIN_SNAPSHOTS_RECOMMENDED,
        message: "Results may be less accurate with limited historical data",
      });
    }

    // Calculate daily returns
    const returns: number[] = [];
    for (let i = 1; i < snapshots.length; i++) {
      const currentValue = snapshots[i].totalValue;
      const previousValue = snapshots[i - 1].totalValue;
      const dailyReturn = (currentValue - previousValue) / previousValue;
      returns.push(dailyReturn);
    }

    // Sort returns from worst to best
    const sortedReturns = [...returns].sort((a, b) => a - b);

    // Calculate VaR at different confidence levels
    const var95Index = Math.floor(sortedReturns.length * VAR_95_PERCENTILE);
    const var99Index = Math.floor(sortedReturns.length * VAR_99_PERCENTILE);

    const var95Return = sortedReturns[var95Index] || 0;
    const var99Return = sortedReturns[var99Index] || 0;

    const var95 = Math.abs(var95Return * currentBalance);
    const var99 = Math.abs(var99Return * currentBalance);

    this.logger.info("VaR calculated", {
      portfolioId,
      var95,
      var99,
      samplesCount: returns.length,
    });

    return {
      var95,
      var99,
      portfolioValue: currentBalance,
      historicalReturns: returns,
      calculatedAt: new Date(),
    };
  }

  /**
   * Calculate portfolio exposure
   */
  async calculateExposure(portfolioId: string): Promise<ExposureResult> {
    if (!this.prisma) {
      throw new Error("Database not available");
    }

    this.logger.info("Calculating exposure", { portfolioId });

    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: { positions: true },
    });

    if (!portfolio) {
      throw new NotFoundError("Portfolio", portfolioId);
    }

    const balance = Number.parseFloat(portfolio.balance.toString());
    let longExposure = 0;
    let shortExposure = 0;

    const positionExposures = portfolio.positions.map((position) => {
      const quantity = Number.parseFloat(position.quantity.toString());
      const currentPrice = Number.parseFloat(position.currentPrice.toString());
      const exposure = Math.abs(quantity * currentPrice);

      if (quantity > 0) {
        longExposure += exposure;
      } else {
        shortExposure += exposure;
      }

      return {
        symbol: position.symbol,
        exposure,
        percentage: (exposure / balance) * PERCENT_MULTIPLIER,
      };
    });

    const totalExposure = longExposure + shortExposure;
    const netExposure = longExposure - shortExposure;
    const leverage = balance > 0 ? totalExposure / balance : 0;

    return {
      totalExposure,
      netExposure,
      longExposure,
      shortExposure,
      leverage,
      positions: positionExposures,
    };
  }

  /**
   * Get risk limits for user/portfolio
   */
  async getRiskLimits(
    userId: string,
    portfolioId?: string
  ): Promise<RiskLimit[]> {
    if (!this.prisma) {
      throw new Error("Database not available");
    }

    this.logger.info("Getting risk limits", { userId, portfolioId });

    const limits = await this.prisma.riskLimit.findMany({
      where: {
        userId,
        ...(portfolioId ? { portfolioId } : {}),
      },
    });

    return limits.map((limit) => ({
      id: limit.id,
      userId: limit.userId,
      portfolioId: limit.portfolioId ?? undefined,
      type: limit.type as RiskLimit["type"],
      value: Number.parseFloat(limit.value.toString()),
      enabled: limit.enabled,
    }));
  }

  /**
   * Create new risk limit
   */
  async createRiskLimit(params: {
    userId: string;
    type: RiskLimit["type"];
    value: number;
    portfolioId?: string;
    enabled?: boolean;
  }): Promise<RiskLimit> {
    if (!this.prisma) {
      throw new Error("Database not available");
    }

    const { userId, type, value, portfolioId, enabled = true } = params;

    this.logger.info("Creating risk limit", {
      userId,
      type,
      value,
      portfolioId,
    });

    const limit = await this.prisma.riskLimit.create({
      data: {
        userId,
        portfolioId: portfolioId ?? null,
        type,
        value: value.toString(),
        enabled,
      },
    });

    return {
      id: limit.id,
      userId: limit.userId,
      portfolioId: limit.portfolioId ?? undefined,
      type: limit.type as RiskLimit["type"],
      value: Number.parseFloat(limit.value.toString()),
      enabled: limit.enabled,
    };
  }

  /**
   * Update risk limit
   */
  async updateRiskLimit(
    limitId: string,
    updates: { value?: number; enabled?: boolean }
  ): Promise<RiskLimit> {
    if (!this.prisma) {
      throw new Error("Database not available");
    }

    this.logger.info("Updating risk limit", { limitId, updates });

    const limit = await this.prisma.riskLimit.update({
      where: { id: limitId },
      data: {
        ...(updates.value !== undefined
          ? { value: updates.value.toString() }
          : {}),
        ...(updates.enabled !== undefined ? { enabled: updates.enabled } : {}),
      },
    });

    return {
      id: limit.id,
      userId: limit.userId,
      portfolioId: limit.portfolioId ?? undefined,
      type: limit.type as RiskLimit["type"],
      value: Number.parseFloat(limit.value.toString()),
      enabled: limit.enabled,
    };
  }

  /**
   * Check if order violates any risk limits
   */
  async checkOrderRisk(params: {
    portfolioId: string;
    symbol: string;
    side: "BUY" | "SELL";
    quantity: number;
    price: number;
  }): Promise<OrderRiskCheckResult> {
    if (!this.prisma) {
      throw new Error("Database not available");
    }

    const { portfolioId, symbol, side, quantity, price } = params;

    this.logger.info("Checking order risk", {
      portfolioId,
      symbol,
      side,
      quantity,
      price,
    });

    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: { positions: true },
    });

    if (!portfolio) {
      throw new NotFoundError("Portfolio", portfolioId);
    }

    // Get risk limits
    const limits = await this.getRiskLimits(portfolio.userId, portfolioId);
    const enabledLimits = limits.filter((l) => l.enabled);

    const violations: Array<{
      type: string;
      limit: number;
      current: number;
      projected: number;
    }> = [];
    const warnings: string[] = [];

    const orderValue = quantity * price;
    const balance = Number.parseFloat(portfolio.balance.toString());

    // Calculate current and projected exposure
    const currentExposure = await this.calculateExposure(portfolioId);
    const projectedExposureValue =
      side === "BUY"
        ? currentExposure.totalExposure + orderValue
        : currentExposure.totalExposure - orderValue;
    const projectedLeverage =
      balance > 0 ? projectedExposureValue / balance : 0;

    // Check MAX_LEVERAGE limit
    const leverageLimit = enabledLimits.find((l) => l.type === "MAX_LEVERAGE");
    if (leverageLimit && projectedLeverage > leverageLimit.value) {
      violations.push({
        type: "MAX_LEVERAGE",
        limit: leverageLimit.value,
        current: currentExposure.leverage,
        projected: projectedLeverage,
      });
    }

    // Check MAX_POSITION_SIZE limit
    const positionSizeLimit = enabledLimits.find(
      (l) => l.type === "MAX_POSITION_SIZE"
    );
    if (positionSizeLimit) {
      const positionPercentage = (orderValue / balance) * PERCENT_MULTIPLIER;
      if (positionPercentage > positionSizeLimit.value) {
        violations.push({
          type: "MAX_POSITION_SIZE",
          limit: positionSizeLimit.value,
          current: 0,
          projected: positionPercentage,
        });
      }
    }

    // Check MIN_MARGIN limit
    const marginLimit = enabledLimits.find((l) => l.type === "MIN_MARGIN");
    if (marginLimit && side === "BUY") {
      const projectedBalance = balance - orderValue;
      const marginPercentage =
        (projectedBalance / balance) * PERCENT_MULTIPLIER;
      if (marginPercentage < marginLimit.value) {
        violations.push({
          type: "MIN_MARGIN",
          limit: marginLimit.value,
          current: PERCENT_MULTIPLIER,
          projected: marginPercentage,
        });
      }
    }

    // Add warnings
    if (projectedLeverage > HIGH_LEVERAGE_WARNING_THRESHOLD) {
      warnings.push("High leverage detected. Consider reducing position size.");
    }

    const allowed = violations.length === 0;

    this.logger.info("Order risk check completed", {
      portfolioId,
      allowed,
      violationsCount: violations.length,
      warningsCount: warnings.length,
    });

    return {
      allowed,
      violations,
      warnings,
    };
  }

  /**
   * Store risk metrics in ClickHouse
   */
  async storeRiskMetrics(metrics: RiskMetrics): Promise<void> {
    if (!this.clickhouse) {
      throw new Error("ClickHouse not available");
    }

    await this.clickhouse.insert({
      table: "aladdin.risk_metrics",
      values: [
        {
          timestamp: formatDateForClickHouse(metrics.timestamp),
          portfolioId: metrics.portfolioId,
          userId: metrics.userId,
          var95: metrics.var95,
          var99: metrics.var99,
          sharpeRatio: metrics.sharpeRatio,
          maxDrawdown: metrics.maxDrawdown,
          leverage: metrics.leverage,
          exposure: metrics.exposure,
          marginAvailable: metrics.marginAvailable,
          marginUsed: metrics.marginUsed,
        },
      ],
    });

    this.logger.debug("Risk metrics stored", {
      portfolioId: metrics.portfolioId,
    });
  }

  /**
   * Get portfolio history from ClickHouse
   */
  private async getPortfolioHistory(
    portfolioId: string,
    days: number
  ): Promise<Array<{ timestamp: Date; totalValue: number }>> {
    if (!this.clickhouse) {
      throw new Error("ClickHouse not available");
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const query = `
      SELECT 
        timestamp,
        totalValue
      FROM aladdin.portfolio_snapshots
      WHERE portfolioId = {portfolioId:String}
        AND timestamp >= {startDate:DateTime}
      ORDER BY timestamp ASC
    `;

    const data = await this.clickhouse.query<{
      timestamp: string;
      totalValue: string;
    }>(query, {
      portfolioId,
      startDate: formatDateForClickHouse(startDate),
    });

    return data.map((row) => ({
      timestamp: new Date(row.timestamp),
      totalValue: Number.parseFloat(row.totalValue),
    }));
  }

  /**
   * Calculate Sharpe Ratio for a portfolio (public method)
   */
  async calculateSharpeRatioForPortfolio(portfolioId: string): Promise<number> {
    try {
      // Get VaR result which includes historical returns
      const varResult = await this.calculateVaR(portfolioId);
      return this.calculateSharpeRatio(varResult.historicalReturns);
    } catch (error) {
      this.logger.error("Failed to calculate Sharpe Ratio", error);
      return 0;
    }
  }

  /**
   * Calculate Maximum Drawdown for a portfolio (public method)
   */
  async calculateMaxDrawdownForPortfolio(portfolioId: string): Promise<number> {
    try {
      // Get historical portfolio data
      const history = await this.getPortfolioHistory(
        portfolioId,
        MIN_HISTORICAL_DAYS
      );
      const portfolioValues = history.map((h) => h.totalValue);
      return this.calculateMaxDrawdown(portfolioValues);
    } catch (error) {
      this.logger.error("Failed to calculate Max Drawdown", error);
      return 0;
    }
  }

  /**
   * Calculate Sharpe Ratio from historical returns
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

    // Check for zero or invalid standard deviation
    if (stdDev === 0 || !Number.isFinite(stdDev)) {
      return 0;
    }

    // Annualize the Sharpe ratio (assuming daily returns)
    // Daily risk-free rate
    const dailyRiskFreeRate = riskFreeRate / DAYS_IN_YEAR;
    const sharpeRatio =
      ((meanReturn - dailyRiskFreeRate) / stdDev) * Math.sqrt(DAYS_IN_YEAR);

    // Ensure result is finite
    return Number.isFinite(sharpeRatio) ? sharpeRatio : 0;
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

      // Check for zero or invalid peak to avoid division by zero
      if (peak === 0 || !Number.isFinite(peak)) {
        continue;
      }

      // Calculate drawdown from peak
      const drawdown = (peak - value) / peak;

      // Update max drawdown if current drawdown is larger and valid
      if (Number.isFinite(drawdown) && drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    // Return as percentage
    return maxDrawdown * PERCENT_MULTIPLIER;
  }

  /**
   * Handle portfolio update event
   */
  private async handlePortfolioUpdate(data: string): Promise<void> {
    if (!this.natsClient) {
      return;
    }

    try {
      const event = JSON.parse(data);
      this.logger.debug("Portfolio updated", event);

      // Calculate and store risk metrics
      const portfolioId = event.data.id;
      const varResult = await this.calculateVaR(portfolioId);
      const exposure = await this.calculateExposure(portfolioId);

      // Calculate Sharpe Ratio from historical returns
      const sharpeRatio = this.calculateSharpeRatio(
        varResult.historicalReturns
      );

      // Get portfolio history for max drawdown calculation
      const history = await this.getPortfolioHistory(
        portfolioId,
        MIN_HISTORICAL_DAYS
      );
      const portfolioValues = history.map((h) => h.totalValue);
      const maxDrawdown = this.calculateMaxDrawdown(portfolioValues);

      const metrics: RiskMetrics = {
        timestamp: new Date(),
        portfolioId,
        userId: event.data.userId,
        var95: varResult.var95,
        var99: varResult.var99,
        sharpeRatio,
        maxDrawdown,
        leverage: exposure.leverage,
        exposure: exposure.totalExposure,
        marginAvailable: varResult.portfolioValue - exposure.totalExposure,
        marginUsed: exposure.totalExposure,
      };

      await this.storeRiskMetrics(metrics);

      // Publish risk alert if needed
      if (exposure.leverage > HIGH_LEVERAGE_THRESHOLD) {
        await this.natsClient.publish(
          "risk.alert",
          JSON.stringify({
            type: "HIGH_LEVERAGE",
            portfolioId,
            leverage: exposure.leverage,
            timestamp: new Date(),
          })
        );
      }
    } catch (error) {
      this.logger.error("Failed to handle portfolio update", error);
    }
  }

  /**
   * Handle order filled event
   */
  private async handleOrderFilled(data: string): Promise<void> {
    try {
      const event = JSON.parse(data);
      this.logger.debug("Order filled", event);

      // Re-calculate risk metrics after order execution
      const portfolioId = event.data.portfolioId;
      if (portfolioId) {
        await this.handlePortfolioUpdate(
          JSON.stringify({
            data: { id: portfolioId, userId: event.data.userId },
          })
        );
      }
    } catch (error) {
      this.logger.error("Failed to handle order filled event", error);
    }
  }

  /**
   * Calculate CVaR (Conditional Value at Risk)
   */
  async calculateCVaR(
    portfolioId: string,
    confidence: 95 | 99 = 95
  ): Promise<CVaRResult> {
    if (!this.prisma) {
      throw new Error("Database not available");
    }
    if (!this.clickhouse) {
      throw new Error("ClickHouse not available");
    }

    this.logger.info("Calculating CVaR", { portfolioId, confidence });

    // Get portfolio
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
    });

    if (!portfolio) {
      throw new NotFoundError("Portfolio", portfolioId);
    }

    const currentBalance = Number.parseFloat(portfolio.balance.toString());

    // Get historical returns
    const MIN_DAYS_FOR_CVAR = 30;
    const history = await this.getPortfolioHistory(
      portfolioId,
      MIN_DAYS_FOR_CVAR
    );

    if (history.length < 2) {
      throw new Error(
        "Insufficient historical data for CVaR calculation. Need at least 2 days of history."
      );
    }

    // Calculate daily returns
    const returns: number[] = [];
    for (let i = 1; i < history.length; i++) {
      const currentValue = history[i].totalValue;
      const previousValue = history[i - 1].totalValue;
      const dailyReturn = (currentValue - previousValue) / previousValue;
      returns.push(dailyReturn);
    }

    // Calculate CVaR using the calculator
    return this.cvarCalculator.calculate(returns, currentBalance, confidence);
  }

  /**
   * Run stress test on portfolio
   */
  async runStressTest(params: {
    portfolioId: string;
    scenarios?: StressScenario[];
  }): Promise<StressTestSummary> {
    if (!this.prisma) {
      throw new Error("Database not available");
    }

    const { portfolioId, scenarios } = params;

    this.logger.info("Running stress test", { portfolioId });

    // Get portfolio with positions
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: { positions: true },
    });

    if (!portfolio) {
      throw new NotFoundError("Portfolio", portfolioId);
    }

    // Calculate leverage
    const balance = Number.parseFloat(portfolio.balance.toString());
    const totalExposure = portfolio.positions.reduce((sum, p) => {
      const qty = Number.parseFloat(p.quantity.toString());
      const price = Number.parseFloat(p.currentPrice.toString());
      return sum + Math.abs(qty * price);
    }, 0);
    const leverage = balance > 0 ? totalExposure / balance : 1;

    // Convert positions to stress test format
    const positions = portfolio.positions.map((p) => ({
      symbol: p.symbol,
      quantity: Number.parseFloat(p.quantity.toString()),
      currentPrice: Number.parseFloat(p.currentPrice.toString()),
    }));

    // Run stress test
    return this.stressTestingEngine.runStressTest({
      positions,
      leverage,
      scenarios,
    });
  }

  /**
   * Get predefined stress test scenarios
   */
  getStressTestScenarios(): StressScenario[] {
    return this.stressTestingEngine.getHistoricalScenarios();
  }

  /**
   * Create custom stress test scenario
   */
  createCustomStressScenario(params: {
    name: string;
    description: string;
    priceShocks: Record<string, number>;
    volumeShock?: number;
    spreadShock?: number;
    liquidityShock?: number;
  }): StressScenario {
    return this.stressTestingEngine.createCustomScenario(params);
  }

  /**
   * Calculate portfolio beta to market (BTC)
   */
  calculatePortfolioBeta(params: {
    portfolioId: string;
    days?: number;
    marketSymbol?: string;
  }): Promise<BetaResult> {
    if (!this.betaCalculator) {
      throw new Error("Beta calculator not available (ClickHouse required)");
    }

    return this.betaCalculator.calculateBeta(params);
  }

  /**
   * Calculate multi-market beta (BTC and ETH)
   */
  calculateMultiMarketBeta(
    portfolioId: string,
    days?: number
  ): Promise<MultiMarketBeta> {
    if (!this.betaCalculator) {
      throw new Error("Beta calculator not available (ClickHouse required)");
    }

    return this.betaCalculator.calculateMultiMarketBeta(portfolioId, days);
  }

  /**
   * Calculate rolling beta (time-varying)
   */
  calculateRollingBeta(params: {
    portfolioId: string;
    totalDays: number;
    windowDays: number;
    marketSymbol?: string;
  }): Promise<Array<{ date: Date; beta: number; rSquared: number }>> {
    if (!this.betaCalculator) {
      throw new Error("Beta calculator not available (ClickHouse required)");
    }

    return this.betaCalculator.calculateRollingBeta(params);
  }
}
