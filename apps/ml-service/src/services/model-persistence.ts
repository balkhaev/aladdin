import { promises as fs } from "node:fs";
import { join } from "node:path";
import type { Logger } from "@aladdin/logger";
import { LSTMNetwork } from "../models/lstm";

const MODELS_DIR = "./models";

export type ModelMetadata = {
  symbol: string;
  modelType: "LSTM" | "HYBRID";
  version: string;
  trainedAt: number;
  accuracy: number;
  trainingDuration: number;
  dataPoints: number;
  config: Record<string, unknown>;
  // Performance metrics
  mae?: number;
  rmse?: number;
  mape?: number;
  r2Score?: number;
  directionalAccuracy?: number;
};

/**
 * Model Persistence Service
 * Save and load trained ML models
 */
export class ModelPersistenceService {
  constructor(private logger: Logger) {
    this.ensureModelsDirectory();
  }

  /**
   * Save LSTM model to disk
   */
  async saveLSTMModel(
    model: LSTMNetwork,
    metadata: ModelMetadata
  ): Promise<void> {
    try {
      const filename = this.getModelFilename(
        metadata.symbol,
        metadata.modelType
      );
      const modelPath = join(MODELS_DIR, filename);
      const metadataPath = join(MODELS_DIR, `${filename}.meta.json`);

      // Save model weights
      const modelJSON = model.toJSON();
      await fs.writeFile(modelPath, modelJSON, "utf-8");

      // Save metadata
      await fs.writeFile(
        metadataPath,
        JSON.stringify(metadata, null, 2),
        "utf-8"
      );

      this.logger.info("Model saved", {
        symbol: metadata.symbol,
        path: modelPath,
      });
    } catch (error) {
      this.logger.error("Failed to save model", {
        symbol: metadata.symbol,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Load LSTM model from disk
   */
  async loadLSTMModel(
    symbol: string,
    modelType: "LSTM" | "HYBRID" = "LSTM"
  ): Promise<{ model: LSTMNetwork; metadata: ModelMetadata } | null> {
    try {
      const filename = this.getModelFilename(symbol, modelType);
      const modelPath = join(MODELS_DIR, filename);
      const metadataPath = join(MODELS_DIR, `${filename}.meta.json`);

      // Check if model exists
      try {
        await fs.access(modelPath);
      } catch {
        return null;
      }

      // Load model weights
      const modelJSON = await fs.readFile(modelPath, "utf-8");
      const model = LSTMNetwork.fromJSON(modelJSON);

      // Load metadata
      const metadataJSON = await fs.readFile(metadataPath, "utf-8");
      const metadata = JSON.parse(metadataJSON) as ModelMetadata;

      this.logger.info("Model loaded", {
        symbol,
        trainedAt: new Date(metadata.trainedAt).toISOString(),
      });

      return { model, metadata };
    } catch (error) {
      this.logger.error("Failed to load model", {
        symbol,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * List all saved models
   */
  async listModels(): Promise<
    Array<ModelMetadata & { size: number; lastTrained: number }>
  > {
    try {
      const files = await fs.readdir(MODELS_DIR);
      const metadataFiles = files.filter((f) => f.endsWith(".meta.json"));

      const models: Array<
        ModelMetadata & { size: number; lastTrained: number }
      > = [];

      for (const file of metadataFiles) {
        const metadataPath = join(MODELS_DIR, file);
        const metadataJSON = await fs.readFile(metadataPath, "utf-8");
        const metadata = JSON.parse(metadataJSON) as ModelMetadata;

        // Get model file size
        const modelFileName = file.replace(".meta.json", "");
        const modelPath = join(MODELS_DIR, modelFileName);
        let size = 0;

        try {
          const stats = await fs.stat(modelPath);
          size = stats.size;
        } catch {
          // Model file might not exist
          this.logger.warn("Model file not found for metadata", {
            file: modelFileName,
          });
        }

        models.push({
          ...metadata,
          size,
          lastTrained: metadata.trainedAt, // Add lastTrained for frontend compatibility
        });
      }

      return models.sort((a, b) => b.trainedAt - a.trainedAt);
    } catch (error) {
      this.logger.error("Failed to list models", { error });
      return [];
    }
  }

  /**
   * Delete model from disk
   */
  async deleteModel(
    symbol: string,
    modelType: "LSTM" | "HYBRID" = "LSTM"
  ): Promise<boolean> {
    try {
      const filename = this.getModelFilename(symbol, modelType);
      const modelPath = join(MODELS_DIR, filename);
      const metadataPath = join(MODELS_DIR, `${filename}.meta.json`);

      await fs.unlink(modelPath);
      await fs.unlink(metadataPath);

      this.logger.info("Model deleted", { symbol });
      return true;
    } catch (error) {
      this.logger.error("Failed to delete model", { symbol, error });
      return false;
    }
  }

  /**
   * Check if model exists
   */
  async modelExists(
    symbol: string,
    modelType: "LSTM" | "HYBRID" = "LSTM"
  ): Promise<boolean> {
    const filename = this.getModelFilename(symbol, modelType);
    const modelPath = join(MODELS_DIR, filename);

    try {
      await fs.access(modelPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get model age in milliseconds
   */
  async getModelAge(
    symbol: string,
    modelType: "LSTM" | "HYBRID" = "LSTM"
  ): Promise<number | null> {
    const result = await this.loadLSTMModel(symbol, modelType);

    if (!result) return null;

    return Date.now() - result.metadata.trainedAt;
  }

  /**
   * Clean up old models (older than specified days)
   */
  async cleanupOldModels(maxAgeDays: number): Promise<number> {
    try {
      const models = await this.listModels();
      const maxAgeMs = maxAgeDays * 86_400_000;
      let deletedCount = 0;

      for (const model of models) {
        const age = Date.now() - model.trainedAt;

        if (age > maxAgeMs) {
          const deleted = await this.deleteModel(model.symbol, model.modelType);
          if (deleted) deletedCount++;
        }
      }

      this.logger.info("Cleaned up old models", {
        deletedCount,
        maxAgeDays,
      });

      return deletedCount;
    } catch (error) {
      this.logger.error("Failed to cleanup old models", { error });
      return 0;
    }
  }

  /**
   * Ensure models directory exists
   */
  private async ensureModelsDirectory(): Promise<void> {
    try {
      await fs.mkdir(MODELS_DIR, { recursive: true });
    } catch (error) {
      this.logger.error("Failed to create models directory", { error });
    }
  }

  /**
   * Get model filename
   */
  private getModelFilename(symbol: string, modelType: string): string {
    return `${symbol}_${modelType.toLowerCase()}.json`;
  }
}
