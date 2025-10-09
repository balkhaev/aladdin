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
  const { trials, method, optimizationMetric, totalTrials, bestValue } = result;

  // Header
  const headers = [
    "Trial Number",
    "Score",
    "MAE",
    "RMSE",
    "MAPE",
    "R2 Score",
    "Directional Accuracy",
    ...Object.keys(trials[0]?.params || {}),
  ];

  // Rows
  const rows = trials.map((trial) => {
    const baseValues = [
      trial.trialNumber,
      trial.value.toFixed(4),
      trial.metrics.mae.toFixed(2),
      trial.metrics.rmse.toFixed(2),
      trial.metrics.mape.toFixed(2),
      trial.metrics.r2Score.toFixed(4),
      (trial.metrics.directionalAccuracy * 100).toFixed(2),
    ];

    const hyperparamValues = Object.values(trial.params).map((v) => String(v));

    return [...baseValues, ...hyperparamValues];
  });

  // Metadata rows
  const metadata = [
    ["# Hyperparameter Optimization Results"],
    [`# Method: ${method}`],
    [`# Optimization Metric: ${optimizationMetric}`],
    [`# Total Trials: ${totalTrials}`],
    [`# Best Value: ${bestValue.toFixed(4)}`],
    [`# Completed At: ${new Date(result.completedAt).toISOString()}`],
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
  bestParams: Record<string, number | boolean | string>;
  allTrials: Array<{
    trialNumber: number;
    value: number;
    params: Record<string, number | boolean | string>;
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
    bestParams,
    bestValue,
    bestMetrics,
    method,
    optimizationMetric,
    trials,
  } = result;

  const summary = `
Hyperparameter Optimization Results
====================================

Configuration:
- Method: ${method}
- Optimization Metric: ${optimizationMetric}
- Trials: ${trials.length}

Best Result:
- Score: ${bestValue.toFixed(4)}
- MAE: $${bestMetrics.mae.toFixed(2)}
- RMSE: $${bestMetrics.rmse.toFixed(2)}
- MAPE: ${bestMetrics.mape.toFixed(2)}%
- R² Score: ${bestMetrics.r2Score.toFixed(4)}
- Directional Accuracy: ${(bestMetrics.directionalAccuracy * 100).toFixed(2)}%

Best Hyperparameters:
${Object.entries(bestParams)
  .map(([key, value]) => `- ${key}: ${value}`)
  .join("\n")}
`.trim();

  return {
    summary,
    bestParams,
    allTrials: trials.map((t) => ({
      trialNumber: t.trialNumber,
      value: t.value,
      params: t.params,
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
