/**
 * Edit Position Dialog Component
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { Edit } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useDialog } from "@/hooks/use-dialog";
import { useUpdatePosition } from "@/hooks/use-portfolio";
import type { Position } from "@/lib/api/portfolio";

const formSchema = z.object({
  quantity: z.number().positive().optional(),
  entryPrice: z.number().positive().optional(),
});

type EditPositionDialogProps = {
  portfolioId: string;
  position: Position;
};

export function EditPositionDialog({
  portfolioId,
  position,
}: EditPositionDialogProps) {
  const { dialogProps, closeDialog } = useDialog();
  const updatePosition = useUpdatePosition();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantity: position.quantity,
      entryPrice: position.entryPrice,
    },
  });

  useEffect(() => {
    if (dialogProps.open) {
      form.reset({
        quantity: position.quantity,
        entryPrice: position.entryPrice,
      });
    }
  }, [dialogProps.open, position, form]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    updatePosition.mutate(
      {
        portfolioId,
        positionId: position.id,
        ...values,
      },
      {
        onSuccess: () => {
          closeDialog();
        },
      }
    );
  };

  return (
    <Dialog {...dialogProps}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Редактировать {position.symbol}</DialogTitle>
          <DialogDescription>Изменить параметры позиции</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
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
            <DialogFooter>
              <Button
                onClick={() => setOpen(false)}
                type="button"
                variant="outline"
              >
                Отмена
              </Button>
              <Button disabled={updatePosition.isPending} type="submit">
                {updatePosition.isPending ? "Сохранение..." : "Сохранить"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
