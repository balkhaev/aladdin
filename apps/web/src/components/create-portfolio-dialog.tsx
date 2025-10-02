/**
 * Create Portfolio Dialog Component
 * Диалог для создания нового портфеля с импортом активов
 */

import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertCircle, Loader2, PlusCircle } from "lucide-react";
import { useState } from "react";
import { useExchangeCredentials } from "../hooks/use-exchange-credentials";
import { useCreatePortfolio } from "../hooks/use-portfolio";
import { getExchangeBalances } from "../lib/api/trading";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
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
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Skeleton } from "./ui/skeleton";

type CreatePortfolioDialogProps = {
  trigger?: React.ReactNode;
};

// Constants
const STEP_NAME = 1;
const STEP_API_KEY = 2;
const STEP_ASSETS = 3;
const DECIMAL_PLACES = 8;

export function CreatePortfolioDialog({ trigger }: CreatePortfolioDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(STEP_NAME);
  const [name, setName] = useState("");
  const [selectedCredentialId, setSelectedCredentialId] = useState<string>("");
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());

  const createMutation = useCreatePortfolio();
  const { data: credentials, isLoading: isLoadingCredentials } =
    useExchangeCredentials();

  const hasApiKeys = Boolean(credentials?.length);
  const isReady = !isLoadingCredentials;
  const showApiKeyWarning = isReady && !hasApiKeys;

  // Fetch balances when credential is selected
  const {
    data: balances,
    isLoading: loadingBalances,
    error: balancesError,
  } = useQuery({
    queryKey: ["exchangeBalances", selectedCredentialId],
    queryFn: () => getExchangeBalances(selectedCredentialId),
    enabled: !!selectedCredentialId && open && step === STEP_API_KEY,
    retry: 1,
  });

  const selectedCredential = credentials?.find(
    (c) => c.id === selectedCredentialId
  );

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

  const handleNext = () => {
    if (step === STEP_NAME && name.trim()) {
      setStep(STEP_API_KEY);
    } else if (step === STEP_API_KEY && selectedCredentialId) {
      setStep(STEP_ASSETS);
    }
  };

  const handleBack = () => {
    if (step === STEP_ASSETS) {
      setStep(STEP_API_KEY);
    } else if (step === STEP_API_KEY) {
      setStep(STEP_NAME);
    }
  };

  const handleSubmit = () => {
    const hasNoName = !name.trim();
    const hasNoCredentials = !selectedCredentialId;
    const hasNoAssets = selectedAssets.size === 0;

    if (hasNoName || hasNoCredentials || hasNoAssets) return;
    if (!balances) return;

    const assetsToImport = balances
      .filter((b) => selectedAssets.has(b.asset))
      .map((b) => ({
        symbol: `${b.asset}USDT`, // Convert to trading pair (e.g., BTC -> BTCUSDT)
        quantity: b.total,
        currentPrice: 0, // Price will be fetched by backend
      }));

    createMutation.mutate(
      {
        name: name.trim(),
        assets: assetsToImport,
        exchange: selectedCredential?.exchange,
        exchangeCredentialsId: selectedCredentialId,
      },
      {
        onSuccess: () => {
          resetDialog();
          setOpen(false);
        },
      }
    );
  };

  const resetDialog = () => {
    setStep(STEP_NAME);
    setName("");
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
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Создать портфель
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Создать новый портфель</DialogTitle>
          <DialogDescription>
            Шаг {step} из {STEP_ASSETS}:{" "}
            {step === STEP_NAME && "Введите название портфеля"}
            {step === STEP_API_KEY && "Выберите API ключ биржи"}
            {step === STEP_ASSETS && "Выберите активы для импорта"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {showApiKeyWarning && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>API ключ не найден</AlertTitle>
              <AlertDescription>
                Для создания портфеля необходимо добавить хотя бы один API ключ
                биржи.{" "}
                <Link
                  className="font-medium underline"
                  onClick={() => setOpen(false)}
                  to="/settings"
                >
                  Перейти в настройки
                </Link>
              </AlertDescription>
            </Alert>
          )}

          {/* Step 1: Portfolio Name */}
          {step === STEP_NAME && (
            <div className="space-y-2">
              <Label htmlFor="portfolio-name">Название портфеля</Label>
              <Input
                autoFocus
                disabled={!hasApiKeys}
                id="portfolio-name"
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: Мой основной портфель"
                required
                type="text"
                value={name}
              />
              <p className="text-muted-foreground text-xs">
                Выберите понятное название для идентификации портфеля
              </p>
            </div>
          )}

          {/* Step 2: Select API Key */}
          {step === STEP_API_KEY && (
            <div className="space-y-2">
              <Label>Выберите API ключ биржи</Label>
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
                          <Badge
                            className="text-xs uppercase"
                            variant="outline"
                          >
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
          )}

          {/* Step 3: Select Assets */}
          {step === STEP_ASSETS && (
            <div className="space-y-2">
              <Label>Выберите активы для импорта</Label>

              {loadingBalances && (
                <div className="space-y-2">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                </div>
              )}

              {balancesError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Ошибка загрузки балансов</AlertTitle>
                  <AlertDescription>
                    {(balancesError as Error).message}
                  </AlertDescription>
                </Alert>
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
                            {balance.total?.toFixed(DECIMAL_PLACES) ?? "0"}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            Доступно:{" "}
                            {balance.free?.toFixed(DECIMAL_PLACES) ?? "0"}
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
          {step > STEP_NAME && (
            <Button onClick={handleBack} type="button" variant="outline">
              Назад
            </Button>
          )}
          <Button
            onClick={() => setOpen(false)}
            type="button"
            variant="outline"
          >
            Отмена
          </Button>
          {step < STEP_ASSETS ? (
            <Button
              disabled={
                (step === STEP_NAME && !name.trim()) ||
                (step === STEP_API_KEY && !selectedCredentialId) ||
                !hasApiKeys
              }
              onClick={handleNext}
              type="button"
            >
              Далее
            </Button>
          ) : (
            <Button
              disabled={
                createMutation.isPending ||
                selectedAssets.size === 0 ||
                loadingBalances
              }
              onClick={handleSubmit}
              type="button"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Создание...
                </>
              ) : (
                `Создать (${selectedAssets.size})`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
