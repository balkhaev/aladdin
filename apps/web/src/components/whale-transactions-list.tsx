import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { Skeleton } from "./ui/skeleton";

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

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const REFRESH_INTERVAL = 60_000; // 1 minute
const ADDRESS_PREFIX_LENGTH = 6;
const ADDRESS_SUFFIX_LENGTH = 4;
const MINUTES_IN_HOUR = 60;
const HOURS_IN_DAY = 24;
const MILLISECONDS_IN_MINUTE = 60_000;
const MILLISECONDS_IN_HOUR = 3_600_000;
const MILLISECONDS_IN_DAY = 86_400_000;

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

  const formatValue = (value: number): string =>
    value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const formatAddress = (address: string): string => {
    if (address === "multiple") {
      return "Multiple";
    }
    return `${address.slice(0, ADDRESS_PREFIX_LENGTH)}...${address.slice(-ADDRESS_SUFFIX_LENGTH)}`;
  };

  const formatTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / MILLISECONDS_IN_MINUTE);
    const hours = Math.floor(diff / MILLISECONDS_IN_HOUR);
    const days = Math.floor(diff / MILLISECONDS_IN_DAY);

    if (minutes < MINUTES_IN_HOUR) {
      return `${minutes}m ago`;
    }
    if (hours < HOURS_IN_DAY) {
      return `${hours}h ago`;
    }
    return `${days}d ago`;
  };

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
    return (
      <Card>
        <CardHeader>
          <CardTitle>Whale Transactions</CardTitle>
          <CardDescription>Recent large transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64" />
        </CardContent>
      </Card>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Whale Transactions</CardTitle>
          <CardDescription>Recent large transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No whale transactions found
          </p>
        </CardContent>
      </Card>
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
                        {formatTime(tx.timestamp)}
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
