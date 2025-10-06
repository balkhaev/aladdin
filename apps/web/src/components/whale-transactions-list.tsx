import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import {
  formatAddress,
  formatNumber,
  formatRelativeTime,
  formatTxHash,
} from "@/lib/formatters";
import { API_BASE_URL } from "../lib/runtime-env";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { CardSkeleton } from "./ui/card-skeleton";
import { EmptyState } from "./ui/empty-state";
import { ScrollArea } from "./ui/scroll-area";

type WhaleTransaction = {
  timestamp: number;
  blockchain: string;
  transactionHash: string;
  value: number;
  from: string;
  to: string;
};

type WhaleTransactionsListProps = {
  blockchain: "BTC" | "ETH";
  limit?: number;
};
const REFRESH_INTERVAL = 60_000; // 1 minute

const EXPLORER_URLS: Record<string, string> = {
  BTC: "https://mempool.space/tx",
  ETH: "https://etherscan.io/tx",
};

export const WhaleTransactionsList = ({
  blockchain,
  limit = 10,
}: WhaleTransactionsListProps) => {
  const [transactions, setTransactions] = useState<WhaleTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/on-chain/whale-transactions/${blockchain}?limit=${limit}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch transactions: ${response.status}`);
        }

        const result = (await response.json()) as {
          success: boolean;
          data: WhaleTransaction[];
        };

        if (result.success) {
          setTransactions(result.data);
          setError(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();

    const interval = setInterval(() => {
      fetchTransactions();
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [blockchain, limit]);

  const formatValue = (value: number): string => formatNumber(value, 2);

  const getExplorerUrl = (hash: string): string => {
    const baseUrl = EXPLORER_URLS[blockchain];
    return `${baseUrl}/${hash}`;
  };

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Whale Transactions</CardTitle>
          <CardDescription className="text-destructive">
            {error}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loading) {
    return <CardSkeleton contentHeight="h-64" title="Whale Transactions" />;
  }

  if (transactions.length === 0) {
    return (
      <EmptyState
        description="Recent large transactions"
        title="No whale transactions found"
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Whale Transactions</CardTitle>
        <CardDescription>
          Recent large transactions ({">"}{" "}
          {blockchain === "BTC" ? "10 BTC" : "100 ETH"})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {transactions.map((tx, index) => (
              <div
                className="rounded-lg border p-3 transition-colors hover:bg-muted/50"
                key={`${tx.transactionHash}-${tx.timestamp}-${index}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-sm">
                        {formatValue(tx.value)} {blockchain}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {formatRelativeTime(tx.timestamp)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground text-xs">
                      <span>From: {formatAddress(tx.from)}</span>
                      <span>→</span>
                      <span>To: {formatAddress(tx.to)}</span>
                    </div>
                  </div>
                  <a
                    className="text-muted-foreground transition-colors hover:text-foreground"
                    href={getExplorerUrl(tx.transactionHash)}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
