"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Play } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { useTrainModel } from "@/hooks/use-train-model";
import type { TrainRequest } from "@/lib/api/ml";

const trainingSchema = z.object({
  symbol: z.string().min(1, "Символ обязателен"),
  model_type: z.enum(["LSTM", "GRU"]),
  hidden_size: z.number().min(16).max(512),
  num_layers: z.number().min(1).max(5),
  sequence_length: z.number().min(10).max(200),
  lookback_days: z.number().min(7).max(365),
  learning_rate: z.number().min(0.000_01).max(0.1),
  batch_size: z.number().min(8).max(256),
  epochs: z.number().min(10).max(500),
  dropout: z.number().min(0).max(0.5),
  bidirectional: z.boolean(),
  normalization: z.enum(["standard", "minmax", "robust"]),
});

type TrainingFormValues = z.infer<typeof trainingSchema>;

type TrainingFormProps = {
  onSuccess?: () => void;
};

export function TrainingForm({ onSuccess }: TrainingFormProps) {
  const trainMutation = useTrainModel();

  const form = useForm<TrainingFormValues>({
    resolver: zodResolver(trainingSchema),
    defaultValues: {
      symbol: "BTCUSDT",
      model_type: "LSTM",
      hidden_size: 128,
      num_layers: 2,
      sequence_length: 60,
      lookback_days: 30,
      learning_rate: 0.001,
      batch_size: 32,
      epochs: 100,
      dropout: 0.2,
      bidirectional: false,
      normalization: "standard",
    },
  });

  const onSubmit = async (values: TrainingFormValues) => {
    await trainMutation.mutateAsync(values as TrainRequest);
    form.reset();
    onSuccess?.();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Обучение новой модели</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid grid-cols-2 gap-4">
              {/* Symbol */}
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

              {/* Model Type */}
              <FormField
                control={form.control}
                name="model_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Тип модели</FormLabel>
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
                        <SelectItem value="LSTM">LSTM</SelectItem>
                        <SelectItem value="GRU">GRU</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Hidden Size */}
              <FormField
                control={form.control}
                name="hidden_size"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hidden Size</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        onChange={(e) =>
                          field.onChange(Number.parseInt(e.target.value, 10))
                        }
                        type="number"
                      />
                    </FormControl>
                    <FormDescription>16-512</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Num Layers */}
              <FormField
                control={form.control}
                name="num_layers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Слои</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        onChange={(e) =>
                          field.onChange(Number.parseInt(e.target.value, 10))
                        }
                        type="number"
                      />
                    </FormControl>
                    <FormDescription>1-5</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Sequence Length */}
              <FormField
                control={form.control}
                name="sequence_length"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Длина последовательности</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        onChange={(e) =>
                          field.onChange(Number.parseInt(e.target.value, 10))
                        }
                        type="number"
                      />
                    </FormControl>
                    <FormDescription>10-200</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Lookback Days */}
              <FormField
                control={form.control}
                name="lookback_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Дней истории</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        onChange={(e) =>
                          field.onChange(Number.parseInt(e.target.value, 10))
                        }
                        type="number"
                      />
                    </FormControl>
                    <FormDescription>7-365</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Learning Rate */}
              <FormField
                control={form.control}
                name="learning_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Learning Rate</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        onChange={(e) =>
                          field.onChange(Number.parseFloat(e.target.value))
                        }
                        step="0.0001"
                        type="number"
                      />
                    </FormControl>
                    <FormDescription>0.00001-0.1</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Batch Size */}
              <FormField
                control={form.control}
                name="batch_size"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Batch Size</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        onChange={(e) =>
                          field.onChange(Number.parseInt(e.target.value, 10))
                        }
                        type="number"
                      />
                    </FormControl>
                    <FormDescription>8-256</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Epochs */}
              <FormField
                control={form.control}
                name="epochs"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Эпохи</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        onChange={(e) =>
                          field.onChange(Number.parseInt(e.target.value, 10))
                        }
                        type="number"
                      />
                    </FormControl>
                    <FormDescription>10-500</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Dropout */}
              <FormField
                control={form.control}
                name="dropout"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dropout</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        onChange={(e) =>
                          field.onChange(Number.parseFloat(e.target.value))
                        }
                        step="0.1"
                        type="number"
                      />
                    </FormControl>
                    <FormDescription>0.0-0.5</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Normalization */}
              <FormField
                control={form.control}
                name="normalization"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Нормализация</FormLabel>
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
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="minmax">MinMax</SelectItem>
                        <SelectItem value="robust">Robust</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Bidirectional */}
              <FormField
                control={form.control}
                name="bidirectional"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Bidirectional</FormLabel>
                      <FormDescription>
                        Использовать двунаправленную модель
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <Button
              className="w-full"
              disabled={trainMutation.isPending}
              type="submit"
            >
              {trainMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Обучение...
                </>
              ) : (
                <>
                  <Play className="mr-2 size-4" />
                  Начать обучение
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
