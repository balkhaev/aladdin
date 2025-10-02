/**
 * Конфигурация для подключения к API Gateway
 * Frontend работает ТОЛЬКО через Gateway (http://localhost:3000)
 * Прямое обращение к микросервисам НЕ используется
 */

export const API_CONFIG = {
  // Базовый URL API Gateway
  BASE_URL: import.meta.env.VITE_API_URL || "http://localhost:3000",

  // WebSocket URL для real-time данных
  WS_URL: import.meta.env.VITE_WS_URL || "ws://localhost:3000/ws",

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
