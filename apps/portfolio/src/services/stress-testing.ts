/**
 * Stress Testing Engine
 *
 * Simulates extreme market scenarios to assess portfolio resilience:
 * - Historical crashes (2020 COVID crash, 2022 Crypto Winter, etc.)
 * - Hypothetical scenarios (exchange hack, regulatory crackdown, etc.)
 * - Custom user-defined scenarios
 *
 * Helps answer: "What would happen to my portfolio if...?"
 */

import type { Logger } from "@aladdin/logger";

export type StressScenario = {
  name: string;
  description: string;
  /** Price changes by symbol (as percentage, e.g., -70 for -70%) */
  priceShocks: Map<string, number>;
  /** Volume changes (as percentage) */
  volumeShock?: number;
  /** Spread widening (as multiplier, e.g., 5 for 5x wider spreads) */
  spreadShock?: number;
  /** Liquidity reduction (as percentage) */
  liquidityShock?: number;
  /** Correlation increase (new correlation level, 0-1) */
  correlationShock?: number;
};

export type StressTestResult = {
  scenario: string;
  description: string;
  /** Current portfolio value */
  currentValue: number;
  /** Portfolio value after stress */
  stressedValue: number;
  /** Absolute loss */
  loss: number;
  /** Loss as percentage */
  lossPercentage: number;
  /** Position-level impacts */
  positionImpacts: Array<{
    symbol: string;
    currentValue: number;
    stressedValue: number;
    loss: number;
    lossPercentage: number;
  }>;
  /** Liquidation risk (true if portfolio would be liquidated) */
  liquidationRisk: boolean;
  /** Margin call risk */
  marginCallRisk: boolean;
  /** Expected recovery time (days) */
  recoveryTimeEstimate?: number;
  /** Timestamp of test */
  timestamp: Date;
};

export type StressTestSummary = {
  /** All scenario results */
  scenarios: StressTestResult[];
  /** Worst-case scenario */
  worstCase: StressTestResult;
  /** Best-case scenario (least bad) */
  bestCase: StressTestResult;
  /** Average loss across all scenarios */
  averageLoss: number;
  averageLossPercentage: number;
  /** Portfolio resilience score (0-100, higher is better) */
  resilienceScore: number;
  /** Recommendations */
  recommendations: string[];
};

// Price shock constants
const COVID_BTC_SHOCK = -50;
const COVID_ETH_SHOCK = -60;
const COVID_ALT_SHOCK = -70;
const COVID_VOLUME_SHOCK = 300;
const COVID_SPREAD_SHOCK = 5;
const COVID_LIQUIDITY_SHOCK = -40;

const WINTER_BTC_SHOCK = -70;
const WINTER_ETH_SHOCK = -75;
const WINTER_ALT_SHOCK = -85;
const WINTER_VOLUME_SHOCK = -60;
const WINTER_LIQUIDITY_SHOCK = -70;
const WINTER_CORRELATION_SHOCK = 0.95;

const FLASH_BTC_SHOCK = -30;
const FLASH_ETH_SHOCK = -35;
const FLASH_ALT_SHOCK = -50;
const FLASH_VOLUME_SHOCK = 500;
const FLASH_SPREAD_SHOCK = 10;
const FLASH_LIQUIDITY_SHOCK = -90;

const HACK_BTC_SHOCK = -25;
const HACK_ETH_SHOCK = -30;
const HACK_ALT_SHOCK = -40;
const HACK_VOLUME_SHOCK = -80;
const HACK_LIQUIDITY_SHOCK = -95;
const HACK_SPREAD_SHOCK = 20;

const REGULATORY_BTC_SHOCK = -40;
const REGULATORY_ETH_SHOCK = -45;
const REGULATORY_ALT_SHOCK = -60;
const REGULATORY_VOLUME_SHOCK = -80;
const REGULATORY_LIQUIDITY_SHOCK = -85;

const SWAN_BTC_SHOCK = -60;
const SWAN_ETH_SHOCK = -65;
const SWAN_ALT_SHOCK = -75;
const SWAN_VOLUME_SHOCK = -70;
const SWAN_LIQUIDITY_SHOCK = -90;
const SWAN_SPREAD_SHOCK = 15;
const SWAN_CORRELATION_SHOCK = 0.98;

