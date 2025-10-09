"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Loader2, Search } from "lucide-react";
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
import { useDetectAnomaliesMutation } from "@/hooks/use-anomaly-detection";
import type { AnomalyDetectionResult } from "@/lib/api/ml";

const anomalySchema = z.object({
  symbol: z.string().min(1, "Символ обязателен"),
  lookbackMinutes: z.number().min(5).max(1440),
});

type AnomalyFormValues = z.infer<typeof anomalySchema>;

type AnomalyDetectionConfigProps = {
  onResults?: (results: AnomalyDetectionResult) => void;
};

export function AnomalyDetectionConfig({
  onResults,
}: AnomalyDetectionConfigProps) {
  const detectMutation = useDetectAnomaliesMutation();

  const form = useForm<AnomalyFormValues>({
    resolver: zodResolver(anomalySchema),
    defaultValues: {
      symbol: "BTCUSDT",
      lookbackMinutes: 60,
    },
  });

  const onSubmit = async (values: AnomalyFormValues) => {
    const result = await detectMutation.mutateAsync(values);
    onResults?.(result);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="size-5" />
          Детекция аномалий
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
              name="lookbackMinutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Период анализа (минуты)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onChange={(e) =>
                        field.onChange(Number.parseInt(e.target.value, 10))
                      }
                      type="number"
                    />
                  </FormControl>
                  <FormDescription>5-1440 минут</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              className="w-full"
              disabled={detectMutation.isPending}
              type="submit"
            >
              {detectMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Анализ...
                </>
              ) : (
                <>
                  <Search className="mr-2 size-4" />
                  Найти аномалии
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
