/**
 * Risk Limits Card Component
 * Управление лимитами риска (создание, редактирование, удаление)
 */

import { Plus, Settings, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  useCreateRiskLimit,
  useDeleteRiskLimit,
  useRiskLimits,
  useUpdateRiskLimit,
} from "../hooks/use-risk";
import type { CreateRiskLimitInput, RiskLimit } from "../lib/api/risk";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
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
import { Switch } from "./ui/switch";

type RiskLimitsCardProps = {
  portfolioId?: string;
};

const LIMIT_TYPES = [
  { value: "MAX_LEVERAGE", label: "Макс. плечо", unit: "x" },
  { value: "MAX_POSITION_SIZE", label: "Макс. размер позиции", unit: "$" },
  { value: "MAX_DAILY_LOSS", label: "Макс. дневной убыток", unit: "$" },
  { value: "MIN_MARGIN", label: "Мин. маржа", unit: "$" },
] as const;

export function RiskLimitsCard({ portfolioId }: RiskLimitsCardProps) {
  const { data: limits, isLoading } = useRiskLimits(portfolioId);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingLimit, setEditingLimit] = useState<RiskLimit | null>(null);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Лимиты риска
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Лимиты риска
          </CardTitle>
          <Dialog
            onOpenChange={setIsCreateDialogOpen}
            open={isCreateDialogOpen}
          >
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Добавить
              </Button>
            </DialogTrigger>
            <DialogContent>
              <CreateLimitDialog
                onClose={() => setIsCreateDialogOpen(false)}
                portfolioId={portfolioId}
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {limits && limits.length > 0 ? (
          <div className="space-y-3">
            {limits.map((limit) => (
              <LimitRow
                key={limit.id}
                limit={limit}
                onEdit={() => setEditingLimit(limit)}
              />
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground text-sm">
            Лимиты риска не настроены
          </p>
        )}

        {editingLimit && (
          <Dialog
            onOpenChange={(open) => !open && setEditingLimit(null)}
            open={!!editingLimit}
          >
            <DialogContent>
              <EditLimitDialog
                limit={editingLimit}
                onClose={() => setEditingLimit(null)}
              />
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}

function LimitRow({ limit, onEdit }: { limit: RiskLimit; onEdit: () => void }) {
  const updateMutation = useUpdateRiskLimit();
  const deleteMutation = useDeleteRiskLimit();

  const limitType = LIMIT_TYPES.find((t) => t.value === limit.type);
  const unit = limitType?.unit ?? "";

  const handleToggle = (enabled: boolean) => {
    updateMutation.mutate({ id: limit.id, input: { enabled } });
  };

  const handleDelete = () => {
    if (confirm("Удалить этот лимит?")) {
      deleteMutation.mutate(limit.id);
    }
  };

  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div className="flex items-center gap-3">
        <Switch checked={limit.enabled} onCheckedChange={handleToggle} />
        <div>
          <p className="font-medium text-sm">{limitType?.label}</p>
          <p className="text-muted-foreground text-xs">
            {limit.value}
            {unit}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!limit.enabled && (
          <Badge className="text-xs" variant="secondary">
            Отключен
          </Badge>
        )}
        <Button onClick={onEdit} size="sm" variant="ghost">
          <Settings className="h-4 w-4" />
        </Button>
        <Button
          className="text-red-600 hover:text-red-700"
          onClick={handleDelete}
          size="sm"
          variant="ghost"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function CreateLimitDialog({
  portfolioId,
  onClose,
}: {
  portfolioId?: string;
  onClose: () => void;
}) {
  const createMutation = useCreateRiskLimit();
  const [formData, setFormData] = useState<CreateRiskLimitInput>({
    type: "MAX_LEVERAGE",
    value: 0,
    enabled: true,
    portfolioId,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData, {
      onSuccess: () => {
        onClose();
      },
    });
  };

  const selectedType = LIMIT_TYPES.find((t) => t.value === formData.type);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Добавить лимит риска</DialogTitle>
        <DialogDescription>
          Установите лимит для контроля рисков торговли
        </DialogDescription>
      </DialogHeader>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="type">Тип лимита</Label>
          <Select
            onValueChange={(value) =>
              setFormData({
                ...formData,
                type: value as CreateRiskLimitInput["type"],
              })
            }
            value={formData.type}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIMIT_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="value">Значение ({selectedType?.unit})</Label>
          <Input
            id="value"
            onChange={(e) =>
              setFormData({
                ...formData,
                value: Number.parseFloat(e.target.value),
              })
            }
            placeholder="0"
            required
            step="0.01"
            type="number"
            value={formData.value || ""}
          />
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            checked={formData.enabled}
            id="enabled"
            onCheckedChange={(enabled) => setFormData({ ...formData, enabled })}
          />
          <Label className="cursor-pointer" htmlFor="enabled">
            Включить сразу после создания
          </Label>
        </div>

        <DialogFooter>
          <Button onClick={onClose} type="button" variant="outline">
            Отмена
          </Button>
          <Button disabled={createMutation.isPending} type="submit">
            {createMutation.isPending ? "Создание..." : "Создать"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

function EditLimitDialog({
  limit,
  onClose,
}: {
  limit: RiskLimit;
  onClose: () => void;
}) {
  const updateMutation = useUpdateRiskLimit();
  const [value, setValue] = useState(limit.value);
  const [enabled, setEnabled] = useState(limit.enabled);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(
      { id: limit.id, input: { value, enabled } },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  const limitType = LIMIT_TYPES.find((t) => t.value === limit.type);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Редактировать лимит</DialogTitle>
        <DialogDescription>{limitType?.label}</DialogDescription>
      </DialogHeader>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="edit-value">Значение ({limitType?.unit})</Label>
          <Input
            id="edit-value"
            onChange={(e) => setValue(Number.parseFloat(e.target.value))}
            required
            step="0.01"
            type="number"
            value={value}
          />
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            checked={enabled}
            id="edit-enabled"
            onCheckedChange={setEnabled}
          />
          <Label className="cursor-pointer" htmlFor="edit-enabled">
            Включен
          </Label>
        </div>

        <DialogFooter>
          <Button onClick={onClose} type="button" variant="outline">
            Отмена
          </Button>
          <Button disabled={updateMutation.isPending} type="submit">
            {updateMutation.isPending ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