const BULL_BTC_SHOCK = -45;
const BULL_ETH_SHOCK = -50;
const BULL_ALT_SHOCK = -65;
const BULL_VOLUME_SHOCK = 200;
const BULL_LIQUIDITY_SHOCK = -50;

const DEPEG_BTC_SHOCK = -35;
const DEPEG_ETH_SHOCK = -40;
const DEPEG_USDT_SHOCK = -5;
const DEPEG_USDC_SHOCK = -2;
const DEPEG_ALT_SHOCK = -50;
const DEPEG_VOLUME_SHOCK = 400;
const DEPEG_LIQUIDITY_SHOCK = -80;

// Predefined historical scenarios
const HISTORICAL_SCENARIOS: StressScenario[] = [
  {
    name: "COVID-19 Crash (Mar 2020)",
    description: "Black Thursday - Bitcoin dropped 50% in 24 hours",
    priceShocks: new Map([
      ["BTCUSDT", COVID_BTC_SHOCK],
      ["ETHUSDT", COVID_ETH_SHOCK],
      ["default", COVID_ALT_SHOCK],
    ]),
    volumeShock: COVID_VOLUME_SHOCK,
    spreadShock: COVID_SPREAD_SHOCK,
    liquidityShock: COVID_LIQUIDITY_SHOCK,
  },
  {
    name: "Crypto Winter 2022",
    description: "Luna/FTX collapse - prolonged bear market",
    priceShocks: new Map([
      ["BTCUSDT", WINTER_BTC_SHOCK],
      ["ETHUSDT", WINTER_ETH_SHOCK],
      ["default", WINTER_ALT_SHOCK],
    ]),
    volumeShock: WINTER_VOLUME_SHOCK,
    liquidityShock: WINTER_LIQUIDITY_SHOCK,
    correlationShock: WINTER_CORRELATION_SHOCK,
  },
  {
    name: "Flash Crash",
    description: "Sudden liquidity crisis causing rapid price drop",
    priceShocks: new Map([
      ["BTCUSDT", FLASH_BTC_SHOCK],
      ["ETHUSDT", FLASH_ETH_SHOCK],
      ["default", FLASH_ALT_SHOCK],
    ]),
    volumeShock: FLASH_VOLUME_SHOCK,
    spreadShock: FLASH_SPREAD_SHOCK,
    liquidityShock: FLASH_LIQUIDITY_SHOCK,
  },
  {
    name: "Exchange Hack",
    description: "Major exchange security breach and trading halt",
    priceShocks: new Map([
      ["BTCUSDT", HACK_BTC_SHOCK],
      ["ETHUSDT", HACK_ETH_SHOCK],
      ["default", HACK_ALT_SHOCK],
    ]),
    volumeShock: HACK_VOLUME_SHOCK,
    liquidityShock: HACK_LIQUIDITY_SHOCK,
    spreadShock: HACK_SPREAD_SHOCK,
  },
  {
    name: "Regulatory Crackdown",
    description: "Major governments ban crypto trading",
    priceShocks: new Map([
      ["BTCUSDT", REGULATORY_BTC_SHOCK],
      ["ETHUSDT", REGULATORY_ETH_SHOCK],
      ["default", REGULATORY_ALT_SHOCK],
    ]),
    volumeShock: REGULATORY_VOLUME_SHOCK,
    liquidityShock: REGULATORY_LIQUIDITY_SHOCK,
  },
  {
    name: "Black Swan Event",
    description: "Unforeseen catastrophic event",
    priceShocks: new Map([
      ["BTCUSDT", SWAN_BTC_SHOCK],
      ["ETHUSDT", SWAN_ETH_SHOCK],
      ["default", SWAN_ALT_SHOCK],
    ]),
    volumeShock: SWAN_VOLUME_SHOCK,
    liquidityShock: SWAN_LIQUIDITY_SHOCK,
    spreadShock: SWAN_SPREAD_SHOCK,
    correlationShock: SWAN_CORRELATION_SHOCK,
  },
  {
    name: "Bull Market Peak",
    description: "Extreme euphoria and overextension",
    priceShocks: new Map([
      ["BTCUSDT", BULL_BTC_SHOCK],
      ["ETHUSDT", BULL_ETH_SHOCK],
      ["default", BULL_ALT_SHOCK],
    ]),
    volumeShock: BULL_VOLUME_SHOCK,
    liquidityShock: BULL_LIQUIDITY_SHOCK,
  },
  {
    name: "Stablecoin De-peg",
    description: "Major stablecoin loses peg, contagion spreads",
    priceShocks: new Map([
      ["BTCUSDT", DEPEG_BTC_SHOCK],
      ["ETHUSDT", DEPEG_ETH_SHOCK],
      ["USDTUSDT", DEPEG_USDT_SHOCK],
      ["USDCUSDT", DEPEG_USDC_SHOCK],
      ["default", DEPEG_ALT_SHOCK],
    ]),
    volumeShock: DEPEG_VOLUME_SHOCK,
    liquidityShock: DEPEG_LIQUIDITY_SHOCK,
  },
];

