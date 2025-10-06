/**
 * Futures Positions Table Component
 * Displays current futures positions from exchange
 */

import { ArrowDown, ArrowUp, Wifi, WifiOff } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { formatCurrency, formatPrice } from "@/lib/formatters";
import { useFuturesPositions } from "../hooks/use-futures-positions";
import { useFuturesPositionsWebSocket } from "../hooks/use-futures-positions-ws";
import Loader from "./loader";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

type FuturesPositionsTableProps = {
  exchange?: string;
};

export function FuturesPositionsTable({
  exchange = "bybit",
}: FuturesPositionsTableProps) {
  // Get current user
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;

  // WebSocket real-time updates for futures positions
  const { isConnected: wsConnected } = useFuturesPositionsWebSocket(
    userId,
    exchange,
    true
  );

  const { data: positions, isLoading } = useFuturesPositions({ exchange });

  const totalUnrealisedPnl =
    positions?.reduce((sum, pos) => sum + pos.unrealisedPnl, 0) ?? 0;

  return (
    <Card className="border-border/50 bg-card/80 pt-0 shadow-lg backdrop-blur-sm">
      <div className="flex items-center justify-between border-border/30 border-b p-2.5">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">Фьючерсные позиции</h3>
          <div className="flex items-center gap-1 text-muted-foreground text-xs">
            {wsConnected ? (
              <>
                <Wifi className="h-3 w-3 text-green-500" />
                <span className="text-[10px]">Live</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px]">Offline</span>
              </>
            )}
          </div>
        </div>
        {positions && positions.length > 0 && (
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground">
              Нереализованный P&L
            </div>
            <div
              className={`font-bold font-mono text-sm ${
                totalUnrealisedPnl >= 0 ? "text-green-500" : "text-red-500"
              }`}
            >
              {totalUnrealisedPnl >= 0 ? "+" : ""}
              {formatCurrency(Math.abs(totalUnrealisedPnl))}
            </div>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="flex justify-center py-6">
          <Loader />
        </div>
      )}

      {!isLoading && (!positions || positions.length === 0) && (
        <div className="py-6 text-center text-muted-foreground text-xs">
          Нет открытых фьючерсных позиций
        </div>
      )}

      {!isLoading && positions && positions.length > 0 && (
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead className="h-8 text-[11px]">Символ</TableHead>
                <TableHead className="h-8 text-right text-[11px]">
                  Сторона
                </TableHead>
                <TableHead className="h-8 text-right text-[11px]">
                  Размер
                </TableHead>
                <TableHead className="h-8 text-right text-[11px]">
                  Цена входа
                </TableHead>
                <TableHead className="h-8 text-right text-[11px]">
                  Тек. цена
                </TableHead>
                <TableHead className="h-8 text-right text-[11px]">
                  Плечо
                </TableHead>
                <TableHead className="h-8 text-right text-[11px]">
                  P&L
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.map((position) => (
                <TableRow
                  className="border-border/20 hover:bg-muted/30"
                  key={position.symbol}
                >
                  <TableCell className="py-2 font-medium font-mono text-xs">
                    {position.symbol}
                  </TableCell>
                  <TableCell className="py-2 text-right">
                    <Badge
                      className="h-5 text-[10px]"
                      variant={
                        position.side === "Buy" ? "default" : "destructive"
                      }
                    >
                      {position.side === "Buy" ? "Long" : "Short"}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2 text-right font-mono text-xs">
                    {position.size}
                  </TableCell>
                  <TableCell className="py-2 text-right font-mono text-xs">
                    {formatPrice(position.entryPrice, 4)}
                  </TableCell>
                  <TableCell className="py-2 text-right font-mono text-xs">
                    {formatPrice(position.markPrice, 4)}
                  </TableCell>
                  <TableCell className="py-2 text-right font-mono text-xs">
                    {position.leverage}x
                  </TableCell>
                  <TableCell className="py-2 text-right">
                    <Badge
                      className="h-5 gap-1 font-mono text-[10px]"
                      variant={
                        position.unrealisedPnl >= 0 ? "default" : "destructive"
                      }
                    >
                      {position.unrealisedPnl >= 0 ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )}
                      {position.unrealisedPnl >= 0 ? "+" : ""}
                      {formatCurrency(Math.abs(position.unrealisedPnl))}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
