"use client";

/**
 * Debug Page
 * Страница с отладочной информацией и системными данными
 */

import { Bug } from "lucide-react";
import { TickersList } from "@/components/tickers-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";


export default function DebugPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-6">
      {/* Page Header */}
      <div className="flex items-center gap-2">
        <Bug className="h-6 w-6" />
        <h1 className="font-bold text-2xl">Отладка</h1>
      </div>

      {/* Debug Info */}
      <Card>
        <CardHeader>
          <CardTitle>Системная информация</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-muted-foreground text-sm">
            Environment: {process.env.NODE_ENV}
          </p>
          <p className="text-muted-foreground text-sm">
            API URL: {process.env.NEXT_PUBLIC_API_URL || "не задан"}
          </p>
          <p className="text-muted-foreground text-sm">
            WebSocket URL: {process.env.NEXT_PUBLIC_WS_URL || "не задан"}
          </p>
        </CardContent>
      </Card>

      {/* Tickers List - перемещено с дашборда */}
      <TickersList />
    </div>
  );
}
