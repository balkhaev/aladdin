"use client";

import { AddExchangeCredentialDialog } from "../components/add-exchange-credential-dialog";
import { AuditLogTable } from "../components/audit-log-table";
import { ExchangeCredentialsList } from "../components/exchange-credentials-list";


export default function SettingsPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-end">
        <AddExchangeCredentialDialog />
      </div>

      <div className="space-y-6">
        <ExchangeCredentialsList />
        <AuditLogTable />
      </div>
    </div>
  );
}
