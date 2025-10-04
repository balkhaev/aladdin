import { createSuccessResponse, HTTP_STATUS } from "@aladdin/shared/http";
import type { Hono } from "hono";
import type { StrategyExecutor } from "../services/executor";

export function setupExecutorRoutes(app: Hono, executor: StrategyExecutor | undefined) {
  /**
   * GET /api/trading/executor/stats - Get executor statistics
   */
  app.get("/api/trading/executor/stats", async (c) => {
    if (!executor) {
      return c.json({
        success: false,
        error: {
          code: "EXECUTOR_NOT_INITIALIZED",
          message: "Strategy executor not initialized",
        },
        timestamp: Date.now(),
      }, HTTP_STATUS.SERVICE_UNAVAILABLE);
    }

    const stats = executor.getStats();
    return c.json(createSuccessResponse(stats));
  });

  /**
   * GET /api/trading/executor/config - Get current configuration
   */
  app.get("/api/trading/executor/config", async (c) => {
    if (!executor) {
      return c.json({
        success: false,
        error: {
          code: "EXECUTOR_NOT_INITIALIZED",
          message: "Strategy executor not initialized",
        },
        timestamp: Date.now(),
      }, HTTP_STATUS.SERVICE_UNAVAILABLE);
    }

    const config = executor.getConfig();
    return c.json(createSuccessResponse(config));
  });

  /**
   * PATCH /api/trading/executor/config - Update configuration
   */
  app.patch("/api/trading/executor/config", async (c) => {
    if (!executor) {
      return c.json({
        success: false,
        error: {
          code: "EXECUTOR_NOT_INITIALIZED",
          message: "Strategy executor not initialized",
        },
        timestamp: Date.now(),
      }, HTTP_STATUS.SERVICE_UNAVAILABLE);
    }

    try {
      const body = await c.req.json<Record<string, unknown>>();
      executor.updateConfig(body);

      return c.json(
        createSuccessResponse({
          message: "Configuration updated",
          config: executor.getConfig(),
        })
      );
    } catch (error) {
      return c.json(
        {
          success: false,
          error: {
            code: "CONFIG_UPDATE_FAILED",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  });

  /**
   * GET /api/trading/executor/pending - Get pending signals
   */
  app.get("/api/trading/executor/pending", async (c) => {
    if (!executor) {
      return c.json({
        success: false,
        error: {
          code: "EXECUTOR_NOT_INITIALIZED",
          message: "Strategy executor not initialized",
        },
        timestamp: Date.now(),
      }, HTTP_STATUS.SERVICE_UNAVAILABLE);
    }

    const pending = executor.getPendingSignals();

    return c.json(
      createSuccessResponse({
        signals: pending,
        count: pending.length,
      })
    );
  });

  /**
   * POST /api/trading/executor/mode - Set execution mode (PAPER/LIVE)
   */
  app.post("/api/trading/executor/mode", async (c) => {
    if (!executor) {
      return c.json({
        success: false,
        error: {
          code: "EXECUTOR_NOT_INITIALIZED",
          message: "Strategy executor not initialized",
        },
        timestamp: Date.now(),
      }, HTTP_STATUS.SERVICE_UNAVAILABLE);
    }

    try {
      const body = await c.req.json<{ mode: "PAPER" | "LIVE" }>();

      if (body.mode !== "PAPER" && body.mode !== "LIVE") {
        return c.json(
          {
            success: false,
            error: {
              code: "INVALID_MODE",
              message: "Mode must be PAPER or LIVE",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.BAD_REQUEST
        );
      }

      executor.updateConfig({ mode: body.mode });

      return c.json(
        createSuccessResponse({
          message: `Execution mode set to ${body.mode}`,
          mode: body.mode,
        })
      );
    } catch (error) {
      return c.json(
        {
          success: false,
          error: {
            code: "MODE_CHANGE_FAILED",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  });

  /**
   * POST /api/trading/executor/toggle - Toggle auto-execution
   */
  app.post("/api/trading/executor/toggle", async (c) => {
    if (!executor) {
      return c.json({
        success: false,
        error: {
          code: "EXECUTOR_NOT_INITIALIZED",
          message: "Strategy executor not initialized",
        },
        timestamp: Date.now(),
      }, HTTP_STATUS.SERVICE_UNAVAILABLE);
    }

    try {
      const body = await c.req.json<{ autoExecute: boolean }>();
      executor.updateConfig({ autoExecute: body.autoExecute });

      return c.json(
        createSuccessResponse({
          message: `Auto-execution ${body.autoExecute ? "enabled" : "disabled"}`,
          autoExecute: body.autoExecute,
        })
      );
    } catch (error) {
      return c.json(
        {
          success: false,
          error: {
            code: "TOGGLE_FAILED",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  });

  /**
   * POST /api/trading/executor/manual - Manually execute a signal
   */
  app.post("/api/trading/executor/manual", async (c) => {
    if (!executor) {
      return c.json({
        success: false,
        error: {
          code: "EXECUTOR_NOT_INITIALIZED",
          message: "Strategy executor not initialized",
        },
        timestamp: Date.now(),
      }, HTTP_STATUS.SERVICE_UNAVAILABLE);
    }

    try {
      const body = await c.req.json<{
        symbol: string;
        recommendation: "STRONG_BUY" | "BUY" | "SELL" | "STRONG_SELL";
        confidence: number;
      }>();

      const signal = {
        ...body,
        shouldExecute: true,
        source: "manual" as const,
        timestamp: new Date(),
      };

      const result = await executor.manualExecute(signal);

      return c.json(createSuccessResponse(result));
    } catch (error) {
      return c.json(
        {
          success: false,
          error: {
            code: "MANUAL_EXECUTION_FAILED",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  });
}

