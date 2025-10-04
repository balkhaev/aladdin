import { BaseService } from "@aladdin/shared/base-service";
import type { ServiceDependencies } from "@aladdin/shared/service-bootstrap";

/**
 * Social Integrations Service
 * Combines Telegram (telega) and Twitter (twity) integrations
 */
export class SocialIntegrationsService extends BaseService {
  constructor(deps: ServiceDependencies) {
    super({
      serviceName: "social-integrations",
      logger: deps.logger,
      natsClient: deps.natsClient,
      clickhouseClient: deps.clickhouse,
      prisma: deps.prisma,
    });
  }

  async initialize(): Promise<void> {
    await super.initialize();
    this.logger.info("Social Integrations Service initialized");
    // Future: Initialize telega and twity services here
  }

  async shutdown(): Promise<void> {
    this.logger.info("Shutting down Social Integrations Service");
    await super.shutdown();
  }
}

