"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Copy, Edit2, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/api/client";

type WebhookLog = {
  id: string;
  success: boolean;
  statusCode: number;
  signal: string | null;
  response: string | null;
  error: string | null;
  duration: number | null;
  ipAddress: string | null;
  createdAt: string;
};

type WebhookDetails = {
  id: string;
  name: string;
  secret: string;
  isActive: boolean;
  totalCalls: number;
  lastCalledAt: string | null;
  createdAt: string;
  createdBy: {
    name: string;
    email: string;
  };
  logs: WebhookLog[];
};

type WebhookDetailsDialogProps = {
  webhookId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function WebhookDetailsDialog({
  webhookId,
  open,
  onOpenChange,
}: WebhookDetailsDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState("");
  const queryClient = useQueryClient();

  const { data: webhook, isLoading } = useQuery<WebhookDetails>({
    queryKey: ["admin", "webhook", webhookId],
    queryFn: () =>
      apiRequest<WebhookDetails>(`/api/admin/webhooks/${webhookId}`),
    enabled: !!webhookId && open,
  });

  const updateMutation = useMutation({
    mutationFn: (name: string) =>
      apiRequest(`/api/admin/webhooks/${webhookId}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      toast.success("Название обновлено");
      queryClient.invalidateQueries({ queryKey: ["admin", "webhooks"] });
      queryClient.invalidateQueries({
        queryKey: ["admin", "webhook", webhookId],
      });
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });

  const getWebhookUrl = () => {
    if (!webhook) return "";
    const baseUrl = window.location.origin;
    return `${baseUrl}/api/trading/webhook/${webhook.id}?token=${webhook.secret}`;
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(getWebhookUrl());
    toast.success("URL скопирован");
  };

  const handleSaveName = () => {
    if (editedName.trim()) {
      updateMutation.mutate(editedName.trim());
    }
  };

  const renderStatusBadge = (log: WebhookLog) => {
    if (log.success) {
      return (
        <Badge className="gap-1" variant="default">
          <CheckCircle2 className="size-3" />
          {log.statusCode}
        </Badge>
      );
    }

    if (log.statusCode) {
      return (
        <Badge className="gap-1" variant="destructive">
          <XCircle className="size-3" />
          {log.statusCode}
        </Badge>
      );
    }

    return <Badge variant="secondary">Error</Badge>;
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return "—";
    if (ms < 1000) return `${ms}мс`;
    return `${(ms / 1000).toFixed(2)}с`;
  };

  if (isLoading) {
    // Still loading
  } else if (!webhook) {
    return null;
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? (
              <div className="flex flex-1 items-center gap-2">
                <Input
                  className="flex-1"
                  defaultValue={webhook?.name}
                  onChange={(e) => setEditedName(e.target.value)}
                  placeholder="Название стратегии"
                />
                <Button
                  disabled={updateMutation.isPending}
                  onClick={handleSaveName}
                  size="sm"
                >
                  Сохранить
                </Button>
                <Button
                  onClick={() => setIsEditing(false)}
                  size="sm"
                  variant="ghost"
                >
                  Отмена
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span>{webhook?.name}</span>
                <Button
                  onClick={() => {
                    setIsEditing(true);
                    setEditedName(webhook?.name || "");
                  }}
                  size="sm"
                  variant="ghost"
                >
                  <Edit2 className="size-3.5" />
                </Button>
              </div>
            )}
          </DialogTitle>
          <DialogDescription>Детали и логи вебхука</DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="py-8 text-center text-muted-foreground">
            Загрузка...
          </div>
        )}
        {!isLoading && webhook && (
          <Tabs className="w-full" defaultValue="details">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Детали</TabsTrigger>
              <TabsTrigger value="logs">
                Логи ({webhook.logs.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent className="space-y-4" value="details">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>URL вебхука</Label>
                  <div className="flex items-center gap-2">
                    <Input readOnly value={getWebhookUrl()} />
                    <Button onClick={copyUrl} size="sm" variant="outline">
                      <Copy className="size-4" />
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">
                      Статус
                    </Label>
                    <p className="mt-1">
                      {webhook.isActive ? (
                        <Badge variant="default">Активен</Badge>
                      ) : (
                        <Badge variant="secondary">Отключен</Badge>
                      )}
                    </p>
                  </div>

                  <div>
                    <Label className="text-muted-foreground text-xs">
                      Всего вызовов
                    </Label>
                    <p className="mt-1 font-semibold">{webhook.totalCalls}</p>
                  </div>

                  <div>
                    <Label className="text-muted-foreground text-xs">
                      Последний вызов
                    </Label>
                    <p className="mt-1 text-sm">
                      {webhook.lastCalledAt
                        ? new Date(webhook.lastCalledAt).toLocaleString("ru-RU")
                        : "—"}
                    </p>
                  </div>

                  <div>
                    <Label className="text-muted-foreground text-xs">
                      Создан
                    </Label>
                    <p className="mt-1 text-sm">
                      {new Date(webhook.createdAt).toLocaleString("ru-RU")}
                    </p>
                  </div>

                  <div>
                    <Label className="text-muted-foreground text-xs">
                      Создал
                    </Label>
                    <p className="mt-1 text-sm">{webhook.createdBy.name}</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="logs">
              <ScrollArea className="h-[500px]">
                {webhook.logs.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    Нет логов вызовов
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Статус</TableHead>
                        <TableHead>Время</TableHead>
                        <TableHead>Длительность</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead>Детали</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {webhook.logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>{renderStatusBadge(log)}</TableCell>
                          <TableCell className="text-xs">
                            {new Date(log.createdAt).toLocaleString("ru-RU")}
                          </TableCell>
                          <TableCell className="text-xs">
                            {formatDuration(log.duration)}
                          </TableCell>
                          <TableCell className="text-xs">
                            {log.ipAddress || "—"}
                          </TableCell>
                          <TableCell>
                            {log.error ? (
                              <p className="text-destructive text-xs">
                                {log.error}
                              </p>
                            ) : (
                              <p className="text-muted-foreground text-xs">
                                Успешно
                              </p>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
