/**
 * Конфигурация для подключения к API Gateway
 * Frontend обращается напрямую к Gateway (http://localhost:3000)
 * Прямое обращение к микросервисам не используется
 */

import { API_BASE_URL, WS_BASE_URL } from "./runtime-env";

export const API_CONFIG = {
  // Базовый URL API Gateway
  BASE_URL: API_BASE_URL,

  // WebSocket URL для real-time данных
  WS_URL: WS_BASE_URL,

  // Таймауты
  REQUEST_TIMEOUT: 30_000, // 30 секунд

  // Endpoints
  ENDPOINTS: {
    // Auth
    AUTH: {
      SIGN_IN: "/api/auth/sign-in",
      SIGN_UP: "/api/auth/sign-up",
      SIGN_OUT: "/api/auth/sign-out",
    },

    // Market Data
    MARKET_DATA: {
      TICKERS: "/api/market-data/tickers",
      QUOTE: "/api/market-data/quote",
      CANDLES: "/api/market-data/candles",
      TICKS: "/api/market-data/ticks",
    },

    // Trading
    TRADING: {
      ORDERS: "/api/trading/orders",
      POSITIONS: "/api/trading/positions",
      HISTORY: "/api/trading/history",
    },

    // Portfolio
    PORTFOLIO: {
      BASE: "/api/portfolio",
      HISTORY: "/api/portfolio/history",
      ALLOCATIONS: "/api/portfolio/allocations",
      PERFORMANCE: "/api/portfolio/performance",
    },

    // Risk
    RISK: {
      VAR: "/api/risk/var",
      EXPOSURE: "/api/risk/exposure",
      LIMITS: "/api/risk/limits",
      CHECK: "/api/risk/check",
    },

    // Analytics
    ANALYTICS: {
      BASE: "/api/analytics",
      INDICATORS: "/api/analytics/indicators",
      REPORTS: "/api/analytics/reports",
      STATISTICS: "/api/analytics/statistics",
      BACKTEST: "/api/analytics/backtest",
    },

    // Health
    HEALTH: {
      GATEWAY: "/health",
      SERVICES: "/health/services",
    },
  },
} as const;
