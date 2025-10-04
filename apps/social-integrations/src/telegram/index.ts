import { initializeService } from "@aladdin/shared/service-bootstrap";
import type { Context } from "hono";
import {
  activateSubscription,
  subscribeToChannel as addChannelSubscription,
  deactivateSubscription,
  getActiveSubscriptions,
  getAllSubscriptions,
  isSubscribed,
  unsubscribeFromChannel as removeChannelSubscription,
} from "./channel-subscriptions";
import { TelegaService } from "./service";
import { getChannelMessages } from "./telegram";
import {
  getSubscribedChannels,
  subscribeToChannel,
  unsubscribeFromChannel,
} from "./userbot";

const DEFAULT_PORT = 3005;
const DEFAULT_LIMIT = 10;
const MAX_MESSAGES_LIMIT = 100;
const BAD_REQUEST_STATUS_CODE = 400;
const ERROR_STATUS_CODE = 500;

await initializeService<TelegaService>({
  serviceName: "telega",
  port: process.env.PORT ? Number.parseInt(process.env.PORT, 10) : DEFAULT_PORT,

  // Telega использует NATS и Redis
  dependencies: {
    postgres: false,
    nats: true,
    clickhouse: false,
  },

  createService: (deps) => new TelegaService(deps),

  afterInit: (_service, deps) => {
    deps.logger.info("Telega service fully initialized");
  },

  setupRoutes: (app, service, deps) => {
    // GET /status - детальный статус сервиса
    app.get("/status", (c: Context) => {
      const userbotStatus = service.getUserbotStatus();
      const connectionInfo = service.getConnectionInfo();

      return c.json({
        server: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          timestamp: new Date().toISOString(),
        },
        telegram: {
          connected: connectionInfo.connected,
          isConnecting: connectionInfo.isConnecting,
          hasClient: connectionInfo.hasClient,
        },
        userbot: {
          running: userbotStatus.running,
          subscribedChannels: userbotStatus.subscribedChannels,
        },
        environment: {
          nodeEnv: process.env.NODE_ENV,
        },
      });
    });

    // POST /channels/subscribe - подписаться на канал
    app.post("/channels/subscribe", async (c: Context) => {
      try {
        const body = await c.req.json();
        const channelId = body.channelId as string;

        if (!channelId) {
          return c.json(
            { error: "channelId is required" },
            BAD_REQUEST_STATUS_CODE
          );
        }

        // Проверяем, не подписаны ли уже
        const alreadySubscribed = await isSubscribed(channelId);
        if (alreadySubscribed) {
          return c.json({ message: "Already subscribed", channelId });
        }

        // Добавляем в Redis
        const subscription = await addChannelSubscription(channelId);

        // Подписываемся в Telegram
        await subscribeToChannel(channelId);

        deps.logger.info("Subscribed to channel via API", { channelId });

        return c.json({
          message: "Successfully subscribed",
          subscription,
        });
      } catch (error) {
        deps.logger.error("Error subscribing to channel", error);
        return c.json(
          { error: "Failed to subscribe to channel" },
          ERROR_STATUS_CODE
        );
      }
    });

    // POST /channels/unsubscribe - отписаться от канала
    app.post("/channels/unsubscribe", async (c: Context) => {
      try {
        const body = await c.req.json();
        const channelId = body.channelId as string;

        if (!channelId) {
          return c.json(
            { error: "channelId is required" },
            BAD_REQUEST_STATUS_CODE
          );
        }

        // Отписываемся в Telegram
        try {
          unsubscribeFromChannel(channelId);
        } catch (err) {
          deps.logger.warn("Error unsubscribing from Telegram channel", {
            error: err instanceof Error ? err.message : String(err),
          });
        }

        // Удаляем из Redis
        const removed = await removeChannelSubscription(channelId);

        if (!removed) {
          return c.json(
            { error: "Channel subscription not found" },
            BAD_REQUEST_STATUS_CODE
          );
        }

        deps.logger.info("Unsubscribed from channel via API", { channelId });

        return c.json({
          message: "Successfully unsubscribed",
          channelId,
        });
      } catch (error) {
        deps.logger.error("Error unsubscribing from channel", error);
        return c.json(
          { error: "Failed to unsubscribe from channel" },
          ERROR_STATUS_CODE
        );
      }
    });

    // GET /channels - получить список всех подписок
    app.get("/channels", async (c: Context) => {
      try {
        const subscriptions = await getAllSubscriptions();
        const activeChannels = getSubscribedChannels();

        return c.json({
          subscriptions,
          activeChannels,
          total: subscriptions.length,
          active: activeChannels.length,
        });
      } catch (error) {
        deps.logger.error("Error fetching channels", error);
        return c.json({ error: "Failed to fetch channels" }, ERROR_STATUS_CODE);
      }
    });

    // POST /channels/:channelId/activate - активировать подписку
    app.post("/channels/:channelId/activate", async (c: Context) => {
      try {
        const channelId = c.req.param("channelId");

        const activated = await activateSubscription(channelId);

        if (!activated) {
          return c.json(
            { error: "Channel subscription not found" },
            BAD_REQUEST_STATUS_CODE
          );
        }

        // Подписываемся в Telegram
        await subscribeToChannel(channelId);

        return c.json({
          message: "Channel subscription activated",
          channelId,
        });
      } catch (error) {
        deps.logger.error("Error activating channel", error);
        return c.json(
          { error: "Failed to activate channel" },
          ERROR_STATUS_CODE
        );
      }
    });

    // POST /channels/:channelId/deactivate - деактивировать подписку
    app.post("/channels/:channelId/deactivate", async (c: Context) => {
      try {
        const channelId = c.req.param("channelId");

        const deactivated = await deactivateSubscription(channelId);

        if (!deactivated) {
          return c.json(
            { error: "Channel subscription not found" },
            BAD_REQUEST_STATUS_CODE
          );
        }

        // Отписываемся в Telegram
        try {
          unsubscribeFromChannel(channelId);
        } catch (err) {
          deps.logger.warn("Error unsubscribing from Telegram", {
            error: err instanceof Error ? err.message : String(err),
          });
        }

        return c.json({
          message: "Channel subscription deactivated",
          channelId,
        });
      } catch (error) {
        deps.logger.error("Error deactivating channel", error);
        return c.json(
          { error: "Failed to deactivate channel" },
          ERROR_STATUS_CODE
        );
      }
    });

    // GET /channels/:channelId/messages - получить последние N сообщений из конкретного канала
    app.get("/channels/:channelId/messages", async (c: Context) => {
      try {
        const channelId = c.req.param("channelId");
        const limitParam = Number.parseInt(
          (c.req.query("limit") as string) || String(DEFAULT_LIMIT),
          10
        );
        const limit = Number.isNaN(limitParam)
          ? DEFAULT_LIMIT
          : Math.min(limitParam, MAX_MESSAGES_LIMIT);

        // Проверяем подписку на канал
        const subscribed = await isSubscribed(channelId);
        if (!subscribed) {
          return c.json(
            {
              error: "Not subscribed to this channel",
              channelId,
              hint: "Use POST /channels/subscribe to subscribe first",
            },
            BAD_REQUEST_STATUS_CODE
          );
        }

        const messages = await getChannelMessages(channelId, limit);
        return c.json({
          channelId,
          limit,
          count: messages.length,
          messages,
        });
      } catch (error) {
        deps.logger.error("Error fetching channel messages", error);
        return c.json(
          { error: "Failed to fetch messages from channel" },
          ERROR_STATUS_CODE
        );
      }
    });

    // GET /channels/messages/recent - получить последние сообщения из всех подписанных каналов
    app.get("/channels/messages/recent", async (c: Context) => {
      try {
        const limitParam = Number.parseInt(
          (c.req.query("limit") as string) || String(DEFAULT_LIMIT),
          10
        );
        const limitPerChannel = Number.isNaN(limitParam)
          ? DEFAULT_LIMIT
          : Math.min(limitParam, MAX_MESSAGES_LIMIT);

        const subscriptions = await getActiveSubscriptions();

        if (subscriptions.length === 0) {
          return c.json({
            channels: [],
            total: 0,
            message: "No active subscriptions",
          });
        }

        type ChannelMessagesResult = {
          channelId: string;
          count: number;
          messages: unknown[];
        };

        const channelMessages = await Promise.allSettled(
          subscriptions.map(async (sub) => {
            const messages = await getChannelMessages(
              sub.channelId,
              limitPerChannel
            );
            return {
              channelId: sub.channelId,
              count: messages.length,
              messages,
            } as ChannelMessagesResult;
          })
        );

        const results = channelMessages
          .filter(
            (result): result is PromiseFulfilledResult<ChannelMessagesResult> =>
              result.status === "fulfilled"
          )
          .map((result) => result.value);

        const errors = channelMessages
          .filter(
            (result): result is PromiseRejectedResult =>
              result.status === "rejected"
          )
          .map((result) => result.reason?.message as string);

        if (errors.length > 0) {
          deps.logger.warn("Some channels failed to fetch messages", {
            errors,
          });
        }

        return c.json({
          channels: results,
          total: results.length,
          limitPerChannel,
          errors: errors.length > 0 ? errors : undefined,
        });
      } catch (error) {
        deps.logger.error("Error fetching recent messages", error);
        return c.json(
          { error: "Failed to fetch recent messages" },
          ERROR_STATUS_CODE
        );
      }
    });
  },
});
