/**
 * Dominance Pie Chart Component
 * Круговая диаграмма доминации BTC/ETH/Altcoins
 */

import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGlobalMetrics } from "@/hooks/use-macro-data";

const CANVAS_PADDING = 10;
const BORDER_WIDTH = 2;
const PERCENTAGE_DIVISOR = 100;
const LABEL_RADIUS_MULTIPLIER = 0.7;

export function DominanceChart() {
  const { data, isLoading, error } = useGlobalMetrics();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!(canvasRef.current && data)) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvas;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - CANVAS_PADDING;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    const segments = [
      {
        label: "BTC",
        value: data.btcDominance,
        color: "#f7931a",
      },
      {
        label: "ETH",
        value: data.ethDominance,
        color: "#627eea",
      },
      {
        label: "Altcoins",
        value: data.altcoinDominance,
        color: "#10b981",
      },
    ];

    let currentAngle = -Math.PI / 2; // Start at top

    for (const segment of segments) {
      const sliceAngle = (2 * Math.PI * segment.value) / PERCENTAGE_DIVISOR;

      // Draw slice
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
      ctx.fillStyle = segment.color;
      ctx.fill();

      // Draw border
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = BORDER_WIDTH;
      ctx.stroke();

      // Draw label
      const labelAngle = currentAngle + sliceAngle / 2;
      const labelRadius = radius * LABEL_RADIUS_MULTIPLIER;
      const labelX = centerX + labelRadius * Math.cos(labelAngle);
      const labelY = centerY + labelRadius * Math.sin(labelAngle);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${segment.value.toFixed(1)}%`, labelX, labelY);

      currentAngle += sliceAngle;
    }
  }, [data]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Market Dominance</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          <Skeleton className="h-[250px] w-[250px] rounded-full" />
          <div className="mt-4 flex gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton className="h-4 w-[80px]" key={i} />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Market Dominance</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground">
          Failed to load data
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Market Dominance</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <canvas
          aria-label="Market dominance pie chart"
          className="mb-4"
          height={250}
          ref={canvasRef}
          width={250}
        />
        <div className="flex flex-wrap justify-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-[#f7931a]" />
            <span className="font-medium text-sm">
              BTC: {data.btcDominance.toFixed(2)}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-[#627eea]" />
            <span className="font-medium text-sm">
              ETH: {data.ethDominance.toFixed(2)}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-[#10b981]" />
            <span className="font-medium text-sm">
              Altcoins: {data.altcoinDominance.toFixed(2)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
