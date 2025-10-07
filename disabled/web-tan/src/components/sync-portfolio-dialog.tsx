/**
 * Sync Portfolio Dialog Component
 * Диалог для синхронизации портфеля с биржей (импорт спотовых активов)
 */

import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { useExchangeCredentials } from "../hooks/use-exchange-credentials";
import { useImportPositions } from "../hooks/use-portfolio";
import { getExchangeBalances } from "../lib/api/trading";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Skeleton } from "./ui/skeleton";

type SyncPortfolioDialogProps = {
  portfolioId: string;
  trigger?: React.ReactNode;
};

export function SyncPortfolioDialog({
  portfolioId,
  trigger,
}: SyncPortfolioDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedCredentialId, setSelectedCredentialId] = useState<string>("");
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());

  const { data: credentials } = useExchangeCredentials();
  const importMutation = useImportPositions();

  // Fetch balances when credential is selected
  const {
    data: balances,
    isLoading: loadingBalances,
    error: balancesError,
  } = useQuery({
    queryKey: ["exchangeBalances", selectedCredentialId],
    queryFn: () => getExchangeBalances(selectedCredentialId),
    enabled: !!selectedCredentialId && dialogProps.open,
    retry: 1,
  });

  const handleToggleAsset = (asset: string) => {
    const newSelection = new Set(selectedAssets);
    if (newSelection.has(asset)) {
      newSelection.delete(asset);
    } else {
      newSelection.add(asset);
    }
    setSelectedAssets(newSelection);
  };

  const handleSelectAll = () => {
    if (!balances) return;
    if (selectedAssets.size === balances.length) {
      setSelectedAssets(new Set());
    } else {
      setSelectedAssets(new Set(balances.map((b) => b.asset)));
    }
  };

  const handleImport = async () => {
    if (!balances || selectedAssets.size === 0 || !credentials) return;

    const assetsToImport = balances
      .filter((b) => selectedAssets.has(b.asset))
      .map((b) => ({
        symbol: `${b.asset}USDT`, // Convert to trading pair (e.g., BTC -> BTCUSDT)
        quantity: b.total,
        currentPrice: 0, // Price will be fetched by backend
      }));

    // Get selected credential to extract exchange info
    const selectedCredential = credentials.find(
      (c) => c.id === selectedCredentialId
    );

    importMutation.mutate(
      {
        portfolioId,
        assets: assetsToImport,
        exchange: selectedCredential?.exchange,
        exchangeCredentialsId: selectedCredentialId,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setSelectedCredentialId("");
          setSelectedAssets(new Set());
        },
      }
    );
  };

  const resetDialog = () => {
    setSelectedCredentialId("");
    setSelectedAssets(new Set());
  };

  return (
    <Dialog
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          resetDialog();
        }
      }}
      open={open}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Синхронизировать
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Синхронизация портфеля</DialogTitle>
          <DialogDescription>
            Импортируйте спотовые активы с вашей биржи в портфель для
            отслеживания
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: Select Exchange Credential */}
          <div className="space-y-2">
            <Label>1. Выберите API ключ биржи</Label>
            {credentials && credentials.length > 0 ? (
              <Select
                onValueChange={setSelectedCredentialId}
                value={selectedCredentialId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Выберите ключ" />
                </SelectTrigger>
                <SelectContent>
                  {credentials.map((cred) => (
                    <SelectItem key={cred.id} value={cred.id}>
                      <div className="flex items-center gap-2">
                        <Badge className="text-xs uppercase" variant="outline">
                          {cred.exchange}
                        </Badge>
                        <span>{cred.label}</span>
                        {!cred.isActive && (
                          <span className="text-muted-foreground text-xs">
                            (неактивен)
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-muted-foreground text-sm">
                Добавьте API ключ биржи в настройках
              </p>
            )}
          </div>

          {/* Step 2: Select Assets */}
          {selectedCredentialId && (
            <div className="space-y-2">
              <Label>2. Выберите активы для импорта</Label>

              {loadingBalances && (
                <div className="space-y-2">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                </div>
              )}

              {balancesError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-800 text-sm">
                  <p className="font-medium">Ошибка загрузки балансов</p>
                  <p className="text-xs">{(balancesError as Error).message}</p>
                </div>
              )}

              {balances && balances.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <Button
                      onClick={handleSelectAll}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      {selectedAssets.size === balances.length
                        ? "Снять все"
                        : "Выбрать все"}
                    </Button>
                    <span className="text-muted-foreground text-sm">
                      Выбрано: {selectedAssets.size} из {balances.length}
                    </span>
                  </div>

                  <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-3">
                    {balances.map((balance) => (
                      <label
                        className="flex cursor-pointer items-center justify-between rounded-md p-2 transition-colors hover:bg-muted"
                        htmlFor={`asset-${balance.asset}`}
                        key={balance.asset}
                      >
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            checked={selectedAssets.has(balance.asset)}
                            id={`asset-${balance.asset}`}
                            onCheckedChange={() =>
                              handleToggleAsset(balance.asset)
                            }
                          />
                          <span className="font-medium">{balance.asset}</span>
                        </div>
                        <div className="text-right text-sm">
                          <p className="font-semibold">
                            {balance.total?.toFixed(8) ?? "0"}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            Доступно: {balance.free?.toFixed(8) ?? "0"}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </>
              )}

              {balances && balances.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  Нет активов для импорта
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={() => setOpen(false)}
            type="button"
            variant="outline"
          >
            Отмена
          </Button>
          <Button
            disabled={
              !selectedCredentialId ||
              selectedAssets.size === 0 ||
              importMutation.isPending
            }
            onClick={handleImport}
            type="button"
          >
            {importMutation.isPending
              ? "Импорт..."
              : `Импортировать (${selectedAssets.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
