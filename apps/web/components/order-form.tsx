/**
 * Order Form Component
 * Form for creating trading orders (Market, Limit) with optional TP/SL
 */

import { useState } from "react";
import { useQuote } from "../hooks/use-market-data";
import { useCreateOrder } from "../hooks/use-trading";
import type { OrderSide } from "../lib/api/trading";
import { useExchange } from "../lib/exchange-context";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

type OrderType = "MARKET" | "LIMIT";

type OrderFormProps = {
  symbol: string;
  onOrderCreated?: () => void;
};

// Price multipliers for TP/SL suggestions
const TAKE_PROFIT_MULTIPLIER = 1.02; // +2%
const STOP_LOSS_MULTIPLIER = 0.98; // -2%

export function OrderForm({ symbol, onOrderCreated }: OrderFormProps) {
  const [side, setSide] = useState<OrderSide>("BUY");
  const [type, setType] = useState<OrderType>("MARKET");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [enableTakeProfit, setEnableTakeProfit] = useState(false);
  const [takeProfitPrice, setTakeProfitPrice] = useState("");
  const [enableStopLoss, setEnableStopLoss] = useState(false);
  const [stopLossPrice, setStopLossPrice] = useState("");

  const { selectedCredential } = useExchange();
  const { data: quote } = useQuote(symbol);
  const createOrderMutation = useCreateOrder();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCredential) {
      return;
    }

    try {
      // Create main order (MARKET or LIMIT)
      const mainOrderData = {
        exchangeCredentialsId: selectedCredential.id,
        symbol,
        side,
        type,
        quantity: Number.parseFloat(quantity),
        ...(type === "LIMIT" && price && { price: Number.parseFloat(price) }),
      };

      await createOrderMutation.mutateAsync(mainOrderData);

      // Create Take Profit order if enabled
      if (enableTakeProfit && takeProfitPrice) {
        const tpOrderData = {
          exchangeCredentialsId: selectedCredential.id,
          symbol,
          side: side === "BUY" ? ("SELL" as OrderSide) : ("BUY" as OrderSide),
          type: "TAKE_PROFIT" as const,
          quantity: Number.parseFloat(quantity),
          stopPrice: Number.parseFloat(takeProfitPrice),
        };
        await createOrderMutation.mutateAsync(tpOrderData);
      }

      // Create Stop Loss order if enabled
      if (enableStopLoss && stopLossPrice) {
        const slOrderData = {
          exchangeCredentialsId: selectedCredential.id,
          symbol,
          side: side === "BUY" ? ("SELL" as OrderSide) : ("BUY" as OrderSide),
          type: "STOP_LOSS" as const,
          quantity: Number.parseFloat(quantity),
          stopPrice: Number.parseFloat(stopLossPrice),
        };
        await createOrderMutation.mutateAsync(slOrderData);
      }

      // Reset form
      setQuantity("");
      setPrice("");
      setTakeProfitPrice("");
      setStopLossPrice("");
      setEnableTakeProfit(false);
      setEnableStopLoss(false);
      onOrderCreated?.();
    } catch (error) {
      console.error("Failed to create order:", error);
    }
  };

  const currentPrice = quote?.price ?? 0;
  const totalValue =
    Number.parseFloat(quantity) * (Number.parseFloat(price) || currentPrice);

  return (
    <Card className="border-border/50 bg-card/80 shadow-xl backdrop-blur-sm">
      {selectedCredential ? (
        <form className="space-y-3 p-3" onSubmit={handleSubmit}>
          {/* Buy/Sell Tabs */}
          <Tabs
            onValueChange={(value) => setSide(value as OrderSide)}
            value={side}
          >
            <TabsList className="grid h-9 w-full grid-cols-2 bg-background/50 p-1">
              <TabsTrigger
                className="h-7 text-xs data-[state=active]:bg-green-600 data-[state=active]:text-white"
                value="BUY"
              >
                Купить
              </TabsTrigger>
              <TabsTrigger
                className="h-7 text-xs data-[state=active]:bg-red-600 data-[state=active]:text-white"
                value="SELL"
              >
                Продать
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Order Type */}
          <div className="space-y-1.5">
            <Label className="font-medium text-muted-foreground text-xs">
              Тип ордера
            </Label>
            <Tabs
              onValueChange={(value) => setType(value as OrderType)}
              value={type}
            >
              <TabsList className="grid h-9 w-full grid-cols-2 bg-background/50 p-1">
                <TabsTrigger className="h-7 text-xs" value="MARKET">
                  Market
                </TabsTrigger>
                <TabsTrigger className="h-7 text-xs" value="LIMIT">
                  Limit
                </TabsTrigger>
              </TabsList>

              <TabsContent className="mt-3 space-y-3" value="MARKET">
                <div className="space-y-1.5">
                  <Label
                    className="font-medium text-xs"
                    htmlFor="quantity-market"
                  >
                    Количество
                  </Label>
                  <Input
                    className="h-9 bg-background/50"
                    id="quantity-market"
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="0.00"
                    required
                    step="0.00000001"
                    type="number"
                    value={quantity}
                  />
                </div>
                {currentPrice > 0 && quantity && (
                  <div className="rounded-md bg-muted/50 px-2 py-1.5 text-muted-foreground text-xs">
                    ≈ ${(Number.parseFloat(quantity) * currentPrice).toFixed(2)}
                  </div>
                )}
              </TabsContent>

              <TabsContent className="mt-3 space-y-3" value="LIMIT">
                <div className="space-y-1.5">
                  <Label className="font-medium text-xs" htmlFor="price-limit">
                    Цена
                  </Label>
                  <Input
                    className="h-9 bg-background/50"
                    id="price-limit"
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder={currentPrice.toFixed(2)}
                    required
                    step="0.01"
                    type="number"
                    value={price}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    className="font-medium text-xs"
                    htmlFor="quantity-limit"
                  >
                    Количество
                  </Label>
                  <Input
                    className="h-9 bg-background/50"
                    id="quantity-limit"
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="0.00"
                    required
                    step="0.00000001"
                    type="number"
                    value={quantity}
                  />
                </div>
                {totalValue > 0 && (
                  <div className="rounded-md bg-muted/50 px-2 py-1.5 text-muted-foreground text-xs">
                    Итого: ${totalValue.toFixed(2)}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Take Profit Option */}
          <div className="space-y-2 rounded-md border border-border/50 bg-background/30 p-2.5">
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={enableTakeProfit}
                id="enable-tp"
                onCheckedChange={(checked) =>
                  setEnableTakeProfit(checked === true)
                }
              />
              <Label
                className="cursor-pointer font-medium text-xs"
                htmlFor="enable-tp"
              >
                Take Profit
              </Label>
            </div>
            {enableTakeProfit && (
              <div className="space-y-1.5">
                <Label className="font-medium text-xs" htmlFor="tp-price">
                  Цена тейк-профита
                </Label>
                <Input
                  className="h-9 bg-background/50"
                  id="tp-price"
                  onChange={(e) => setTakeProfitPrice(e.target.value)}
                  placeholder={
                    side === "BUY"
                      ? (currentPrice * TAKE_PROFIT_MULTIPLIER).toFixed(2)
                      : (currentPrice * STOP_LOSS_MULTIPLIER).toFixed(2)
                  }
                  required={enableTakeProfit}
                  step="0.01"
                  type="number"
                  value={takeProfitPrice}
                />
              </div>
            )}
          </div>

          {/* Stop Loss Option */}
          <div className="space-y-2 rounded-md border border-border/50 bg-background/30 p-2.5">
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={enableStopLoss}
                id="enable-sl"
                onCheckedChange={(checked) =>
                  setEnableStopLoss(checked === true)
                }
              />
              <Label
                className="cursor-pointer font-medium text-xs"
                htmlFor="enable-sl"
              >
                Stop Loss
              </Label>
            </div>
            {enableStopLoss && (
              <div className="space-y-1.5">
                <Label className="font-medium text-xs" htmlFor="sl-price">
                  Цена стоп-лосса
                </Label>
                <Input
                  className="h-9 bg-background/50"
                  id="sl-price"
                  onChange={(e) => setStopLossPrice(e.target.value)}
                  placeholder={
                    side === "BUY"
                      ? (currentPrice * STOP_LOSS_MULTIPLIER).toFixed(2)
                      : (currentPrice * TAKE_PROFIT_MULTIPLIER).toFixed(2)
                  }
                  required={enableStopLoss}
                  step="0.01"
                  type="number"
                  value={stopLossPrice}
                />
              </div>
            )}
          </div>

          {/* Current Market Price */}
          {currentPrice > 0 && (
            <div className="rounded-md bg-accent/20 p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">
                  Текущая цена:
                </span>
                <span className="font-mono font-semibold text-sm">
                  ${currentPrice.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <Button
            className={`h-10 w-full font-semibold shadow-lg ${
              side === "BUY"
                ? "bg-green-600 hover:bg-green-700"
                : "bg-red-600 hover:bg-red-700"
            }`}
            disabled={
              createOrderMutation.isPending ||
              !quantity ||
              !selectedCredential
            }
            type="submit"
          >
            {createOrderMutation.isPending
              ? "Создание..."
              : `${side === "BUY" ? "Купить" : "Продать"} ${symbol}`}
          </Button>
        </form>
      ) : (
        <div className="p-6 text-center">
          <p className="text-muted-foreground text-sm">
            Выберите биржу для создания ордеров
          </p>
        </div>
      )}
    </Card>
  );
}