// Constants
const PERCENT_MULTIPLIER = 100;
const LIQUIDATION_THRESHOLD = 0.8; // 80% loss triggers liquidation
const MARGIN_CALL_THRESHOLD = 0.5; // 50% loss triggers margin call
const MAX_RESILIENCE_SCORE = 100;

export class StressTestingEngine {
  constructor(private logger: Logger) {}

  /**
   * Run stress test on portfolio
   *
   * @param positions Current portfolio positions
   * @param scenarios Scenarios to test (defaults to historical scenarios)
   * @returns Stress test results
   */
  runStressTest(params: {
    positions: Array<{
      symbol: string;
      quantity: number;
      currentPrice: number;
    }>;
    leverage?: number;
    scenarios?: StressScenario[];
  }): StressTestSummary {
    const {
      positions,
      leverage = 1,
      scenarios = HISTORICAL_SCENARIOS,
    } = params;

    this.logger.info("Running stress test", {
      positionsCount: positions.length,
      scenariosCount: scenarios.length,
      leverage,
    });

    const currentValue = this.calculatePortfolioValue(positions);

    // Run each scenario
    const results: StressTestResult[] = scenarios.map((scenario) =>
      this.runScenario({ positions, scenario, leverage, currentValue })
    );

    // Find worst and best cases
    const worstCase = results.reduce((worst, current) =>
      current.loss > worst.loss ? current : worst
    );
    const bestCase = results.reduce((best, current) =>
      current.loss < best.loss ? current : best
    );

    // Calculate averages
    const averageLoss =
      results.reduce((sum, r) => sum + r.loss, 0) / results.length;
    const averageLossPercentage =
      results.reduce((sum, r) => sum + r.lossPercentage, 0) / results.length;

    // Calculate resilience score (0-100)
    // Lower average loss = higher resilience
    const resilienceScore = Math.max(
      0,
      Math.min(
        MAX_RESILIENCE_SCORE,
        MAX_RESILIENCE_SCORE - averageLossPercentage
      )
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      results,
      worstCase,
      averageLossPercentage,
      leverage,
    });

    this.logger.info("Stress test completed", {
      worstCaseScenario: worstCase.scenario,
      worstCaseLoss: worstCase.lossPercentage,
      averageLoss: averageLossPercentage,
      resilienceScore,
    });

