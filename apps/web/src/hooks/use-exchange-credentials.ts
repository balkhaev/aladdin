import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type CreateCredentialRequest,
  createExchangeCredential,
  deleteExchangeCredential,
  getAuditLogs,
  getExchangeCredentials,
  type UpdateCredentialRequest,
  updateExchangeCredential,
} from "../lib/api/exchange-credentials";

export function useExchangeCredentials() {
  return useQuery({
    queryKey: ["exchange-credentials"],
    queryFn: getExchangeCredentials,
  });
}

export function useCreateExchangeCredential() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCredentialRequest) =>
      createExchangeCredential(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exchange-credentials"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });
}

export function useUpdateExchangeCredential() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCredentialRequest }) =>
      updateExchangeCredential(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exchange-credentials"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });
}

export function useDeleteExchangeCredential() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteExchangeCredential(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exchange-credentials"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });
}

export function useAuditLogs(params?: {
  resource?: string;
  action?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ["audit-logs", params],
    queryFn: () => getAuditLogs(params),
  });
}
