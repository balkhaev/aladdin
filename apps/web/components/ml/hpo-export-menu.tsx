/**
 * HPO Export Menu
 * Dropdown menu for exporting optimization results
 */

import {
  Check,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { useState } from "react";
import type { OptimizationResult } from "../../lib/api/ml";
import {
  copyToClipboard,
  downloadCSV,
  downloadJSON,
  exportOptimizationSummary,
  generateFilename,
  optimizationResultToCSV,
} from "../../lib/export-utils";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

type HPOExportMenuProps = {
  result: OptimizationResult;
};

export function HPOExportMenu({ result }: HPOExportMenuProps) {
  const [copied, setCopied] = useState(false);

  const handleExportJSON = () => {
    const filename = generateFilename(
      "hpo_result",
      "optimization",
      result.method,
      "json"
    );
    downloadJSON(result, filename);
  };

  const handleExportCSV = () => {
    const csv = optimizationResultToCSV(result);
    const filename = generateFilename(
      "hpo_trials",
      "optimization",
      result.method,
      "csv"
    );
    downloadCSV(csv, filename);
  };

  const handleExportSummary = () => {
    const { summary } = exportOptimizationSummary(result);
    const filename = generateFilename(
      "hpo_summary",
      "optimization",
      result.method,
      "txt"
    );
    const blob = new Blob([summary], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyBestParams = async () => {
    const params = JSON.stringify(result.bestParams, null, 2);
    const success = await copyToClipboard(params);

    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportJSON}>
          <FileJson className="mr-2 h-4 w-4" />
          <span>Export as JSON</span>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleExportCSV}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          <span>Export as CSV</span>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleExportSummary}>
          <FileText className="mr-2 h-4 w-4" />
          <span>Export Summary (TXT)</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleCopyBestParams}>
          {copied ? (
            <Check className="mr-2 h-4 w-4 text-green-500" />
          ) : (
            <FileJson className="mr-2 h-4 w-4" />
          )}
          <span>{copied ? "Copied!" : "Copy Best Params"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
