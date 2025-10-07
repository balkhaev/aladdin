/**
 * Add Position Dialog Component
 * Dialog for manually adding a position to portfolio
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useDialog } from "@/hooks/use-dialog";

const MAX_SYMBOL_LENGTH = 20;

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useCreatePosition } from "@/hooks/use-portfolio";

const formSchema = z.object({
  symbol: z
    .string()
    .min(1, "Символ обязателен")
    .max(MAX_SYMBOL_LENGTH, "Слишком длинный символ"),
  quantity: z.number().positive("Количество должно быть положительным"),
  entryPrice: z.number().positive("Цена должна быть положительной"),
  side: z.enum(["LONG", "SHORT"]).default("LONG"),
});

type AddPositionDialogProps = {
  portfolioId: string;
};

export function AddPositionDialog({ portfolioId }: AddPositionDialogProps) {
  const { dialogProps, closeDialog } = useDialog();
  const createPosition = useCreatePosition();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      symbol: "",
      quantity: 0,
      entryPrice: 0,
      side: "LONG",
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createPosition.mutate(
      {
        portfolioId,
        ...values,
      },
      {
        onSuccess: () => {
          closeDialog();
          form.reset();
        },
      }
    );
  };

  return (
    <Dialog {...dialogProps}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Добавить позицию
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Добавить позицию</DialogTitle>
          <DialogDescription>
            Ручное добавление позиции в портфель
          </DialogDescription>
        </DialogHeader>
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
                  <FormDescription>Торговая пара</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Количество</FormLabel>
                  <FormControl>
                    <Input
                      step="any"
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="entryPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Цена входа</FormLabel>
                  <FormControl>
                    <Input
                      step="any"
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="side"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Направление</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="LONG">LONG</SelectItem>
                      <SelectItem value="SHORT">SHORT</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                onClick={() => setOpen(false)}
                type="button"
                variant="outline"
              >
                Отмена
              </Button>
              <Button disabled={createPosition.isPending} type="submit">
                {createPosition.isPending ? "Добавление..." : "Добавить"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
