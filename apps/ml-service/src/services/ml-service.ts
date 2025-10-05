import type { BaseServiceConfig } from "@aladdin/service";
import { BaseService } from "@aladdin/service";
import { AnomalyDetectionService } from "./anomaly-detection";
import { BacktestingService } from "./backtesting";
import { EnsembleService } from "./ensemble";
import { FeatureEngineeringService } from "./feature-engineering";
import { HyperparameterOptimizationService } from "./hyperparameter-optimization";
import { LSTMPredictionService } from "./lstm-prediction";
import { MarketRegimeService } from "./market-regime";
import { ModelPersistenceService } from "./model-persistence";
import { PricePredictionService } from "./price-prediction";

/**
 * ML Service - Machine Learning и предсказание цен
 */
export class MLService extends BaseService {
  featureService: FeatureEngineeringService;
  regimeService: MarketRegimeService;
  predictionService: PricePredictionService;
  lstmService: LSTMPredictionService;
  persistenceService: ModelPersistenceService;
  backtestingService: BacktestingService;
  hpoService: HyperparameterOptimizationService;
  anomalyService: AnomalyDetectionService;
  ensembleService: EnsembleService;

  constructor(config: BaseServiceConfig) {
    super(config);

    if (!this.clickhouse) {
      throw new Error("ClickHouse client is required for ML Service");
    }

    // Инициализируем все подсервисы
    this.featureService = new FeatureEngineeringService(
      this.clickhouse,
      this.logger
    );
    this.regimeService = new MarketRegimeService(this.clickhouse, this.logger);
    this.predictionService = new PricePredictionService(
      this.clickhouse,
      this.featureService,
      this.regimeService,
      this.logger
    );
    this.lstmService = new LSTMPredictionService(
      this.clickhouse,
      this.featureService,
      this.logger
    );
    this.persistenceService = new ModelPersistenceService(this.logger);
    this.backtestingService = new BacktestingService(
      this.clickhouse,
      this.logger,
      this.lstmService
    );
    this.hpoService = new HyperparameterOptimizationService(
      this.clickhouse,
      this.backtestingService,
      this.logger
    );
    this.anomalyService = new AnomalyDetectionService(
      this.clickhouse,
      this.logger
    );
    this.ensembleService = new EnsembleService(
      this.clickhouse,
      this.lstmService,
      this.predictionService,
      this.featureService,
      this.regimeService,
      this.logger
    );
  }

  getServiceName(): string {
    return "ml-service";
  }

  protected async onInitialize(): Promise<void> {
    await Promise.resolve();
    this.logger.info("ML Service components initialized", {
      components: [
        "FeatureEngineering",
        "MarketRegime",
        "PricePrediction",
        "LSTM",
        "ModelPersistence",
        "Backtesting",
        "HyperparameterOptimization",
        "AnomalyDetection",
        "Ensemble",
      ],
    });
  }

  protected async onStart(): Promise<void> {
    await Promise.resolve();
    this.logger.info("ML Service started");
  }

  protected async onStop(): Promise<void> {
    await Promise.resolve();
    this.logger.info("ML Service stopped");
  }
}
