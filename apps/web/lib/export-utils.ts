/**
 * Export Utilities
 * Functions for exporting data in various formats
 */

import type { OptimizationResult } from "./api/ml";

/**
 * Download data as JSON file
 */
export function downloadJSON(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  downloadBlob(blob, filename);
}

/**
 * Download data as CSV file
 */
export function downloadCSV(data: string, filename: string): void {
  const blob = new Blob([data], { type: "text/csv" });
  downloadBlob(blob, filename);
}

/**
 * Download blob as file
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Convert optimization result to CSV format
 */
export function optimizationResultToCSV(result: OptimizationResult): string {
  const { trials, config } = result;

  // Header
  const headers = [
    "Trial ID",
    "Score",
    "MAE",
    "RMSE",
    "MAPE",
    "R2 Score",
    "Directional Accuracy",
    "Execution Time (s)",
    ...Object.keys(trials[0]?.hyperparameters || {}),
  ];

  // Rows
  const rows = trials.map((trial) => {
    const baseValues = [
      trial.trialId,
      trial.score.toFixed(4),
      trial.metrics.mae.toFixed(2),
      trial.metrics.rmse.toFixed(2),
      trial.metrics.mape.toFixed(2),
      trial.metrics.r2Score.toFixed(4),
      trial.metrics.directionalAccuracy.toFixed(2),
      (trial.executionTime / 1000).toFixed(1),
    ];

    const hyperparamValues = Object.values(trial.hyperparameters).map((v) =>
      String(v)
    );

    return [...baseValues, ...hyperparamValues];
  });

  // Metadata rows
  const metadata = [
    ["# Hyperparameter Optimization Results"],
    [`# Symbol: ${config.symbol}`],
    [`# Model Type: ${config.modelType}`],
    [`# Horizon: ${config.horizon}`],
    [`# Method: ${config.method}`],
    [`# Optimization Metric: ${config.optimizationMetric}`],
    [
      `# Period: ${new Date(config.startDate).toISOString()} to ${new Date(config.endDate).toISOString()}`,
    ],
    [`# Total Trials: ${trials.length}`],
    [
      `# Best Trial: ${result.bestTrial.trialId} (Score: ${result.bestTrial.score.toFixed(4)})`,
    ],
    [`# Improvement: ${result.improvementPercentage.toFixed(2)}%`],
    [],
  ];

  // Combine all
  const allRows = [...metadata, headers, ...rows];

  return allRows.map((row) => row.join(",")).join("\n");
}

/**
 * Generate filename with timestamp
 */
export function generateFilename(
  prefix: string,
  symbol: string,
  modelType: string,
  extension: string
): string {
  const timestamp = new Date().toISOString().split("T")[0];
  return `${prefix}_${symbol}_${modelType}_${timestamp}.${extension}`;
}

/**
 * Export optimization result summary
 */
export function exportOptimizationSummary(result: OptimizationResult): {
  summary: string;
  bestParams: Record<string, number>;
  allTrials: Array<{
    trialId: string;
    score: number;
    hyperparameters: Record<string, number>;
    metrics: {
      mae: number;
      rmse: number;
      mape: number;
      r2Score: number;
      directionalAccuracy: number;
    };
  }>;
} {
  const {
    config,
    bestHyperparameters,
    bestTrial,
    improvementPercentage,
    trials,
  } = result;

  const summary = `
Hyperparameter Optimization Results
====================================

Configuration:
- Symbol: ${config.symbol}
- Model Type: ${config.modelType}
- Horizon: ${config.horizon}
- Method: ${config.method}
- Optimization Metric: ${config.optimizationMetric}
- Trials: ${trials.length}

Best Trial: ${bestTrial.trialId}
- Score: ${bestTrial.score.toFixed(4)}
- Improvement: ${improvementPercentage.toFixed(2)}%
- MAE: $${bestTrial.metrics.mae.toFixed(2)}
- RMSE: $${bestTrial.metrics.rmse.toFixed(2)}
- MAPE: ${bestTrial.metrics.mape.toFixed(2)}%
- R² Score: ${bestTrial.metrics.r2Score.toFixed(4)}
- Directional Accuracy: ${bestTrial.metrics.directionalAccuracy.toFixed(2)}%

Best Hyperparameters:
${Object.entries(bestHyperparameters)
  .map(([key, value]) => `- ${key}: ${value}`)
  .join("\n")}
`.trim();

  return {
    summary,
    bestParams: bestHyperparameters,
    allTrials: trials.map((t) => ({
      trialId: t.trialId,
      score: t.score,
      hyperparameters: t.hyperparameters,
      metrics: t.metrics,
    })),
  };
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textarea);
    return success;
  }
}
