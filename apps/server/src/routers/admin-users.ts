import type { Logger } from "@aladdin/logger";
import type { PrismaClient } from "@repo/database";
import { Hono } from "hono";

type AdminUsersRouterConfig = {
  prisma: PrismaClient;
  logger: Logger;
};

export function createAdminUsersRouter(config: AdminUsersRouterConfig) {
  const { prisma, logger } = config;
  const app = new Hono();

  /**
   * GET /api/admin/users
   * Получить список всех пользователей
   */
  app.get("/", async (c) => {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          role: true,
          image: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              portfolios: true,
              orders: true,
              exchangeCredentials: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      logger.info("Retrieved users list", {
        count: users.length,
      });

      return c.json({
        success: true,
        data: users,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error("Failed to retrieve users", {
        error: error instanceof Error ? error.message : String(error),
      });

      return c.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to retrieve users",
          },
          timestamp: Date.now(),
        },
        500
      );
    }
  });

  /**
   * GET /api/admin/users/:userId
   * Получить детальную информацию о пользователе
   */
  app.get("/:userId", async (c) => {
    try {
      const userId = c.req.param("userId");

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          _count: {
            select: {
              portfolios: true,
              orders: true,
              exchangeCredentials: true,
              sessions: true,
              auditLogs: true,
            },
          },
          portfolios: {
            select: {
              id: true,
              name: true,
              balance: true,
              currency: true,
              createdAt: true,
            },
          },
          exchangeCredentials: {
            select: {
              id: true,
              exchange: true,
              label: true,
              testnet: true,
              isActive: true,
              createdAt: true,
            },
          },
        },
      });

      if (!user) {
        return c.json(
          {
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "User not found",
            },
            timestamp: Date.now(),
          },
          404
        );
      }

      logger.info("Retrieved user details", {
        userId,
      });

      return c.json({
        success: true,
        data: user,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error("Failed to retrieve user", {
        error: error instanceof Error ? error.message : String(error),
      });

      return c.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to retrieve user",
          },
          timestamp: Date.now(),
        },
        500
      );
    }
  });

  /**
   * PATCH /api/admin/users/:userId/role
   * Изменить роль пользователя
   */
  app.patch("/:userId/role", async (c) => {
    try {
      const userId = c.req.param("userId");
      const body = await c.req.json();
      const { role } = body;

      // Валидация роли
      const validRoles = ["user", "admin"];
      const isValidRole = role && validRoles.includes(role);

      if (!isValidRole) {
        return c.json(
          {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid role. Must be 'user' or 'admin'",
            },
            timestamp: Date.now(),
          },
          400
        );
      }

      // Проверяем существование пользователя
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!existingUser) {
        return c.json(
          {
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "User not found",
            },
            timestamp: Date.now(),
          },
          404
        );
      }

      // Обновляем роль
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { role },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          updatedAt: true,
        },
      });

      // Логируем изменение
      const adminUser = c.get("user") as { id: string };
      await prisma.auditLog.create({
        data: {
          userId: adminUser.id,
          action: "UPDATE",
          resource: "user",
          resourceId: userId,
          details: JSON.stringify({
            oldRole: existingUser.role,
            newRole: role,
          }),
        },
      });

      logger.info("Updated user role", {
        userId,
        oldRole: existingUser.role,
        newRole: role,
        adminId: adminUser.id,
      });

      return c.json({
        success: true,
        data: updatedUser,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error("Failed to update user role", {
        error: error instanceof Error ? error.message : String(error),
      });

      return c.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to update user role",
          },
          timestamp: Date.now(),
        },
        500
      );
    }
  });

  /**
   * DELETE /api/admin/users/:userId
   * Удалить пользователя
   */
  app.delete("/:userId", async (c) => {
    try {
      const userId = c.req.param("userId");
      const adminUser = c.get("user") as { id: string };

      // Проверяем, что admin не пытается удалить самого себя
      if (userId === adminUser.id) {
        return c.json(
          {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "You cannot delete your own account",
            },
            timestamp: Date.now(),
          },
          400
        );
      }

      // Проверяем существование пользователя
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          role: true,
        },
      });

      if (!existingUser) {
        return c.json(
          {
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "User not found",
            },
            timestamp: Date.now(),
          },
          404
        );
      }

      // Удаляем пользователя (cascade delete удалит связанные данные)
      await prisma.user.delete({
        where: { id: userId },
      });

      logger.info("Deleted user", {
        userId,
        userEmail: existingUser.email,
        adminId: adminUser.id,
      });

      return c.json({
        success: true,
        data: {
          id: userId,
          deleted: true,
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error("Failed to delete user", {
        error: error instanceof Error ? error.message : String(error),
      });

      return c.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to delete user",
          },
          timestamp: Date.now(),
        },
        500
      );
    }
  });

  return app;
}
