"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface TickerCardProps {
  symbol: string
  name: string
  price: string
  change24h: number
  volume24h: string
  marketCap?: string
  onClick?: () => void
}

export function TickerCard({
  symbol,
  name,
  price,
  change24h,
  volume24h,
  marketCap,
  onClick,
}: TickerCardProps) {
  const isPositive = change24h > 0

  return (
    <Card
      className={cn(
        "border-border/50 bg-card/50 backdrop-blur transition-all hover:border-primary/50 cursor-pointer",
        onClick && "hover:shadow-lg"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">{symbol}</h3>
              <Badge variant="outline" className="text-xs">
                {name}
              </Badge>
            </div>
          </div>
          <div
            className={cn(
              "text-sm font-medium px-2 py-1 rounded",
              isPositive
                ? "bg-green-500/10 text-green-500"
                : "bg-red-500/10 text-red-500"
            )}
          >
            {isPositive && "+"}
            {change24h.toFixed(2)}%
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-2xl font-bold">{price}</div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Vol: {volume24h}</span>
            {marketCap && <span>MCap: {marketCap}</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
