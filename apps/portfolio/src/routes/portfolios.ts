/**
 * Portfolio CRUD Routes
 */

import { createSuccessResponse, HTTP_STATUS } from "@aladdin/shared/http";
import {
  validateBody,
  validateQuery,
} from "@aladdin/shared/middleware/validation";
import type { Hono } from "hono";
import type { PortfolioService } from "../services/portfolio";
import {
  type CreatePortfolioBody,
  createPortfolioSchema,
  type GetPortfoliosBySymbolQuery,
  getPortfoliosBySymbolSchema,
  type UpdatePortfolioBody,
  updatePortfolioSchema,
} from "../validation/schemas";

export function setupPortfolioRoutes(
  app: Hono,
  service: PortfolioService
): void {
  /**
   * POST /api/portfolio - Create portfolio
   */
  app.post("/api/portfolio", validateBody(createPortfolioSchema), async (c) => {
    const userId = c.req.header("x-user-id") ?? "test-user";
    const body = c.get("validatedBody") as CreatePortfolioBody;

    const portfolio = await service.createPortfolio({
      userId,
      name: body.name,
      currency: body.currency,
      initialBalance: body.initialBalance,
    });

    return c.json(createSuccessResponse(portfolio), HTTP_STATUS.CREATED);
  });

  /**
   * GET /api/portfolio - Get user portfolios
   */
  app.get("/api/portfolio", async (c) => {
    const userId = c.req.header("x-user-id") ?? "test-user";
    const portfolios = await service.getPortfolios(userId);

    return c.json(createSuccessResponse(portfolios));
  });

  /**
   * GET /api/portfolio/symbols - Get all unique symbols
   */
  app.get("/api/portfolio/symbols", async (c) => {
    const symbols = await service.getAllSymbols();

    return c.json(createSuccessResponse(symbols));
  });

  /**
   * GET /api/portfolio/by-symbol/:symbol - Get portfolios by symbol
   */
  app.get(
    "/api/portfolio/by-symbol/:symbol",
    validateQuery(getPortfoliosBySymbolSchema),
    async (c) => {
      const { symbol } = c.req.param();
      const query = c.get("validatedQuery") as GetPortfoliosBySymbolQuery;

      const portfolios = await service.getPortfoliosBySymbol(
        symbol,
        query.userId
      );

      return c.json(createSuccessResponse(portfolios));
    }
  );

  /**
   * GET /api/portfolio/:id - Get portfolio by ID
   */
  app.get("/api/portfolio/:id", async (c) => {
    const { id } = c.req.param();
    const userId = c.req.header("x-user-id") ?? "test-user";

    const portfolio = await service.getPortfolio(id, userId);

    if (!portfolio) {
      return c.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Portfolio not found",
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.NOT_FOUND
      );
    }

    return c.json(createSuccessResponse(portfolio));
  });

  /**
   * PATCH /api/portfolio/:id - Update portfolio
   */
  app.patch(
    "/api/portfolio/:id",
    validateBody(updatePortfolioSchema),
    async (c) => {
      const { id } = c.req.param();
      const body = c.get("validatedBody") as UpdatePortfolioBody;

      const portfolio = await service.updatePortfolio(id, body);

      return c.json(createSuccessResponse(portfolio));
    }
  );

  /**
   * DELETE /api/portfolio/:id - Delete portfolio
   */
  app.delete("/api/portfolio/:id", async (c) => {
    const { id } = c.req.param();
    const userId = c.req.header("x-user-id") ?? "test-user";

    await service.deletePortfolio(id, userId);

    return c.json(createSuccessResponse({ message: "Portfolio deleted" }));
  });
}
