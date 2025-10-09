"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Eye, Plus, Power, Trash2, Webhook } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WebhookDetailsDialog } from "@/components/webhook-details-dialog";
import { apiRequest } from "@/lib/api/client";

type WebhookType = {
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
};

export default function WebhooksPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [webhookName, setWebhookName] = useState("");
  const [webhookToDelete, setWebhookToDelete] = useState<WebhookType | null>(
    null
  );
  const [selectedWebhookId, setSelectedWebhookId] = useState<string | null>(
    null
  );
  const queryClient = useQueryClient();

  const { data: webhooks, isLoading } = useQuery<WebhookType[]>({
    queryKey: ["admin", "webhooks"],
    queryFn: () => apiRequest<WebhookType[]>("/api/admin/webhooks"),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) =>
      apiRequest("/api/admin/webhooks", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      toast.success("Вебхук создан");
      queryClient.invalidateQueries({ queryKey: ["admin", "webhooks"] });
      setIsCreateOpen(false);
      setWebhookName("");
    },
    onError: (error: Error) => {
      toast.error(`Ошибка при создании вебхука: ${error.message}`);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest(`/api/admin/webhooks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: () => {
      toast.success("Статус вебхука обновлен");
      queryClient.invalidateQueries({ queryKey: ["admin", "webhooks"] });
    },
    onError: (error: Error) => {
      toast.error(`Ошибка при обновлении статуса: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/admin/webhooks/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Вебхук удален");
      queryClient.invalidateQueries({ queryKey: ["admin", "webhooks"] });
      setWebhookToDelete(null);
    },
    onError: (error: Error) => {
      toast.error(`Ошибка при удалении: ${error.message}`);
    },
  });

  const getWebhookUrl = (id: string, secret: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/api/trading/webhook/${id}?token=${secret}`;
  };

  const copyUrl = (id: string, secret: string) => {
    navigator.clipboard.writeText(getWebhookUrl(id, secret));
    toast.success("URL скопирован в буфер обмена");
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <Webhook className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-2xl">Управление вебхуками</h1>
            <p className="text-muted-foreground text-sm">
              Всего вебхуков: {webhooks?.length || 0}
            </p>
          </div>
        </div>

        <Dialog onOpenChange={setIsCreateOpen} open={isCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 size-4" />
              Создать вебхук
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Создать вебхук</DialogTitle>
              <DialogDescription>
                Укажите название стратегии для вебхука
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Название стратегии</Label>
                <Input
                  id="name"
                  onChange={(e) => setWebhookName(e.target.value)}
                  placeholder="TradingView Strategy"
                  value={webhookName}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                disabled={!webhookName || createMutation.isPending}
                onClick={() => createMutation.mutate(webhookName)}
              >
                Создать
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Вызовов</TableHead>
                <TableHead>Последний вызов</TableHead>
                <TableHead>Создан</TableHead>
                <TableHead>Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {webhooks?.length === 0 ? (
                <TableRow>
                  <TableCell className="text-center" colSpan={7}>
                    <div className="py-8 text-muted-foreground">
                      Нет вебхуков. Создайте первый вебхук.
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                webhooks?.map((webhook) => (
                  <TableRow key={webhook.id}>
                    <TableCell className="font-medium">
                      {webhook.name}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="rounded bg-muted px-2 py-1 text-xs">
                          /webhook/{webhook.id}
                        </code>
                        <Button
                          onClick={() => copyUrl(webhook.id, webhook.secret)}
                          size="sm"
                          variant="ghost"
                        >
                          <Copy className="size-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={webhook.isActive ? "default" : "secondary"}
                      >
                        {webhook.isActive ? "Активен" : "Отключен"}
                      </Badge>
                    </TableCell>
                    <TableCell>{webhook.totalCalls}</TableCell>
                    <TableCell>
                      {webhook.lastCalledAt
                        ? new Date(webhook.lastCalledAt).toLocaleString("ru-RU")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {new Date(webhook.createdAt).toLocaleDateString("ru-RU")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => setSelectedWebhookId(webhook.id)}
                          size="sm"
                          variant="ghost"
                        >
                          <Eye className="size-4" />
                        </Button>
                        <Button
                          disabled={toggleMutation.isPending}
                          onClick={() =>
                            toggleMutation.mutate({
                              id: webhook.id,
                              isActive: !webhook.isActive,
                            })
                          }
                          size="sm"
                          variant="ghost"
                        >
                          <Power className="size-4" />
                        </Button>
                        <Button
                          onClick={() => setWebhookToDelete(webhook)}
                          size="sm"
                          variant="ghost"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setWebhookToDelete(null);
          }
        }}
        open={!!webhookToDelete}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить вебхук?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить вебхук &quot;
              {webhookToDelete?.name}&quot;? Это действие необратимо.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (webhookToDelete) {
                  deleteMutation.mutate(webhookToDelete.id);
                }
              }}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <WebhookDetailsDialog
        onOpenChange={(open) => {
          if (!open) {
            setSelectedWebhookId(null);
          }
        }}
        open={!!selectedWebhookId}
        webhookId={selectedWebhookId}
      />
    </div>
  );
}
