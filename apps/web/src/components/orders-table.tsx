/**
 * Orders Table Component
 * Displays active and historical orders with actions
 */

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useOrdersWebSocket } from "../hooks/use-orders-ws";
import {
  useActiveOrders,
  useCancelOrder,
  useOrderHistory,
} from "../hooks/use-trading";
import type { Order, OrderStatus } from "../lib/api/trading";
import Loader from "./loader";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

type OrdersTableProps = {
  symbol?: string;
};

const STATUS_COLORS: Record<
  OrderStatus,
  "default" | "destructive" | "outline" | "secondary"
> = {
  PENDING: "default",
  OPEN: "secondary",
  FILLED: "default",
  PARTIALLY_FILLED: "secondary",
  CANCELLED: "outline",
  REJECTED: "destructive",
  EXPIRED: "outline",
};

const STATUS_ICONS: Record<
  OrderStatus,
  React.ComponentType<{ className?: string }>
> = {
  PENDING: Clock,
  OPEN: Clock,
  FILLED: CheckCircle2,
  PARTIALLY_FILLED: Clock,
  CANCELLED: XCircle,
  REJECTED: AlertCircle,
  EXPIRED: XCircle,
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Ожидает",
  OPEN: "Открыт",
  FILLED: "Исполнен",
  PARTIALLY_FILLED: "Частично исполнен",
  CANCELLED: "Отменен",
  REJECTED: "Отклонен",
  EXPIRED: "Истек",
};

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const Icon = STATUS_ICONS[status];
  return (
    <Badge className="h-5 gap-1 text-[10px]" variant={STATUS_COLORS[status]}>
      <Icon className="h-3 w-3" />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

function OrderRow({
  order,
  showActions = true,
}: {
  order: Order;
  showActions?: boolean;
}) {
  const cancelOrderMutation = useCancelOrder();

  const handleCancel = () => {
    cancelOrderMutation.mutate(order.id);
  };

  const canCancel = ["PENDING", "OPEN", "PARTIALLY_FILLED"].includes(
    order.status
  );

  return (
    <TableRow className="border-border/20 hover:bg-muted/30">
      <TableCell className="py-2 font-medium font-mono text-xs">
        {order.symbol}
      </TableCell>
      <TableCell className="py-2">
        <Badge
          className="h-5 text-[10px]"
          variant={order.side === "BUY" ? "default" : "destructive"}
        >
          {order.side === "BUY" ? "Купить" : "Продать"}
        </Badge>
      </TableCell>
      <TableCell className="py-2 text-xs">{order.type}</TableCell>
      <TableCell className="py-2 text-right font-mono text-xs">
        {order.quantity}
      </TableCell>
      <TableCell className="py-2 text-right font-mono text-xs">
        {order.price ? `$${order.price.toFixed(2)}` : "Market"}
      </TableCell>
      <TableCell className="py-2">
        <OrderStatusBadge status={order.status} />
      </TableCell>
      <TableCell className="py-2 text-right">
        {order.filledQuantity > 0 && (
          <span className="font-mono text-[10px] text-muted-foreground">
            {order.filledQuantity} / {order.quantity}
          </span>
        )}
      </TableCell>
      <TableCell className="py-2 text-[10px] text-muted-foreground">
        {new Date(order.createdAt).toLocaleString("ru-RU", {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </TableCell>
      {showActions && (
        <TableCell className="py-2 text-right">
          {canCancel && (
            <Button
              className="h-6 text-[10px]"
              disabled={cancelOrderMutation.isPending}
              onClick={handleCancel}
              size="sm"
              variant="ghost"
            >
              {cancelOrderMutation.isPending ? "..." : "Отменить"}
            </Button>
          )}
        </TableCell>
      )}
    </TableRow>
  );
}

export function OrdersTable({ symbol }: OrdersTableProps) {
  const [activeTab, setActiveTab] = useState<"active" | "history">("active");

  // Get current user
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;

  // WebSocket real-time updates
  const { isConnected: wsConnected } = useOrdersWebSocket(userId, true);

  const {
    data: activeOrders,
    isLoading: isLoadingActive,
    error: activeError,
  } = useActiveOrders(symbol);
  const {
    data: historyResponse,
    isLoading: isLoadingHistory,
    error: historyError,
  } = useOrderHistory({ symbol, limit: 50 });

  return (
    <Card className="border-border/50 bg-card/80 pt-0 shadow-lg backdrop-blur-sm">
      <Tabs
        onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        value={activeTab}
      >
        <div className="flex items-center justify-between px-2.5 pt-2.5">
          <TabsList className="h-8 bg-background/50">
            <TabsTrigger className="h-6 text-xs" value="active">
              Активные {activeOrders ? `(${activeOrders.length})` : ""}
            </TabsTrigger>
            <TabsTrigger className="h-6 text-xs" value="history">
              История{" "}
              {historyResponse?.orders
                ? `(${historyResponse.orders.length})`
                : ""}
            </TabsTrigger>
          </TabsList>
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

        <TabsContent className="mt-0" value="active">
          {isLoadingActive && (
            <div className="flex justify-center py-6">
              <Loader />
            </div>
          )}
          {!isLoadingActive && activeError && (
            <div className="py-6 text-center text-destructive text-xs">
              Ошибка загрузки: {(activeError as Error).message}
            </div>
          )}
          {!(isLoadingActive || activeError || activeOrders?.length) && (
            <div className="py-6 text-center text-muted-foreground text-xs">
              Нет активных ордеров
            </div>
          )}
          {!(isLoadingActive || activeError) &&
            activeOrders &&
            activeOrders.length > 0 && (
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/30 hover:bg-transparent">
                      <TableHead className="h-8 text-[11px]">Символ</TableHead>
                      <TableHead className="h-8 text-[11px]">Сторона</TableHead>
                      <TableHead className="h-8 text-[11px]">Тип</TableHead>
                      <TableHead className="h-8 text-right text-[11px]">
                        Кол-во
                      </TableHead>
                      <TableHead className="h-8 text-right text-[11px]">
                        Цена
                      </TableHead>
                      <TableHead className="h-8 text-[11px]">Статус</TableHead>
                      <TableHead className="h-8 text-right text-[11px]">
                        Испол.
                      </TableHead>
                      <TableHead className="h-8 text-[11px]">Создан</TableHead>
                      <TableHead className="h-8 text-right text-[11px]">
                        Действия
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeOrders.map((order) => (
                      <OrderRow key={order.id} order={order} showActions />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
        </TabsContent>

        <TabsContent className="mt-0" value="history">
          {isLoadingHistory && (
            <div className="flex justify-center py-6">
              <Loader />
            </div>
          )}
          {!isLoadingHistory && historyError && (
            <div className="py-6 text-center text-destructive text-xs">
              Ошибка загрузки: {(historyError as Error).message}
            </div>
          )}
          {!(
            isLoadingHistory ||
            historyError ||
            historyResponse?.orders.length
          ) && (
            <div className="py-6 text-center text-muted-foreground text-xs">
              Нет истории ордеров
            </div>
          )}
          {!(isLoadingHistory || historyError) &&
            historyResponse?.orders &&
            historyResponse.orders.length > 0 && (
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/30 hover:bg-transparent">
                      <TableHead className="h-8 text-[11px]">Символ</TableHead>
                      <TableHead className="h-8 text-[11px]">Сторона</TableHead>
                      <TableHead className="h-8 text-[11px]">Тип</TableHead>
                      <TableHead className="h-8 text-right text-[11px]">
                        Кол-во
                      </TableHead>
                      <TableHead className="h-8 text-right text-[11px]">
                        Цена
                      </TableHead>
                      <TableHead className="h-8 text-[11px]">Статус</TableHead>
                      <TableHead className="h-8 text-right text-[11px]">
                        Испол.
                      </TableHead>
                      <TableHead className="h-8 text-[11px]">Создан</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyResponse.orders.map((order) => (
                      <OrderRow
                        key={order.id}
                        order={order}
                        showActions={false}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
        </TabsContent>
      </Tabs>
    </Card>
  );
}
