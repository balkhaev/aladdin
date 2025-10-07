/**
 * Fear & Greed Gauge Component
 * Визуализация индекса страха/жадности
 */

import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFearGreed } from "@/hooks/use-macro-data";
import { getFearGreedColor, getFearGreedEmoji } from "@/lib/api/macro";

const CANVAS_PADDING = 20;
const ARC_WIDTH = 20;
const NEEDLE_WIDTH = 3;
const CENTER_DOT_RADIUS = 8;
const NEEDLE_OFFSET = 10;
const PERCENTAGE_DIVISOR = 100;
const FEAR_GREED_THRESHOLDS = {
  EXTREME_FEAR: 25,
  FEAR: 45,
  NEUTRAL: 55,
  GREED: 75,
} as const;

export function FearGreedGauge() {
  const { data, isLoading, error } = useFearGreed(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fearGreed = Array.isArray(data) ? data[0] : data;

  useEffect(() => {
    if (!(canvasRef.current && fearGreed)) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvas;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - CANVAS_PADDING;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background arc (gray)
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI, 2 * Math.PI);
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = ARC_WIDTH;
    ctx.stroke();

    // Draw colored arc based on value
    const endAngle = Math.PI + (Math.PI * fearGreed.value) / PERCENTAGE_DIVISOR;
    const gradient = ctx.createLinearGradient(0, 0, width, 0);

    if (fearGreed.value < FEAR_GREED_THRESHOLDS.EXTREME_FEAR) {
      gradient.addColorStop(0, "#dc2626");
      gradient.addColorStop(1, "#ef4444");
    } else if (fearGreed.value < FEAR_GREED_THRESHOLDS.FEAR) {
      gradient.addColorStop(0, "#f97316");
      gradient.addColorStop(1, "#fb923c");
    } else if (fearGreed.value < FEAR_GREED_THRESHOLDS.NEUTRAL) {
      gradient.addColorStop(0, "#eab308");
      gradient.addColorStop(1, "#fbbf24");
    } else if (fearGreed.value < FEAR_GREED_THRESHOLDS.GREED) {
      gradient.addColorStop(0, "#22c55e");
      gradient.addColorStop(1, "#4ade80");
    } else {
      gradient.addColorStop(0, "#16a34a");
      gradient.addColorStop(1, "#22c55e");
    }

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI, endAngle);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = ARC_WIDTH;
    ctx.lineCap = "round";
    ctx.stroke();

    // Draw needle
    const needleAngle =
      Math.PI + (Math.PI * fearGreed.value) / PERCENTAGE_DIVISOR;
    const needleLength = radius - NEEDLE_OFFSET;
    const needleX = centerX + needleLength * Math.cos(needleAngle);
    const needleY = centerY + needleLength * Math.sin(needleAngle);

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(needleX, needleY);
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = NEEDLE_WIDTH;
    ctx.stroke();

    // Draw center dot
    ctx.beginPath();
    ctx.arc(centerX, centerY, CENTER_DOT_RADIUS, 0, 2 * Math.PI);
    ctx.fillStyle = "#1f2937";
    ctx.fill();
  }, [fearGreed]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fear & Greed Index</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          <Skeleton className="h-[200px] w-[200px] rounded-full" />
          <Skeleton className="mt-4 h-8 w-[100px]" />
          <Skeleton className="mt-2 h-4 w-[150px]" />
        </CardContent>
      </Card>
    );
  }

  if (error || !fearGreed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fear & Greed Index</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground">
          Failed to load data
        </CardContent>
      </Card>
    );
  }

  const color = getFearGreedColor(fearGreed.value);
  const emoji = getFearGreedEmoji(fearGreed.value);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fear & Greed Index</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <canvas
          aria-label={`Fear and Greed Index: ${fearGreed.value}`}
          className="mb-4"
          height={120}
          ref={canvasRef}
          width={200}
        />
        <div className="text-center">
          <div className={`font-bold text-4xl ${color}`}>
            {fearGreed.value} {emoji}
          </div>
          <div className={`mt-2 font-medium text-lg ${color}`}>
            {fearGreed.classification}
          </div>
          <p className="mt-2 text-muted-foreground text-xs">
            Updated: {new Date(fearGreed.timestamp).toLocaleString()}
          </p>
        </div>
        <div className="mt-6 w-full space-y-1 text-muted-foreground text-xs">
          <div className="flex justify-between">
            <span>0 - Extreme Fear</span>
            <span>100 - Extreme Greed</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gradient-to-r from-red-600 via-yellow-500 to-green-600" />
        </div>
      </CardContent>
    </Card>
  );
}
