import type { WhaleAlert } from "@aladdin/shared/types";
import { Bell, BellOff, Check, ExternalLink, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  useNotificationPermission,
  useWhaleAlerts,
} from "@/hooks/use-whale-alerts";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ScrollArea } from "./ui/scroll-area";

const MARK_AS_READ_TIMEOUT = 1000;
const MAX_BADGE_COUNT = 99;
const DECIMAL_PRECISION = 4;
const MILLISECONDS_IN_SECOND = 1000;
const SECONDS_IN_MINUTE = 60;
const MINUTES_IN_HOUR = 60;
const HOURS_IN_DAY = 24;

export function WhaleAlertsPanel() {
  const {
    alerts,
    unreadCount,
    unreadIds,
    markAsRead,
    markAllAsRead,
    clearAll,
    isConnected,
  } = useWhaleAlerts(undefined, true);

  const { requestPermission, isGranted } = useNotificationPermission();
  const [isOpen, setIsOpen] = useState(false);

  // Отметить алерты как прочитанные когда открывается панель
  useEffect(() => {
    if (isOpen && alerts.length > 0) {
      const alertIds = alerts.map(
        (a) => `${a.blockchain}-${a.transactionHash}`
      );
      // Отметить через 1 секунду после открытия
      const timer = setTimeout(() => {
        markAsRead(alertIds);
      }, MARK_AS_READ_TIMEOUT);

      return () => clearTimeout(timer);
    }
  }, [isOpen, alerts, markAsRead]);

  return (
    <DropdownMenu onOpenChange={setIsOpen} open={isOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Whale alerts"
          className="relative"
          size="icon"
          variant="ghost"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              className="-right-1 -top-1 absolute h-5 min-w-5 rounded-full px-1 text-xs"
              variant="destructive"
            >
              {unreadCount > MAX_BADGE_COUNT
                ? `${MAX_BADGE_COUNT}+`
                : unreadCount}
            </Badge>
          )}
          {!isConnected && (
            <span className="absolute right-0 bottom-0 h-2 w-2 rounded-full bg-red-500" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <DropdownMenuLabel className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>Whale Alerts</span>
            {unreadCount > 0 && (
              <Badge variant="secondary">{unreadCount} new</Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {!isGranted && (
              <Button
                className="h-6 w-6"
                onClick={requestPermission}
                size="icon"
                title="Enable notifications"
                variant="ghost"
              >
                <BellOff className="h-3 w-3" />
              </Button>
            )}
            {alerts.length > 0 && (
              <>
                <Button
                  className="h-6 w-6"
                  onClick={markAllAsRead}
                  size="icon"
                  title="Mark all as read"
                  variant="ghost"
                >
                  <Check className="h-3 w-3" />
                </Button>
                <Button
                  className="h-6 w-6"
                  onClick={clearAll}
                  size="icon"
                  title="Clear all"
                  variant="ghost"
                >
                  <X className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <ScrollArea className="h-96">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <Bell className="mb-2 h-8 w-8 opacity-50" />
              <p className="text-sm">No whale alerts yet</p>
              <p className="mt-1 text-xs">
                You'll be notified of large transactions
              </p>
            </div>
          ) : (
            <div className="space-y-1 p-1">
              {alerts.map((alert) => (
                <WhaleAlertItem
                  alert={alert}
                  isUnread={unreadIds.has(
                    `${alert.blockchain}-${alert.transactionHash}`
                  )}
                  key={`${alert.blockchain}-${alert.transactionHash}`}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {!isConnected && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-center text-muted-foreground text-xs">
              Connecting to alerts...
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function WhaleAlertItem({
  alert,
  isUnread,
}: {
  alert: WhaleAlert;
  isUnread: boolean;
}) {
  const icon = getAlertIcon(alert.alertType);
  const color = getAlertColor(alert.alertType);
  const explorerUrl = getExplorerUrl(alert.blockchain, alert.transactionHash);

  return (
    <DropdownMenuItem
      asChild
      className={`flex cursor-pointer flex-col items-start gap-2 p-3 ${
        isUnread ? "bg-accent" : ""
      }`}
    >
      <a
        className="w-full"
        href={explorerUrl}
        rel="noopener noreferrer"
        target="_blank"
      >
        <div className="flex w-full items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <span className={`text-lg ${color}`}>{icon}</span>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">
                  {formatAlertType(alert.alertType)}
                </span>
                <Badge className="text-xs" variant="outline">
                  {alert.blockchain}
                </Badge>
              </div>
              <div className="text-muted-foreground text-xs">
                <span className="font-mono">
                  {alert.value.toFixed(DECIMAL_PRECISION)} {alert.blockchain}
                </span>
                {alert.exchange && (
                  <span className="ml-2">via {alert.exchange}</span>
                )}
              </div>
              <div className="text-muted-foreground text-xs">
                {formatTimestamp(alert.timestamp)}
              </div>
            </div>
          </div>
          <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
        </div>
      </a>
    </DropdownMenuItem>
  );
}

function getAlertIcon(type: WhaleAlert["alertType"]): string {
  switch (type) {
    case "whale_tx":
      return "🐋";
    case "exchange_inflow":
      return "📥";
    case "exchange_outflow":
      return "📤";
    case "large_transfer":
      return "💰";
    default:
      return "🔔";
  }
}

function getAlertColor(type: WhaleAlert["alertType"]): string {
  switch (type) {
    case "whale_tx":
      return "text-blue-500";
    case "exchange_inflow":
      return "text-green-500";
    case "exchange_outflow":
      return "text-red-500";
    case "large_transfer":
      return "text-yellow-500";
    default:
      return "text-gray-500";
  }
}

function formatAlertType(type: WhaleAlert["alertType"]): string {
  switch (type) {
    case "whale_tx":
      return "Whale Transaction";
    case "exchange_inflow":
      return "Exchange Inflow";
    case "exchange_outflow":
      return "Exchange Outflow";
    case "large_transfer":
      return "Large Transfer";
    default:
      return "Alert";
  }
}

function formatTimestamp(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / MILLISECONDS_IN_SECOND);
  const minutes = Math.floor(seconds / SECONDS_IN_MINUTE);
  const hours = Math.floor(minutes / MINUTES_IN_HOUR);
  const days = Math.floor(hours / HOURS_IN_DAY);

  if (days > 0) {
    return `${days}d ago`;
  }
  if (hours > 0) {
    return `${hours}h ago`;
  }
  if (minutes > 0) {
    return `${minutes}m ago`;
  }
  return "just now";
}

function getExplorerUrl(blockchain: string, txHash: string): string {
  switch (blockchain.toUpperCase()) {
    case "BTC":
      return `https://mempool.space/tx/${txHash}`;
    case "ETH":
      return `https://etherscan.io/tx/${txHash}`;
    default:
      return "#";
  }
}
