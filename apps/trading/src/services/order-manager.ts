import type { Logger } from "@aladdin/shared/logger";
import type { ProcessedSignal } from "./signal-processor";

export type OrderResult = {
  success: boolean;
  orderId?: string;
  positionId?: string;
  error?: string;
  signal: ProcessedSignal;
};

const TRADING_SERVICE_URL =
  process.env.TRADING_SERVICE_URL || "http://localhost:3011";
const PORTFOLIO_SERVICE_URL =
  process.env.PORTFOLIO_SERVICE_URL || "http://localhost:3012";
const RISK_SERVICE_URL =
  process.env.RISK_SERVICE_URL || "http://localhost:3013";

/**
 * Order Manager - manages order execution lifecycle
 */
export class OrderManager {
  constructor(
    private logger: Logger,
    private mode: "PAPER" | "LIVE" = "PAPER"
  ) {}

  /**
   * Execute an order based on processed signal
   */
  async executeOrder(
    signal: ProcessedSignal,
    userId: string,
    portfolioId: string,
    exchangeCredentialsId: string
  ): Promise<OrderResult> {
    this.logger.info("Executing order", {
      mode: this.mode,
      symbol: signal.symbol,
      recommendation: signal.recommendation,
      confidence: signal.confidence,
    });

    try {
      // 1. Get current price
      const price = await this.getCurrentPrice(
        signal.symbol,
        exchangeCredentialsId
      );

      // 2. Calculate position size
      const portfolio = await this.getPortfolio(portfolioId);
      const balance = Number(portfolio.balance);
      const positionValue = balance * (signal.positionSize || 0.02);
      const quantity = positionValue / price;

      // 3. Calculate stop-loss and take-profit
      const stopLoss = price * 0.95; // 5% stop-loss
      const takeProfit = price * 1.1; // 10% take-profit

      // 4. Check risk limits
      const riskCheck = await this.checkRiskLimits(
        portfolioId,
        signal.symbol,
        "BUY",
        quantity,
        price
      );

      if (!riskCheck.allowed) {
        return {
          success: false,
          error: `Risk check failed: ${riskCheck.violations.map((v) => v.type).join(", ")}`,
          signal,
        };
      }

      // 5. Execute order (Paper or Live)
      if (this.mode === "PAPER") {
        // Simulate order execution
        const paperId = `PAPER_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        this.logger.info("📝 PAPER TRADE executed", {
          symbol: signal.symbol,
          side: "BUY",
          quantity: quantity.toFixed(8),
          price: price.toFixed(2),
          stopLoss: stopLoss.toFixed(2),
          takeProfit: takeProfit.toFixed(2),
          positionValue: positionValue.toFixed(2),
        });

        return {
          success: true,
          orderId: paperId,
          positionId: paperId,
          signal,
        };
      }

      // LIVE MODE - Execute real order
      const orderResult = await this.createOrder({
        userId,
        portfolioId,
        symbol: signal.symbol,
        side: "BUY",
        type: "MARKET",
        quantity,
        exchangeCredentialsId,
      });

      if (!orderResult.success) {
        return {
          success: false,
          error: orderResult.error,
          signal,
        };
      }

      this.logger.info("💰 LIVE ORDER executed", {
        orderId: orderResult.orderId,
        symbol: signal.symbol,
        quantity: quantity.toFixed(8),
        price: price.toFixed(2),
      });

      // 6. Start position monitoring with stop-loss and take-profit
      if (orderResult.positionId) {
        await this.startMonitoring(orderResult.positionId, {
          stopLoss,
          takeProfit,
          trailingStopPercent: 3, // 3% trailing stop
        });
      }

      return {
        success: true,
        orderId: orderResult.orderId,
        positionId: orderResult.positionId,
        signal,
      };
    } catch (error) {
      this.logger.error("Order execution failed", { error, signal });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        signal,
      };
    }
  }

  /**
   * Get current price for a symbol
   */
  private getCurrentPrice(
    _symbol: string,
    _exchangeCredentialsId: string
  ): number {
    // In real implementation, fetch from market-data service
    // For now, return mock price
    return 50_000; // Mock BTC price
  }

  /**
   * Get portfolio details
   */
  private async getPortfolio(portfolioId: string): Promise<{
    balance: string;
    currency: string;
  }> {
    try {
      const url = `${PORTFOLIO_SERVICE_URL}/api/portfolios/${portfolioId}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Portfolio API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      this.logger.error("Failed to fetch portfolio", error);
      throw error;
    }
  }

  /**
   * Check risk limits
   */
  private async checkRiskLimits(
    portfolioId: string,
    symbol: string,
    side: "BUY" | "SELL",
    quantity: number,
    price: number
  ): Promise<{
    allowed: boolean;
    violations: Array<{ type: string; limit: number; projected: number }>;
  }> {
    try {
      const url = `${RISK_SERVICE_URL}/api/risk/check-order`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolioId,
          symbol,
          side,
          quantity,
          price,
        }),
      });

      if (!response.ok) {
        throw new Error(`Risk API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      this.logger.error("Failed to check risk limits", error);
      // Default to not allowed if check fails
      return {
        allowed: false,
        violations: [{ type: "RISK_CHECK_ERROR", limit: 0, projected: 0 }],
      };
    }
  }

  /**
   * Create order via trading service
   */
  private async createOrder(params: {
    userId: string;
    portfolioId: string;
    symbol: string;
    side: "BUY" | "SELL";
    type: "MARKET" | "LIMIT";
    quantity: number;
    exchangeCredentialsId: string;
  }): Promise<{
    success: boolean;
    orderId?: string;
    positionId?: string;
    error?: string;
  }> {
    try {
      const url = `${TRADING_SERVICE_URL}/api/orders`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.error?.message || "Order creation failed",
        };
      }

      const data = await response.json();
      return {
        success: true,
        orderId: data.data.id,
        positionId: data.data.portfolioId, // Assuming this creates a position
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Start position monitoring with stop-loss and take-profit
   */
  private async startMonitoring(
    positionId: string,
    config: {
      stopLoss: number;
      takeProfit: number;
      trailingStopPercent: number;
    }
  ): Promise<void> {
    try {
      const url = `${RISK_SERVICE_URL}/api/risk/positions/${positionId}/monitor`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...config,
          autoCloseEnabled: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Monitoring API error: ${response.status}`);
      }

      this.logger.info("Started position monitoring", {
        positionId,
        ...config,
      });
    } catch (error) {
      this.logger.error("Failed to start monitoring", { error, positionId });
    }
  }

  /**
   * Set execution mode
   */
  setMode(mode: "PAPER" | "LIVE"): void {
    this.logger.info("Execution mode changed", { from: this.mode, to: mode });
    this.mode = mode;
  }

  /**
   * Get current mode
   */
  getMode(): "PAPER" | "LIVE" {
    return this.mode;
  }
}
