import type { PrismaClient } from "@aladdin/database";
import type { Logger } from "@aladdin/logger";

export interface CreateAuditLogParams {
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create audit log entry
 */
export async function createAuditLog(
  prisma: PrismaClient,
  logger: Logger,
  params: CreateAuditLogParams
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        details: params.details ? JSON.stringify(params.details) : null,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });

    logger.info("Audit log created", {
      userId: params.userId,
      action: params.action,
      resource: params.resource,
    });
  } catch (error) {
    // Don't fail the request if audit log fails
    logger.error("Failed to create audit log", error);
  }
}

/**
 * Get audit logs for user
 */
export async function getAuditLogs(
  prisma: PrismaClient,
  userId: string,
  options: {
    resource?: string;
    action?: string;
    limit?: number;
    offset?: number;
  } = {}
) {
  const { resource, action, limit = 50, offset = 0 } = options;

  const where = {
    userId,
    ...(resource && { resource }),
    ...(action && { action }),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs: logs.map((log) => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : null,
    })),
    total,
  };
}
