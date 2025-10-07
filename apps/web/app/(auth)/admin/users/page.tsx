"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { RefreshCw, Shield, Trash2, Users } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiRequest } from "@/lib/api/client";
import { authClient } from "@/lib/auth-client";
import type { User } from "@/types/user";

export default function AdminUsersPage() {
  const { data: session } = authClient.useSession();
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const sessionUser = session?.user as unknown as User;

  // Загрузка списка пользователей
  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["admin", "users"],
    queryFn: () => apiRequest<User[]>("/api/admin/users"),
    enabled: sessionUser?.role === "admin",
  });

  // Мутация для изменения роли
  const changeRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      apiRequest(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => {
      toast.success("Роль пользователя успешно изменена");
    },
    onError: (error: Error) => {
      toast.error(`Ошибка при изменении роли: ${error.message}`);
    },
  });

  // Мутация для удаления пользователя
  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) =>
      apiRequest(`/api/admin/users/${userId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("Пользователь успешно удален");
      setUserToDelete(null);
    },
    onError: (error: Error) => {
      toast.error(`Ошибка при удалении: ${error.message}`);
    },
  });

  // Проверка прав администратора
  if (sessionUser?.role !== "admin") {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Shield className="size-5" />
              Доступ запрещен
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              У вас нет прав для доступа к этой странице. Требуются права
              администратора.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="flex items-center gap-2">
          <RefreshCw className="size-5 animate-spin" />
          <span>Загрузка...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <Users className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-2xl">
              Управление пользователями
            </h1>
            <p className="text-muted-foreground text-sm">
              Всего пользователей: {users?.length || 0}
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Пользователь</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Роль</TableHead>
                <TableHead>Email подтвержден</TableHead>
                <TableHead>Портфели</TableHead>
                <TableHead>Ордера</TableHead>
                <TableHead>Биржи</TableHead>
                <TableHead>Дата регистрации</TableHead>
                <TableHead>Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Select
                      defaultValue={user.role}
                      disabled={
                        user.id === session?.user?.id ||
                        changeRoleMutation.isPending
                      }
                      onValueChange={(value) =>
                        changeRoleMutation.mutate({
                          userId: user.id,
                          role: value,
                        })
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">User</Badge>
                          </div>
                        </SelectItem>
                        <SelectItem value="admin">
                          <div className="flex items-center gap-2">
                            <Badge variant="default">Admin</Badge>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {user.emailVerified ? (
                      <Badge variant="default">Да</Badge>
                    ) : (
                      <Badge variant="secondary">Нет</Badge>
                    )}
                  </TableCell>
                  <TableCell>{user._count.portfolios}</TableCell>
                  <TableCell>{user._count.orders}</TableCell>
                  <TableCell>{user._count.exchangeCredentials}</TableCell>
                  <TableCell>
                    {new Date(user.createdAt).toLocaleDateString("ru-RU")}
                  </TableCell>
                  <TableCell>
                    <Button
                      disabled={user.id === session?.user.id}
                      onClick={() => setUserToDelete(user)}
                      size="sm"
                      variant="ghost"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Диалог подтверждения удаления */}
      <AlertDialog
        onOpenChange={(open) => !open && setUserToDelete(null)}
        open={!!userToDelete}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Подтверждение удаления</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить пользователя{" "}
              <strong>{userToDelete?.name}</strong> ({userToDelete?.email})?
              <br />
              <br />
              Это действие нельзя отменить. Все данные пользователя (портфели,
              ордера, настройки бирж) будут удалены.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteUserMutation.isPending}
              onClick={() =>
                userToDelete && deleteUserMutation.mutate(userToDelete.id)
              }
            >
              {deleteUserMutation.isPending ? "Удаление..." : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
