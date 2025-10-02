import { apiRequest } from "./client";

export type ExchangeCredential = {
  id: string;
  exchange: string;
  label: string;
  apiKey: string;
  testnet: boolean;
  isActive: boolean;
  category?: string; // spot, linear, etc.
  createdAt: string;
  updatedAt: string;
};

export type CreateCredentialRequest = {
  exchange: string;
  label: string;
  apiKey: string;
  apiSecret: string;
  testnet?: boolean;
};

export type UpdateCredentialRequest = {
  label?: string;
  isActive?: boolean;
  apiSecret?: string;
};

export type AuditLog = {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

/**
 * Get user's exchange credentials
 */
export function getExchangeCredentials(): Promise<ExchangeCredential[]> {
  return apiRequest<ExchangeCredential[]>("/api/exchange-credentials");
}

/**
 * Add new exchange credentials
 */
export function createExchangeCredential(
  data: CreateCredentialRequest
): Promise<ExchangeCredential> {
  return apiRequest<ExchangeCredential>("/api/exchange-credentials", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Update exchange credentials
 */
export function updateExchangeCredential(
  id: string,
  data: UpdateCredentialRequest
): Promise<ExchangeCredential> {
  return apiRequest<ExchangeCredential>(`/api/exchange-credentials/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/**
 * Delete exchange credentials
 */
export function deleteExchangeCredential(id: string): Promise<void> {
  return apiRequest<void>(`/api/exchange-credentials/${id}`, {
    method: "DELETE",
  });
}

/**
 * Get audit logs for exchange credentials
 */
export function getAuditLogs(params?: {
  resource?: string;
  action?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  items: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
}> {
  const searchParams = new URLSearchParams();
  if (params?.resource) searchParams.set("resource", params.resource);
  if (params?.action) searchParams.set("action", params.action);
  if (params?.limit) searchParams.set("limit", params.limit.toString());
  if (params?.offset) searchParams.set("offset", params.offset.toString());

  const url = `/api/exchange-credentials/audit${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  return apiRequest<{
    items: AuditLog[];
    total: number;
    page: number;
    pageSize: number;
    hasNext: boolean;
  }>(url);
}
