/**
 * Example 3: Service with Caching
 *
 * This example shows how to use Redis caching with the simplified cache API.
 */

import { createSuccessResponse } from "@aladdin/http/responses";
import { BaseService, initializeService } from "@aladdin/service";
import type { Hono } from "hono";

class ProductService extends BaseService {
  getServiceName(): string {
    return "product-service";
  }

  // Expensive operation that benefits from caching
  async getProductDetails(id: string) {
    // Try to get from cache first
    const cached = await this.cache.get(`product:${id}`);
    if (cached) {
      this.logger.debug("Cache hit", { productId: id });
      return cached;
    }

    // Simulate expensive database/API call
    this.logger.debug("Cache miss, fetching from database", { productId: id });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const product = {
      id,
      name: `Product ${id}`,
      price: Math.floor(Math.random() * 1000),
      inStock: Math.random() > 0.5,
      lastUpdated: new Date().toISOString(),
    };

    // Store in cache for 5 minutes
    await this.cache.set(`product:${id}`, product, 300);

    return product;
  }

  async listProducts() {
    const cacheKey = "products:list";

    // Check cache
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Simulate database query
    const products = Array.from({ length: 10 }, (_, i) => ({
      id: `prod-${i + 1}`,
      name: `Product ${i + 1}`,
      price: Math.floor(Math.random() * 1000),
    }));

    // Cache for 2 minutes
    await this.cache.set(cacheKey, products, 120);

    return products;
  }

  async invalidateProduct(id: string) {
    await this.cache.delete(`product:${id}`);
    this.logger.info("Product cache invalidated", { productId: id });
  }
}

await initializeService({
  serviceName: "product-service",
  port: 3022,

  createService: (deps) =>
    new ProductService({
      ...deps,
      enableCache: true, // Enable Redis cache
      enableServiceClient: false,
    }),

  setupRoutes: (app: Hono, service: ProductService) => {
    // GET /api/products - List all products (cached)
    app.get("/api/products", async (c) => {
      const products = await service.listProducts();

      return c.json(
        createSuccessResponse({
          products,
          cached: true,
        })
      );
    });

    // GET /api/products/:id - Get product (cached)
    app.get("/api/products/:id", async (c) => {
      const { id } = c.req.param();
      const product = await service.getProductDetails(id);

      return c.json(createSuccessResponse(product));
    });

    // DELETE /api/products/:id/cache - Invalidate cache
    app.delete("/api/products/:id/cache", async (c) => {
      const { id } = c.req.param();
      await service.invalidateProduct(id);

      return c.json(
        createSuccessResponse({
          message: "Cache invalidated",
          productId: id,
        })
      );
    });

    // GET /api/cache/stats - Get cache statistics
    app.get("/api/cache/stats", async (c) => {
      const stats = await service.cache.getStats();

      return c.json(createSuccessResponse(stats));
    });
  },

  dependencies: {
    postgres: false,
    nats: false,
    clickhouse: false,
  },
});
