/**
 * Exchange Context
 * Управляет выбранным exchange credential для синхронизации ордеров/позиций
 */

import { createContext, useContext, useEffect, useState } from "react";
import type { ExchangeCredential } from "@/lib/api/exchange-credentials";

type ExchangeContextType = {
  selectedCredential: ExchangeCredential | null;
  setSelectedCredential: (credential: ExchangeCredential | null) => void;
  isSyncing: boolean;
  setIsSyncing: (syncing: boolean) => void;
  isInitialized: boolean;
};

const ExchangeContext = createContext<ExchangeContextType | null>(null);

const STORAGE_KEY = "selected-exchange-credential";

export function ExchangeProvider({ children }: { children: React.ReactNode }) {
  const [selectedCredential, setSelectedCredentialState] =
    useState<ExchangeCredential | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ExchangeCredential;
        setSelectedCredentialState(parsed);
      } catch {
        // Invalid data, ignore
      }
    }
    setIsInitialized(true);
  }, []);

  // Save to localStorage when changed
  const setSelectedCredential = (credential: ExchangeCredential | null) => {
    setSelectedCredentialState(credential);
    if (credential) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(credential));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <ExchangeContext.Provider
      value={{
        selectedCredential,
        setSelectedCredential,
        isSyncing,
        setIsSyncing,
        isInitialized,
      }}
    >
      {children}
    </ExchangeContext.Provider>
  );
}

export function useExchange() {
  const context = useContext(ExchangeContext);
  if (!context) {
    throw new Error("useExchange must be used within ExchangeProvider");
  }
  return context;
}
