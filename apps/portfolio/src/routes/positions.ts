/**
 * Positions Routes
 */

import { createSuccessResponse, HTTP_STATUS } from "@aladdin/shared/http";
import { validateBody } from "@aladdin/shared/middleware/validation";
import type { Hono } from "hono";
import type { PortfolioService } from "../services/portfolio";
import {
  type CreatePositionBody,
  type ImportPositionsBody,
  type UpdatePositionBody,
  createPositionSchema,
  importPositionsSchema,
  updatePositionSchema,
} from "../validation/schemas";

export function setupPositionsRoutes(
  app: Hono,
  service: PortfolioService
): void {
  /**
   * POST /api/portfolio/:id/import - Import positions to portfolio
   */
  app.post(
    "/api/portfolio/:id/import",
    validateBody(importPositionsSchema),
    async (c) => {
      const { id } = c.req.param();
      const userId = c.req.header("x-user-id") ?? "test-user";
      const body = c.get("validatedBody") as ImportPositionsBody;

      const positions = await service.importPositions({
        portfolioId: id,
        userId,
        assets: body.assets,
        exchange: body.exchange,
        exchangeCredentialsId: body.exchangeCredentialsId,
      });

      return c.json(createSuccessResponse(positions), HTTP_STATUS.CREATED);
    }
  );

  /**
   * POST /api/portfolio/:id/positions - Create position manually
   */
  app.post(
    "/api/portfolio/:id/positions",
    validateBody(createPositionSchema),
    async (c) => {
      const { id } = c.req.param();
      const userId = c.req.header("x-user-id") ?? "test-user";
      const body = c.get("validatedBody") as CreatePositionBody;

      const position = await service.createPosition({
        portfolioId: id,
        userId,
        symbol: body.symbol,
        quantity: body.quantity,
        entryPrice: body.entryPrice,
        side: body.side,
      });

      return c.json(createSuccessResponse(position), HTTP_STATUS.CREATED);
    }
  );

  /**
   * PATCH /api/portfolio/:id/positions/:positionId - Update position
   */
  app.patch(
    "/api/portfolio/:id/positions/:positionId",
    validateBody(updatePositionSchema),
    async (c) => {
      const { id, positionId } = c.req.param();
      const userId = c.req.header("x-user-id") ?? "test-user";
      const body = c.get("validatedBody") as UpdatePositionBody;

      const position = await service.updatePositionManual(
        positionId,
        id,
        userId,
        body
      );

      return c.json(createSuccessResponse(position));
    }
  );

  /**
   * DELETE /api/portfolio/:id/positions/:positionId - Delete position
   */
  app.delete("/api/portfolio/:id/positions/:positionId", async (c) => {
    const { id, positionId } = c.req.param();
    const userId = c.req.header("x-user-id") ?? "test-user";

    await service.deletePosition(positionId, id, userId);

    return c.json(createSuccessResponse({ message: "Position deleted" }));
  });
}
