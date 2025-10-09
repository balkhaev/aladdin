"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/api/client";

type ExchangeCredential = {
  id: string;
  exchange: string;
  label: string;
  testnet: boolean;
  isActive: boolean;
};

type UserActiveExchange = {
  activeExchangeCredentialsId: string | null;
  activeExchangeCredentials: {
    id: string;
    exchange: string;
    label: string;
    testnet: boolean;
  } | null;
};

export function ActiveExchangeSelector() {
  const queryClient = useQueryClient();

  const { data: credentials, isLoading: credentialsLoading } = useQuery<
    ExchangeCredential[]
  >({
    queryKey: ["exchange-credentials"],
    queryFn: () =>
      apiRequest<ExchangeCredential[]>("/api/exchange-credentials"),
  });

  const { data: user, isLoading: userLoading } = useQuery<UserActiveExchange>({
    queryKey: ["user", "active-exchange"],
    queryFn: () => apiRequest<UserActiveExchange>("/api/user/active-exchange"),
  });

  const updateMutation = useMutation({
    mutationFn: (credentialsId: string | null) =>
      apiRequest("/api/user/active-exchange", {
        method: "PATCH",
        body: JSON.stringify({
          activeExchangeCredentialsId: credentialsId,
        }),
      }),
    onSuccess: () => {
      toast.success("Активный ключ обновлен");
      queryClient.invalidateQueries({ queryKey: ["user", "active-exchange"] });
    },
    onError: (error: Error) => {
      toast.error(`Ошибка при обновлении ключа: ${error.message}`);
    },
  });

  const activeCredentials = credentials?.filter((c) => c.isActive) || [];
  const isLoading = credentialsLoading || userLoading;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Активный API ключ для автотрейдинга</CardTitle>
        <CardDescription>
          Выберите ключ, который будет использоваться для автоматического
          исполнения торговых сигналов от алгоритмов и вебхуков
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-muted-foreground text-sm">Загрузка...</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Select
                disabled={
                  updateMutation.isPending || activeCredentials.length === 0
                }
                onValueChange={(value) => updateMutation.mutate(value || null)}
                value={user?.activeExchangeCredentialsId || ""}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Выберите API ключ" />
                </SelectTrigger>
                <SelectContent>
                  {activeCredentials.map((cred) => (
                    <SelectItem key={cred.id} value={cred.id}>
                      <div className="flex items-center gap-2">
                        <span>{cred.label}</span>
                        <Badge className="text-xs" variant="outline">
                          {cred.exchange}
                        </Badge>
                        {cred.testnet && (
                          <Badge className="text-xs" variant="secondary">
                            testnet
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {user?.activeExchangeCredentialsId && (
                <CheckCircle2 className="size-5 shrink-0 text-green-500" />
              )}
            </div>

            {activeCredentials.length === 0 && (
              <p className="text-muted-foreground text-sm">
                У вас нет активных API ключей. Добавьте ключи выше, чтобы
                использовать автотрейдинг.
              </p>
            )}

            {user?.activeExchangeCredentials && (
              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Текущий активный ключ</p>
                    <p className="text-muted-foreground text-xs">
                      {user.activeExchangeCredentials.label} (
                      {user.activeExchangeCredentials.exchange}
                      {user.activeExchangeCredentials.testnet && " - testnet"})
                    </p>
                  </div>
                  <Badge variant="default">Активен</Badge>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