    return {
      scenarios: results,
      worstCase,
      bestCase,
      averageLoss,
      averageLossPercentage,
      resilienceScore,
      recommendations,
    };
  }

  /**
   * Run a single scenario
   * @private
   */
  private runScenario(params: {
    positions: Array<{
      symbol: string;
      quantity: number;
      currentPrice: number;
    }>;
    scenario: StressScenario;
    leverage: number;
    currentValue: number;
  }): StressTestResult {
    const { positions, scenario, leverage, currentValue } = params;

    const positionImpacts = positions.map((position) => {
      const currentPositionValue = position.quantity * position.currentPrice;

      // Get price shock for this symbol
      const priceShock =
        scenario.priceShocks.get(position.symbol) ??
        scenario.priceShocks.get("default") ??
        0;

      // Calculate stressed price
      const stressedPrice =
        position.currentPrice * (1 + priceShock / PERCENT_MULTIPLIER);
      const stressedValue = position.quantity * stressedPrice;

      const loss = currentPositionValue - stressedValue;
      const lossPercentage = (loss / currentPositionValue) * PERCENT_MULTIPLIER;

      return {
        symbol: position.symbol,
        currentValue: currentPositionValue,
        stressedValue,
        loss,
        lossPercentage,
      };
    });

    // Calculate total stressed value
    const stressedValue = positionImpacts.reduce(
      (sum, p) => sum + p.stressedValue,
      0
    );
    const loss = currentValue - stressedValue;
    const lossPercentage = (loss / currentValue) * PERCENT_MULTIPLIER;

    // Amplify loss by leverage
    const leveragedLoss = loss * leverage;
    const leveragedLossPercentage = lossPercentage * leverage;

    // Check for liquidation and margin call risk
    const liquidationRisk =
      leveragedLossPercentage >= LIQUIDATION_THRESHOLD * PERCENT_MULTIPLIER;
    const marginCallRisk =
      leveragedLossPercentage >= MARGIN_CALL_THRESHOLD * PERCENT_MULTIPLIER;

    // Estimate recovery time based on loss severity
    const recoveryTimeEstimate = this.estimateRecoveryTime(lossPercentage);

    return {
      scenario: scenario.name,
      description: scenario.description,
      currentValue,
      stressedValue,
      loss: leveragedLoss,
      lossPercentage: leveragedLossPercentage,
      positionImpacts,
      liquidationRisk,
      marginCallRisk,
      recoveryTimeEstimate,
      timestamp: new Date(),
    };
  }

  /**
   * Calculate total portfolio value
   * @private
   */
  private calculatePortfolioValue(
    positions: Array<{
      symbol: string;
      quantity: number;
      currentPrice: number;
    }>
  ): number {
    return positions.reduce((sum, p) => sum + p.quantity * p.currentPrice, 0);
  }

  /**
   * Estimate recovery time based on loss severity
   * @private
   */
  private estimateRecoveryTime(lossPercentage: number): number {
    // Empirical estimates based on crypto market history
    const RECOVERY_30_DAYS = 30;
    const RECOVERY_90_DAYS = 90;
    const RECOVERY_180_DAYS = 180;
    const RECOVERY_365_DAYS = 365;
    const RECOVERY_730_DAYS = 730;

    const LOSS_THRESHOLD_20 = 20;
    const LOSS_THRESHOLD_40 = 40;
    const LOSS_THRESHOLD_60 = 60;
    const LOSS_THRESHOLD_80 = 80;

    if (lossPercentage < LOSS_THRESHOLD_20) return RECOVERY_30_DAYS; // < 20%: ~30 days
    if (lossPercentage < LOSS_THRESHOLD_40) return RECOVERY_90_DAYS; // 20-40%: ~90 days
    if (lossPercentage < LOSS_THRESHOLD_60) return RECOVERY_180_DAYS; // 40-60%: ~180 days
    if (lossPercentage < LOSS_THRESHOLD_80) return RECOVERY_365_DAYS; // 60-80%: ~1 year
    return RECOVERY_730_DAYS; // > 80%: ~2 years
  }

  /**
   * Generate recommendations based on stress test results
   * @private
   */
  private generateRecommendations(params: {
    results: StressTestResult[];
    worstCase: StressTestResult;
    averageLossPercentage: number;
    leverage: number;
  }): string[] {
    const { results, worstCase, averageLossPercentage, leverage } = params;

    const recommendations: string[] = [];

    // Leverage recommendations
    const LEVERAGE_THRESHOLD_3 = 3;
    const LEVERAGE_THRESHOLD_2 = 2;
    const RECOMMENDED_LEVERAGE = 2;
    if (leverage > LEVERAGE_THRESHOLD_3) {
      recommendations.push(
        `⚠️ Высокое плечо (${String(leverage)}x). Критически опасно в стресс-сценариях. Рекомендуем снизить до ${String(RECOMMENDED_LEVERAGE)}x или ниже.`
      );
    } else if (leverage > LEVERAGE_THRESHOLD_2) {
      recommendations.push(
        `⚡ Умеренное плечо (${leverage}x). Рассмотрите снижение для улучшения устойчивости.`
      );
    }

    // Loss severity recommendations
    const LOSS_THRESHOLD_50 = 50;
    const LOSS_THRESHOLD_30 = 30;
    if (averageLossPercentage > LOSS_THRESHOLD_50) {
      recommendations.push(
        `🚨 Критический уровень риска: средняя потеря ${averageLossPercentage.toFixed(1)}%. Необходима срочная диверсификация.`
      );
    } else if (averageLossPercentage > LOSS_THRESHOLD_30) {
      recommendations.push(
        `⚠️ Высокий уровень риска: средняя потеря ${averageLossPercentage.toFixed(1)}%. Рекомендуем улучшить диверсификацию.`
      );
    }

    // Liquidation risk
    const liquidationScenarios = results.filter((r) => r.liquidationRisk);
    if (liquidationScenarios.length > 0) {
      recommendations.push(
        `❌ Риск ликвидации в ${liquidationScenarios.length} сценариях. Увеличьте маржу или снизите позиции.`
      );
    }

    // Margin call risk
    const marginCallScenarios = results.filter((r) => r.marginCallRisk);
    const MARGIN_CALL_THRESHOLD_COUNT = 3;
    if (marginCallScenarios.length > MARGIN_CALL_THRESHOLD_COUNT) {
      recommendations.push(
        `⚠️ Риск margin call в ${marginCallScenarios.length} сценариях. Держите больше свободной маржи.`
      );
    }

    // Worst case specific
    const WORST_CASE_THRESHOLD_70 = 70;
    if (worstCase.lossPercentage > WORST_CASE_THRESHOLD_70) {
      recommendations.push(
        `💀 В наихудшем сценарии "${worstCase.scenario}" потери составят ${worstCase.lossPercentage.toFixed(1)}%. Хеджируйте риски опционами или стоп-лоссами.`
      );
    }

    // Position-specific recommendations
    const CONCENTRATION_MULTIPLIER = 1.5;
    const concentratedPositions = worstCase.positionImpacts.filter(
      (p) => p.lossPercentage > averageLossPercentage * CONCENTRATION_MULTIPLIER
    );
    const CONCENTRATED_POSITIONS_THRESHOLD = 2;
    if (concentratedPositions.length >= CONCENTRATED_POSITIONS_THRESHOLD) {
      const symbols = concentratedPositions.map((p) => p.symbol).join(", ");
      recommendations.push(
        `📊 Высокая концентрация риска в: ${symbols}. Рассмотрите ребалансировку.`
      );
    }

    // Recovery time warning
    const RECOVERY_THRESHOLD_180 = 180;
    if (
      worstCase.recoveryTimeEstimate &&
      worstCase.recoveryTimeEstimate > RECOVERY_THRESHOLD_180
    ) {
      recommendations.push(
        `⏳ Восстановление после худшего сценария займет ~${String(worstCase.recoveryTimeEstimate)} дней. Убедитесь, что готовы к длительному drawdown.`
      );
    }

    // Positive feedback if low risk
    const LOW_RISK_THRESHOLD = 20;
    if (
      averageLossPercentage < LOW_RISK_THRESHOLD &&
      leverage <= LEVERAGE_THRESHOLD_2
    ) {
      recommendations.push(
        "✅ Портфель демонстрирует хорошую устойчивость к стресс-сценариям. Продолжайте следить за диверсификацией."
      );
    }

    return recommendations;
  }

  /**
   * Get predefined historical scenarios
   */
  getHistoricalScenarios(): StressScenario[] {
    return [...HISTORICAL_SCENARIOS];
  }

  /**
   * Create custom scenario
   */
  createCustomScenario(params: {
    name: string;
    description: string;
    priceShocks: Record<string, number>;
    volumeShock?: number;
    spreadShock?: number;
    liquidityShock?: number;
  }): StressScenario {
    return {
      name: params.name,
      description: params.description,
      priceShocks: new Map(Object.entries(params.priceShocks)),
      volumeShock: params.volumeShock,
      spreadShock: params.spreadShock,
      liquidityShock: params.liquidityShock,
    };
  }
}
