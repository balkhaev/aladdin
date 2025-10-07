/**
 * Enhanced Positions Table with Edit/Delete
 */

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDeletePosition } from "@/hooks/use-portfolio";
import type { Position } from "@/lib/api/portfolio";
import {
  formatCurrency,
  formatPercent,
  formatQuantity,
  getPnLColor,
} from "@/lib/formatters";
import { EditPositionDialog } from "./edit-position-dialog";

type PositionsTableEnhancedProps = {
  portfolioId: string;
  positions: Position[];
};

export function PositionsTableEnhanced({
  portfolioId,
  positions,
}: PositionsTableEnhancedProps) {
  const deletePosition = useDeletePosition();

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Символ</TableHead>
            <TableHead className="text-right">Количество</TableHead>
            <TableHead className="text-right">Средняя цена</TableHead>
            <TableHead className="text-right">Текущая цена</TableHead>
            <TableHead className="text-right">Стоимость</TableHead>
            <TableHead className="text-right">P&L</TableHead>
            <TableHead className="text-right">Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.map((position) => (
            <TableRow key={position.symbol}>
              <TableCell className="font-medium">{position.symbol}</TableCell>
              <TableCell className="text-right">
                {formatQuantity(position.quantity)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(position.averagePrice)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(position.currentPrice)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(position.value)}
              </TableCell>
              <TableCell className={`text-right ${getPnLColor(position.pnl)}`}>
                <div className="flex items-center justify-end gap-1">
                  {formatCurrency(position.pnl)}
                  {position.pnl !== 0 &&
                    (position.pnl > 0 ? (
                      <ArrowUp className="h-3 w-3" />
                    ) : (
                      <ArrowDown className="h-3 w-3" />
                    ))}
                </div>
                <div className="text-xs">
                  {formatPercent(position.pnlPercent, 2, true)}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <EditPositionDialog
                    portfolioId={portfolioId}
                    position={position}
                  />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Удалить позицию?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Вы уверены, что хотите удалить позицию{" "}
                          {position.symbol}?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Отмена</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() =>
                            deletePosition.mutate({
                              portfolioId,
                              positionId: position.id,
                            })
                          }
                        >
                          Удалить
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
