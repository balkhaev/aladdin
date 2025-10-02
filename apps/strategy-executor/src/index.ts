import { createSuccessResponse, HTTP_STATUS } from "@aladdin/shared/http";
import { initializeService } from "@aladdin/shared/service-bootstrap";
import { type ExecutorConfig, StrategyExecutor } from "./services/executor";
import "dotenv/config";

const DEFAULT_PORT = 3019;
const PORT = process.env.PORT ? Number(process.env.PORT) : DEFAULT_PORT;

// Executor configuration from environment
const executorConfig: Partial<ExecutorConfig> = {
  mode: (process.env.EXECUTOR_MODE as "PAPER" | "LIVE") || "PAPER",
  maxOpenPositions: Number(process.env.MAX_OPEN_POSITIONS || "5"),
  defaultUserId: process.env.DEFAULT_USER_ID || "",
  defaultPortfolioId: process.env.DEFAULT_PORTFOLIO_ID || "",
  defaultExchange: process.env.DEFAULT_EXCHANGE || "binance",
  autoExecute: process.env.AUTO_EXECUTE !== "false",
};

await initializeService<StrategyExecutor>({
  serviceName: "strategy-executor",
  port: PORT,

  createService: (deps) => new StrategyExecutor(deps, executorConfig),

  setupRoutes: (app, service) => {
    /**
     * GET /api/executor/stats - Get executor statistics
     */
    app.get("/api/executor/stats", async (c) => {
      const stats = service.getStats();
      return c.json(createSuccessResponse(stats));
    });

    /**
     * GET /api/executor/config - Get current configuration
     */
    app.get("/api/executor/config", async (c) => {
      const config = service.getConfig();
      return c.json(createSuccessResponse(config));
    });

    /**
     * PATCH /api/executor/config - Update configuration
     */
    app.patch("/api/executor/config", async (c) => {
      try {
        const body = await c.req.json<Partial<ExecutorConfig>>();

        service.updateConfig(body);

        return c.json(
          createSuccessResponse({
            message: "Configuration updated",
            config: service.getConfig(),
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
     * GET /api/executor/pending - Get pending signals
     */
    app.get("/api/executor/pending", async (c) => {
      const pending = service.getPendingSignals();

      return c.json(
        createSuccessResponse({
          signals: pending,
          count: pending.length,
        })
      );
    });

    /**
     * POST /api/executor/mode - Set execution mode (PAPER/LIVE)
     */
    app.post("/api/executor/mode", async (c) => {
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

        service.updateConfig({ mode: body.mode });

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
     * POST /api/executor/toggle - Toggle auto-execution
     */
    app.post("/api/executor/toggle", async (c) => {
      try {
        const body = await c.req.json<{ autoExecute: boolean }>();

        service.updateConfig({ autoExecute: body.autoExecute });

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
     * POST /api/executor/manual - Manually execute a signal (for testing)
     */
    app.post("/api/executor/manual", async (c) => {
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

        const result = await service.manualExecute(signal);

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
  },

  dependencies: {
    nats: true,
    postgres: false,
    clickhouse: false,
  },
});
