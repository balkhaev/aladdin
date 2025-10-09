"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { GitMerge, Loader2 } from "lucide-react";
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
import { useEnsemblePredictMutation } from "@/hooks/use-ensemble-predictions";
import type { EnsemblePredictionResult } from "@/lib/api/ml";

const ensembleSchema = z.object({
  symbol: z.string().min(1, "Символ обязателен"),
  horizon: z.enum(["1h", "4h", "1d", "7d"]),
  strategy: z.enum(["WEIGHTED_AVERAGE", "VOTING", "STACKING"]),
});

type EnsembleFormValues = z.infer<typeof ensembleSchema>;

type EnsembleConfigFormProps = {
  onResults?: (results: EnsemblePredictionResult) => void;
};

export function EnsembleConfigForm({ onResults }: EnsembleConfigFormProps) {
  const ensembleMutation = useEnsemblePredictMutation();

  const form = useForm<EnsembleFormValues>({
    resolver: zodResolver(ensembleSchema),
    defaultValues: {
      symbol: "BTCUSDT",
      horizon: "1h",
      strategy: "WEIGHTED_AVERAGE",
    },
  });

  const onSubmit = async (values: EnsembleFormValues) => {
    const result = await ensembleMutation.mutateAsync(values);
    onResults?.(result);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitMerge className="size-5" />
          Ансамблевые предсказания
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="symbol"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Символ</FormLabel>
                  <FormControl>
                    <Input placeholder="BTCUSDT" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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

            <FormField
              control={form.control}
              name="strategy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Стратегия ансамбля</FormLabel>
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
                      <SelectItem value="WEIGHTED_AVERAGE">
                        Взвешенное среднее
                      </SelectItem>
                      <SelectItem value="VOTING">Голосование</SelectItem>
                      <SelectItem value="STACKING">Стэкинг</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Метод комбинирования предсказаний
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              className="w-full"
              disabled={ensembleMutation.isPending}
              type="submit"
            >
              {ensembleMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Обработка...
                </>
              ) : (
                <>
                  <GitMerge className="mr-2 size-4" />
                  Получить предсказание
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
