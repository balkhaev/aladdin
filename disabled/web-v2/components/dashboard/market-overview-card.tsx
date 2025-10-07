"use client"

import * as React from "react"
import { ArrowDown, ArrowUp, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface MarketOverviewCardProps {
  title: string
  value: string | number
  change?: number
  changeLabel?: string
  description?: string
  icon?: React.ReactNode
  trend?: "up" | "down" | "neutral"
  isLoading?: boolean
}

export function MarketOverviewCard({
  title,
  value,
  change,
  changeLabel = "24h",
  description,
  icon,
  trend,
  isLoading = false,
}: MarketOverviewCardProps) {
  const trendIcon = trend === "up" ? ArrowUp : trend === "down" ? ArrowDown : TrendingUp
  const TrendIcon = trendIcon

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-24" />
          </>
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {change !== undefined && (
              <div className="flex items-center gap-1 mt-1">
                <TrendIcon
                  className={cn(
                    "size-4",
                    trend === "up" && "text-green-500",
                    trend === "down" && "text-red-500",
                    trend === "neutral" && "text-muted-foreground"
                  )}
                />
                <span
                  className={cn(
                    "text-xs font-medium",
                    trend === "up" && "text-green-500",
                    trend === "down" && "text-red-500",
                    trend === "neutral" && "text-muted-foreground"
                  )}
                >
                  {change > 0 && "+"}
                  {change.toFixed(2)}% {changeLabel}
                </span>
              </div>
            )}
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
