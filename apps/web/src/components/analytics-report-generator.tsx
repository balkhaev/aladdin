/**
 * Analytics Report Generator Component
 * Генерация и скачивание отчетов по портфелю (JSON/CSV)
 */

import { Download, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useGenerateReport } from "../hooks/use-analytics";
import type { PortfolioReport } from "../lib/api/analytics";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

type AnalyticsReportGeneratorProps = {
  portfolioId: string;
};

const MINUTES_IN_HOUR = 60;
const SECONDS_IN_MINUTE = 60;
const MILLISECONDS_IN_SECOND = 1000;
const HOURS_IN_DAY = 24;
const MILLISECONDS_IN_DAY =
  HOURS_IN_DAY * MINUTES_IN_HOUR * SECONDS_IN_MINUTE * MILLISECONDS_IN_SECOND;
const DEFAULT_PERIOD_DAYS = 30;

export function AnalyticsReportGenerator({
  portfolioId,
}: AnalyticsReportGeneratorProps) {
  const generateReport = useGenerateReport();

  const [format, setFormat] = useState<"json" | "csv">("json");
  const [from, setFrom] = useState(
    new Date(Date.now() - DEFAULT_PERIOD_DAYS * MILLISECONDS_IN_DAY)
      .toISOString()
      .split("T")[0]
  );
  const [to, setTo] = useState(new Date().toISOString().split("T")[0]);

  const handleGenerateReport = async () => {
    if (!portfolioId) {
      toast.error("Ошибка", {
        description: "Выберите портфель",
      });
      return;
    }

    try {
      const fromDate = new Date(from);
      const toDate = new Date(to);

      if (fromDate >= toDate) {
        toast.error("Ошибка", {
          description: "Дата начала должна быть раньше даты окончания",
        });
        return;
      }

      const result = await generateReport.mutateAsync({
        portfolioId,
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        format,
      });

      // Если CSV - скачиваем файл
      if (format === "csv" && result instanceof Blob) {
        const url = window.URL.createObjectURL(result);
        const a = document.createElement("a");
        a.href = url;
        a.download = `portfolio-report-${portfolioId}-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast.success("Отчет сгенерирован", {
          description: "CSV файл успешно скачан",
        });
      } else {
        // Если JSON - показываем данные
        const report = result as PortfolioReport;

        toast.success("Отчет сгенерирован", {
          description: `Всего сделок: ${report.statistics.totalTrades}, P&L: ${report.statistics.totalPnL.toFixed(2)}`,
        });

        // Скачиваем JSON файл
        const blob = new Blob([JSON.stringify(report, null, 2)], {
          type: "application/json",
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `portfolio-report-${portfolioId}-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      toast.error("Ошибка генерации отчета", {
        description:
          error instanceof Error ? error.message : "Неизвестная ошибка",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Генерация отчета
        </CardTitle>
        <CardDescription>
          Сгенерировать комплексный отчет по портфелю с риск-метриками
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Period Selection */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="from">Дата начала</Label>
            <Input
              id="from"
              onChange={(e) => setFrom(e.target.value)}
              type="date"
              value={from}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="to">Дата окончания</Label>
            <Input
              id="to"
              onChange={(e) => setTo(e.target.value)}
              type="date"
              value={to}
            />
          </div>
        </div>

        {/* Format Selection */}
        <div className="space-y-2">
          <Label htmlFor="format">Формат отчета</Label>
          <Select
            onValueChange={(v) => setFormat(v as "json" | "csv")}
            value={format}
          >
            <SelectTrigger id="format">
              <SelectValue placeholder="Выберите формат" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="json">JSON (с полными данными)</SelectItem>
              <SelectItem value="csv">CSV (для Excel/Google Sheets)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Info Box */}
        <div className="rounded-md bg-muted p-3 text-sm">
          <p className="font-medium">Отчет включает:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Статистика торговли (trades, P&L, win rate)</li>
            <li>Риск-метрики (VaR 95%/99%, Sharpe Ratio, Max Drawdown)</li>
            <li>Список всех сделок за период</li>
          </ul>
        </div>

        {/* Generate Button */}
        <Button
          className="w-full"
          disabled={generateReport.isPending || !portfolioId}
          onClick={handleGenerateReport}
        >
          <Download className="mr-2 h-4 w-4" />
          {generateReport.isPending ? "Генерация..." : "Скачать отчет"}
        </Button>
      </CardContent>
    </Card>
  );
}
