import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { PrismaClient } from "@aladdin/database";
import type { Logger } from "@aladdin/logger";
import type { NatsClient } from "@aladdin/messaging";
import { TradingService } from "./trading";

// Mock dependencies
const createMockLogger = (): Logger => ({
  info: mock(() => {
    // Mock implementation
  }),
  error: mock(() => {
    // Mock implementation
  }),
  warn: mock(() => {
    // Mock implementation
  }),
  debug: mock(() => {
    // Mock implementation
  }),
});

const createMockNatsClient = (): NatsClient => ({
  publish: mock(async () => {
    // Mock implementation
  }),
  subscribe: mock(() => ({
    unsubscribe: mock(() => {
      // Mock implementation
    }),
  })),
  close: mock(async () => {
    // Mock implementation
  }),
});

const createMockPrismaClient = (): PrismaClient => {
  const mockOrder = {
    id: "test-order-id",
    userId: "test-user-id",
    portfolioId: null,
    symbol: "BTCUSDT",
    type: "MARKET",
    side: "BUY",
    quantity: "0.01",
    price: null,
    stopPrice: null,
    status: "PENDING",
    filledQty: "0",
    avgPrice: null,
    exchange: "binance",
    exchangeOrderId: "exchange-order-123",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return {
    order: {
      create: mock(async () => mockOrder),
      findFirst: mock(async () => mockOrder),
      findUnique: mock(async () => mockOrder),
      findMany: mock(async () => [mockOrder]),
      update: mock(async () => ({ ...mockOrder, status: "CANCELLED" })),
      count: mock(async () => 1),
    },
    exchangeCredentials: {
      findFirst: mock(async () => ({
        id: "cred-id",
        userId: "test-user-id",
        exchange: "binance",
        apiKey: "test-api-key",
        apiSecret: "encrypted-secret",
        testnet: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    },
  } as unknown as PrismaClient;
};

describe("TradingService", () => {
  let service: TradingService;
  let mockLogger: Logger;
  let mockNatsClient: NatsClient;
  let mockPrisma: PrismaClient;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockNatsClient = createMockNatsClient();
    mockPrisma = createMockPrismaClient();

    service = new TradingService({
      logger: mockLogger,
      natsClient: mockNatsClient,
      prisma: mockPrisma,
    });
  });

  describe("createOrder", () => {
    test("should log order creation", async () => {
      const params = {
        userId: "test-user-id",
        symbol: "BTCUSDT",
        type: "MARKET" as const,
        side: "BUY" as const,
        quantity: 0.01,
        exchange: "binance",
      };

      // Note: This test will fail without proper exchange connector mocking
      // We're testing the logging behavior here
      try {
        await service.createOrder(params);
      } catch {
        // Expected to fail due to missing credentials/connector
      }

      // Verify logger was called
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Creating order",
        expect.objectContaining({
          symbol: params.symbol,
          type: params.type,
          side: params.side,
          quantity: params.quantity,
          exchange: params.exchange,
        })
      );
    });

    test("should throw error when no exchange credentials found", async () => {
      // Mock missing credentials
      mockPrisma.exchangeCredentials.findFirst = mock(async () => null);

      const params = {
        userId: "test-user-id",
        symbol: "BTCUSDT",
        type: "MARKET" as const,
        side: "BUY" as const,
        quantity: 0.01,
        exchange: "binance",
      };

      await expect(service.createOrder(params)).rejects.toThrow(
        "No active binance credentials found for user"
      );
    });
  });

  describe("cancelOrder", () => {
    test("should log order cancellation", async () => {
      const orderId = "test-order-id";
      const userId = "test-user-id";

      // Mock order with PENDING status
      mockPrisma.order.findFirst = mock(async () => ({
        id: orderId,
        userId,
        portfolioId: null,
        symbol: "BTCUSDT",
        type: "MARKET",
        side: "BUY",
        quantity: "0.01",
        price: null,
        stopPrice: null,
        status: "PENDING",
        filledQty: "0",
        avgPrice: null,
        exchange: "binance",
        exchangeOrderId: "exchange-order-123",
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      try {
        await service.cancelOrder(orderId, userId);
      } catch {
        // Expected to fail due to missing exchange connector
      }

      // Verify logger was called
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Cancelling order",
        expect.objectContaining({ orderId, userId })
      );
    });

    test("should throw error when order not found", async () => {
      mockPrisma.order.findFirst = mock(async () => null);

      await expect(
        service.cancelOrder("non-existent-id", "test-user-id")
      ).rejects.toThrow("Order not found");
    });

    test("should throw error when trying to cancel FILLED order", async () => {
      mockPrisma.order.findFirst = mock(async () => ({
        id: "test-order-id",
        userId: "test-user-id",
        portfolioId: null,
        symbol: "BTCUSDT",
        type: "MARKET",
        side: "BUY",
        quantity: "0.01",
        price: null,
        stopPrice: null,
        status: "FILLED",
        filledQty: "0.01",
        avgPrice: "40000",
        exchange: "binance",
        exchangeOrderId: "exchange-order-123",
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      await expect(
        service.cancelOrder("test-order-id", "test-user-id")
      ).rejects.toThrow("Order already filled");
    });

    test("should throw error when trying to cancel CANCELLED order", async () => {
      mockPrisma.order.findFirst = mock(async () => ({
        id: "test-order-id",
        userId: "test-user-id",
        portfolioId: null,
        symbol: "BTCUSDT",
        type: "MARKET",
        side: "BUY",
        quantity: "0.01",
        price: null,
        stopPrice: null,
        status: "CANCELLED",
        filledQty: "0",
        avgPrice: null,
        exchange: "binance",
        exchangeOrderId: "exchange-order-123",
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      await expect(
        service.cancelOrder("test-order-id", "test-user-id")
      ).rejects.toThrow("Order already cancelled");
    });
  });

  describe("getOrder", () => {
    test("should return formatted order when found", async () => {
      const mockOrder = {
        id: "test-order-id",
        userId: "test-user-id",
        portfolioId: null,
        symbol: "BTCUSDT",
        type: "MARKET",
        side: "BUY",
        quantity: "0.01",
        price: null,
        stopPrice: null,
        status: "FILLED",
        filledQty: "0.01",
        avgPrice: "40000",
        exchange: "binance",
        exchangeOrderId: "exchange-order-123",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.order.findFirst = mock(async () => mockOrder);

      const result = await service.getOrder("test-order-id", "test-user-id");

      expect(result).not.toBeNull();
      expect(result?.id).toBe(mockOrder.id);
      expect(result?.symbol).toBe(mockOrder.symbol);
      expect(result?.quantity).toBe(Number(mockOrder.quantity));
      expect(result?.avgPrice).toBe(Number(mockOrder.avgPrice));
    });

    test("should return null when order not found", async () => {
      mockPrisma.order.findFirst = mock(async () => null);

      const result = await service.getOrder("non-existent-id", "test-user-id");

      expect(result).toBeNull();
    });
  });

  describe("getOrders", () => {
    test("should return orders with total count", async () => {
      const mockOrders = [
        {
          id: "order-1",
          userId: "test-user-id",
          portfolioId: null,
          symbol: "BTCUSDT",
          type: "MARKET",
          side: "BUY",
          quantity: "0.01",
          price: null,
          stopPrice: null,
          status: "FILLED",
          filledQty: "0.01",
          avgPrice: "40000",
          exchange: "binance",
          exchangeOrderId: "exchange-order-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "order-2",
          userId: "test-user-id",
          portfolioId: null,
          symbol: "ETHUSDT",
          type: "LIMIT",
          side: "SELL",
          quantity: "1.0",
          price: "2500",
          stopPrice: null,
          status: "PENDING",
          filledQty: "0",
          avgPrice: null,
          exchange: "binance",
          exchangeOrderId: "exchange-order-2",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.order.findMany = mock(async () => mockOrders);
      mockPrisma.order.count = mock(async () => 2);

      const result = await service.getOrders({
        userId: "test-user-id",
        exchange: "binance",
      });

      expect(result.orders).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.orders[0].id).toBe("order-1");
      expect(result.orders[1].id).toBe("order-2");
    });

    test("should apply filters correctly", async () => {
      mockPrisma.order.findMany = mock(async () => []);
      mockPrisma.order.count = mock(async () => 0);

      await service.getOrders({
        userId: "test-user-id",
        symbol: "BTCUSDT",
        status: "FILLED",
        exchange: "binance",
        limit: 20,
        offset: 10,
      });

      // Verify findMany was called with correct filters
      expect(mockPrisma.order.findMany).toHaveBeenCalledWith({
        where: {
          userId: "test-user-id",
          exchange: "binance",
          symbol: "BTCUSDT",
          status: "FILLED",
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        skip: 10,
      });
    });

    test("should use default limit and offset", async () => {
      mockPrisma.order.findMany = mock(async () => []);
      mockPrisma.order.count = mock(async () => 0);

      await service.getOrders({
        userId: "test-user-id",
        exchange: "binance",
      });

      // Verify default values were used
      expect(mockPrisma.order.findMany).toHaveBeenCalledWith({
        where: {
          userId: "test-user-id",
          exchange: "binance",
        },
        orderBy: { createdAt: "desc" },
        take: 50, // default
        skip: 0, // default
      });
    });
  });

  describe("getExchangeBalances", () => {
    test("should throw error when credentials not found", async () => {
      mockPrisma.exchangeCredentials.findFirst = mock(async () => null);

      await expect(
        service.getExchangeBalances("non-existent-cred-id", "test-user-id")
      ).rejects.toThrow("Exchange credentials not found or inactive");
    });
  });
});
