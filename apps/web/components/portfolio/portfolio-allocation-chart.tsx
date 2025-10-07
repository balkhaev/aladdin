/**
 * Portfolio Allocation Chart Component
 * Pie chart showing asset distribution
 */

import { PieChart } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortfolio } from "@/hooks/use-portfolio";

const CANVAS_PADDING = 10;
const BORDER_WIDTH = 2;
const PERCENTAGE_DIVISOR = 100;
const LEGEND_ITEM_HEIGHT = 24;
const LEGEND_CIRCLE_RADIUS = 6;
const LEGEND_PADDING = 16;
const LEGEND_OFFSET = 80;
const LEGEND_WIDTH = 120;
const LEGEND_Y_OFFSET = 20;
const TEXT_Y_OFFSET = 4;
const DECIMAL_PLACES = 1;
const PERCENTAGE_PRECISION = 100;

type PortfolioAllocationChartProps = {
  portfolioId: string;
};

// Generate vibrant colors for chart segments
const COLORS = [
  "#f7931a", // Bitcoin orange
  "#627eea", // Ethereum blue
  "#10b981", // Green
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#3b82f6", // Blue
  "#ef4444", // Red
];

export function PortfolioAllocationChart({
  portfolioId,
}: PortfolioAllocationChartProps) {
  const { data: portfolio, isLoading } = usePortfolio(portfolioId);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!(canvasRef.current && portfolio)) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvas;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - CANVAS_PADDING - LEGEND_OFFSET;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Calculate allocations
    const allocations = portfolio.positions.map((position) => ({
      symbol: position.symbol,
      value: position.value,
      percentage:
        (position.value / portfolio.totalValue) * PERCENTAGE_PRECISION,
    }));

    // Sort by value descending
    allocations.sort((a, b) => b.value - a.value);

    let currentAngle = -Math.PI / 2; // Start at top

    // Draw pie segments
    for (let i = 0; i < allocations.length; i++) {
      const allocation = allocations[i];
      const sliceAngle =
        (allocation.percentage / PERCENTAGE_DIVISOR) * 2 * Math.PI;
      const color = COLORS[i % COLORS.length];

      // Draw segment
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(
        centerX,
        centerY,
        radius,
        currentAngle,
        currentAngle + sliceAngle
      );
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = BORDER_WIDTH;
      ctx.stroke();

      currentAngle += sliceAngle;
    }

    // Draw legend
    const legendX = width - LEGEND_WIDTH;
    const legendY = LEGEND_Y_OFFSET;

    for (let i = 0; i < allocations.length; i++) {
      const allocation = allocations[i];
      const y = legendY + i * LEGEND_ITEM_HEIGHT;
      const color = COLORS[i % COLORS.length];

      // Color circle
      ctx.beginPath();
      ctx.arc(legendX, y, LEGEND_CIRCLE_RADIUS, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      // Text
      ctx.fillStyle = "#d1d5db";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(
        `${allocation.symbol} ${allocation.percentage.toFixed(DECIMAL_PLACES)}%`,
        legendX + LEGEND_PADDING,
        y + TEXT_Y_OFFSET
      );
    }
  }, [portfolio]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Распределение активов
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px]" />
        </CardContent>
      </Card>
    );
  }

  if (!portfolio || portfolio.positions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Распределение активов
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Нет позиций для отображения
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PieChart className="h-5 w-5" />
          Распределение активов
        </CardTitle>
        <CardDescription>По стоимости позиций в портфеле</CardDescription>
      </CardHeader>
      <CardContent>
        <canvas className="w-full" height={300} ref={canvasRef} width={600} />
      </CardContent>
    </Card>
  );
}
