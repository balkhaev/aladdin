"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Layers, Loader2, Plus, X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBatchPredict } from "@/hooks/use-batch-predictions";
import type { BatchPredictionResult } from "@/lib/api/ml";

const batchSchema = z.object({
  symbols: z.array(z.string()).min(1, "Добавьте хотя бы один символ"),
  horizon: z.enum(["1h", "4h", "1d", "7d"]),
  confidence: z.number().min(0).max(1),
});

type BatchFormValues = z.infer<typeof batchSchema>;

type BatchPredictionsFormProps = {
  onResults?: (results: BatchPredictionResult) => void;
};

export function BatchPredictionsForm({ onResults }: BatchPredictionsFormProps) {
  const [symbolInput, setSymbolInput] = useState("");
  const batchMutation = useBatchPredict();

  const form = useForm<BatchFormValues>({
    resolver: zodResolver(batchSchema),
    defaultValues: {
      symbols: ["BTCUSDT", "ETHUSDT"],
      horizon: "1h",
      confidence: 0.95,
    },
  });

  const symbols = form.watch("symbols");

  const addSymbol = () => {
    if (symbolInput && !symbols.includes(symbolInput.toUpperCase())) {
      form.setValue("symbols", [...symbols, symbolInput.toUpperCase()]);
      setSymbolInput("");
    }
  };

  const removeSymbol = (symbol: string) => {
    form.setValue(
      "symbols",
      symbols.filter((s) => s !== symbol)
    );
  };

  const onSubmit = async (values: BatchFormValues) => {
    const result = await batchMutation.mutateAsync(values);
    onResults?.(result);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="size-5" />
          Массовые предсказания
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            {/* Symbols */}
            <div className="space-y-2">
              <FormLabel>Символы</FormLabel>
              <div className="flex gap-2">
                <Input
                  onChange={(e) => setSymbolInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSymbol();
                    }
                  }}
                  placeholder="Добавить символ..."
                  value={symbolInput}
                />
                <Button onClick={addSymbol} size="icon" type="button">
                  <Plus className="size-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {symbols.map((symbol) => (
                  <div
                    className="flex items-center gap-1 rounded-md border bg-secondary px-2 py-1 text-sm"
                    key={symbol}
                  >
                    <span>{symbol}</span>
                    <button onClick={() => removeSymbol(symbol)} type="button">
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Horizon */}
            <FormField
              control={form.control}
              name="horizon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Горизонт</FormLabel>
                  <Select
                    defaultValue={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="1h">1 час</SelectItem>
                      <SelectItem value="4h">4 часа</SelectItem>
                      <SelectItem value="1d">1 день</SelectItem>
                      <SelectItem value="7d">7 дней</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Confidence */}
            <FormField
              control={form.control}
              name="confidence"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Уверенность</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onChange={(e) =>
                        field.onChange(Number.parseFloat(e.target.value))
                      }
                      step="0.05"
                      type="number"
                    />
                  </FormControl>
                  <FormDescription>0.0-1.0</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              className="w-full"
              disabled={batchMutation.isPending}
              type="submit"
            >
              {batchMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Обработка...
                </>
              ) : (
                <>
                  <Layers className="mr-2 size-4" />
                  Запустить предсказания
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
