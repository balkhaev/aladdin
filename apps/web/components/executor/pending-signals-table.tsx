/**
 * Pending Signals Table
 * Displays pending trading signals awaiting execution
 */

import { Play, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import {
  useManualExecuteSignal,
  usePendingSignals,
} from "@/hooks/use-executor";
import type { TradingSignal } from "@/lib/api/executor";

const PERCENT_DECIMALS = 1;
const PERCENT_MULTIPLIER = 100;

type SignalRowProps = {
  signal: TradingSignal;
  onExecute: (signal: TradingSignal) => void;
  isExecuting: boolean;
};

function SignalRow({ signal, onExecute, isExecuting }: SignalRowProps) {
  const isBuy =
    signal.recommendation === "BUY" || signal.recommendation === "STRONG_BUY";

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case "STRONG_BUY":
        return "text-green-600";
      case "BUY":
        return "text-green-500";
      case "SELL":
        return "text-red-500";
      case "STRONG_SELL":
        return "text-red-600";
      default:
        return "text-muted-foreground";
    }
  };

  const getRecommendationBadge = (rec: string) => {
    switch (rec) {
      case "STRONG_BUY":
      case "BUY":
        return "default";
      case "SELL":
      case "STRONG_SELL":
        return "destructive";
      default:
        return "secondary";
    }
  };

  return (
    <TableRow>
      <TableCell className="font-medium">
        {signal.symbol.replace("USDT", "")}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {isBuy ? (
            <TrendingUp className="h-4 w-4 text-green-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-500" />
          )}
          <Badge
            className="text-xs"
            variant={getRecommendationBadge(signal.recommendation) as never}
          >
            {signal.recommendation}
          </Badge>
        </div>
      </TableCell>
      <TableCell>
        <span className={getRecommendationColor(signal.recommendation)}>
          {(signal.confidence * PERCENT_MULTIPLIER).toFixed(PERCENT_DECIMALS)}%
        </span>
      </TableCell>
      <TableCell className="text-xs">
        {new Date(signal.timestamp).toLocaleString()}
      </TableCell>
      <TableCell className="text-muted-foreground text-xs">
        {signal.source}
      </TableCell>
      <TableCell className="text-right">
        <Button
          disabled={isExecuting}
          onClick={() => onExecute(signal)}
          size="sm"
          variant="outline"
        >
          <Play className="mr-1 h-3 w-3" />
          Execute
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function PendingSignalsTable() {
  const { data: signals, isLoading } = usePendingSignals();
  const executeMutation = useManualExecuteSignal();
  const { toast } = useToast();

  const handleExecute = (signal: TradingSignal) => {
    executeMutation.mutate(
      {
        symbol: signal.symbol,
        recommendation: signal.recommendation,
        confidence: signal.confidence,
      },
      {
        onSuccess: (result) => {
          if (result.success) {
            toast({
              title: "Signal Executed",
              description: `Order placed for ${signal.symbol}: ${result.message}`,
            });
          } else {
            toast({
              title: "Execution Failed",
              description: result.error || result.message,
              variant: "destructive",
            });
          }
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to execute signal",
            variant: "destructive",
          });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Signals</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Pending Signals</CardTitle>
          {signals && signals.length > 0 && (
            <Badge className="text-xs" variant="secondary">
              {signals.length} pending
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!signals || signals.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm">
            No pending signals
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Recommendation</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {signals.map((signal, idx) => (
                <SignalRow
                  isExecuting={executeMutation.isPending}
                  key={`${signal.symbol}-${idx}`}
                  onExecute={handleExecute}
                  signal={signal}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
