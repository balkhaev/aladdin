/**
 * OpenTelemetry infrastructure for metrics and tracing
 */

import type { Logger } from "@aladdin/logger";
import {
  type Counter,
  context,
  type Histogram,
  type Meter,
  metrics,
  type Span,
  SpanStatusCode,
  type Tracer,
  trace,
  type UpDownCounter,
} from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { JaegerExporter } from "@opentelemetry/exporter-jaeger";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { NodeSDK } from "@opentelemetry/sdk-node";

// Constants
const DEFAULT_METRICS_PORT = 9464;
const DEFAULT_METRICS_ENDPOINT = "/metrics";
const HTTP_ERROR_THRESHOLD = 400;
const HTTP_STATUS_DEFAULT = 200;

// No-op function for disabled tracing
const noop = () => {
  // Intentionally empty
};

type TelemetryConfig = {
  serviceName: string;
  serviceVersion?: string;
  enableTracing?: boolean;
  enableMetrics?: boolean;
  metricsPort?: number;
  jaegerEndpoint?: string;
  environment?: string;
};

type MetricLabels = Record<string, string | number | boolean>;

/**
 * OpenTelemetry manager for the service
 */
export class TelemetryService {
  private sdk?: NodeSDK;
  private tracer?: Tracer;
  private meter?: Meter;
  private prometheusExporter?: PrometheusExporter;
  private config: Required<TelemetryConfig>;
  private logger?: Logger;

  // Common metrics
  private requestCounter?: Counter;
  private requestDuration?: Histogram;
  private errorCounter?: Counter;
  private activeConnections?: UpDownCounter;

  constructor(config: TelemetryConfig, logger?: Logger) {
    this.config = {
      serviceVersion: "1.0.0",
      enableTracing: true,
      enableMetrics: true,
      metricsPort: DEFAULT_METRICS_PORT,
      jaegerEndpoint:
        process.env.JAEGER_ENDPOINT ?? "http://localhost:14268/api/traces",
      environment: process.env.NODE_ENV ?? "development",
      ...config,
    };
    this.logger = logger;
  }

  /**
   * Initialize OpenTelemetry SDK
   */
  async initialize(): Promise<void> {
    try {
      // Setup Prometheus exporter for metrics
      if (this.config.enableMetrics) {
        this.prometheusExporter = new PrometheusExporter(
          {
            port: this.config.metricsPort,
            endpoint: DEFAULT_METRICS_ENDPOINT,
          },
          () => {
            this.logger?.info(
              `Prometheus metrics exposed on port ${this.config.metricsPort}${DEFAULT_METRICS_ENDPOINT}`
            );
          }
        );
      }

      // Setup Jaeger exporter for tracing
      const traceExporter = this.config.enableTracing
        ? new JaegerExporter({
            endpoint: this.config.jaegerEndpoint,
          })
        : undefined;

      // Initialize SDK with resource attributes
      this.sdk = new NodeSDK({
        serviceName: this.config.serviceName,
        traceExporter,
        metricReader: this.prometheusExporter,
        instrumentations: [
          getNodeAutoInstrumentations({
            "@opentelemetry/instrumentation-fs": {
              enabled: false, // Too noisy
            },
          }),
        ],
      });

      await this.sdk.start();

      // Initialize tracer and meter
      this.tracer = trace.getTracer(
        this.config.serviceName,
        this.config.serviceVersion
      );
      this.meter = metrics.getMeter(
        this.config.serviceName,
        this.config.serviceVersion
      );

      // Create common metrics
      this.initializeCommonMetrics();

      this.logger?.info("OpenTelemetry initialized", {
        service: this.config.serviceName,
        tracing: this.config.enableTracing,
        metrics: this.config.enableMetrics,
      });
    } catch (error) {
      this.logger?.error("Failed to initialize OpenTelemetry", error);
      throw error;
    }
  }

  /**
   * Initialize common metrics used across all services
   */
  private initializeCommonMetrics(): void {
    if (!this.meter) return;

    // HTTP request counter
    this.requestCounter = this.meter.createCounter("http_requests_total", {
      description: "Total number of HTTP requests",
    });

    // HTTP request duration histogram
    this.requestDuration = this.meter.createHistogram(
      "http_request_duration_ms",
      {
        description: "HTTP request duration in milliseconds",
        unit: "ms",
      }
    );

    // Error counter
    this.errorCounter = this.meter.createCounter("errors_total", {
      description: "Total number of errors",
    });

    // Active connections gauge
    this.activeConnections = this.meter.createUpDownCounter(
      "active_connections",
      {
        description: "Number of active connections",
      }
    );
  }

  /**
   * Shutdown OpenTelemetry SDK
   */
  async shutdown(): Promise<void> {
    if (!this.sdk) {
      return;
    }

    try {
      await this.sdk.shutdown();
      this.logger?.info("OpenTelemetry shut down");
    } catch (error) {
      this.logger?.error("Failed to shutdown OpenTelemetry", error);
    }
  }

  /**
   * Start a new span for tracing
   */
  startSpan(
    name: string,
    attributes?: Record<string, string | number | boolean>
  ): Span {
    if (!this.tracer) {
      // Return a no-op span if tracer is not available
      return {
        end: noop,
        setAttribute: noop,
        setStatus: noop,
        recordException: noop,
      } as unknown as Span;
    }

    return this.tracer.startSpan(name, {
      attributes,
    });
  }

  /**
   * Execute function with automatic span tracking
   */
  withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    attributes?: Record<string, string | number | boolean>
  ): Promise<T> {
    if (!this.tracer) {
      // Execute without tracing if tracer is not available
      return fn({
        end: noop,
        setAttribute: noop,
        setStatus: noop,
        recordException: noop,
      } as unknown as Span);
    }

    return this.tracer.startActiveSpan(name, { attributes }, async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : "Unknown error",
        });
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Record HTTP request with metrics
   */
  recordRequest(params: {
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
    labels?: MetricLabels;
  }): void {
    const { method, path, statusCode, durationMs, labels } = params;
    const baseLabels = {
      method,
      path,
      status: statusCode,
      ...labels,
    };

    this.requestCounter?.add(1, baseLabels);
    this.requestDuration?.record(durationMs, baseLabels);

    if (statusCode >= HTTP_ERROR_THRESHOLD) {
      this.errorCounter?.add(1, { ...baseLabels, type: "http_error" });
    }
  }

  /**
   * Record error
   */
  recordError(errorType: string, labels?: MetricLabels): void {
    this.errorCounter?.add(1, {
      type: errorType,
      ...labels,
    });
  }

  /**
   * Increment active connections
   */
  incrementConnections(type = "http"): void {
    this.activeConnections?.add(1, { type });
  }

  /**
   * Decrement active connections
   */
  decrementConnections(type = "http"): void {
    this.activeConnections?.add(-1, { type });
  }

  /**
   * Create a custom counter metric
   */
  createCounter(name: string, description: string): Counter | undefined {
    return this.meter?.createCounter(name, { description });
  }

  /**
   * Create a custom histogram metric
   */
  createHistogram(
    name: string,
    description: string,
    unit?: string
  ): Histogram | undefined {
    return this.meter?.createHistogram(name, { description, unit });
  }

  /**
   * Create a custom up/down counter (gauge)
   */
  createUpDownCounter(
    name: string,
    description: string
  ): UpDownCounter | undefined {
    return this.meter?.createUpDownCounter(name, { description });
  }

  /**
   * Get current context for span propagation
   */
  getCurrentContext() {
    return context.active();
  }

  /**
   * Get tracer instance
   */
  getTracer(): Tracer | undefined {
    return this.tracer;
  }

  /**
   * Get meter instance
   */
  getMeter(): Meter | undefined {
    return this.meter;
  }
}

/**
 * Create Hono middleware for automatic tracing
 */
export function tracingMiddleware(telemetry: TelemetryService) {
  return async (
    c: {
      req: {
        method: string;
        path: string;
        header: (name: string) => string | undefined;
      };
      res?: { status?: number };
    },
    next: () => Promise<void>
  ) => {
    const start = Date.now();
    const method = c.req.method;
    const path = c.req.path;

    telemetry.incrementConnections();

    try {
      await telemetry.withSpan(
        `${method} ${path}`,
        async (span) => {
          span.setAttribute("http.method", method);
          span.setAttribute("http.url", path);
          span.setAttribute(
            "http.user_agent",
            c.req.header("user-agent") ?? "unknown"
          );

          await next();

          const status = c.res?.status ?? HTTP_STATUS_DEFAULT;
          span.setAttribute("http.status_code", status);
        },
        {
          "http.method": method,
          "http.target": path,
        }
      );
    } finally {
      const duration = Date.now() - start;
      const status = c.res?.status ?? HTTP_STATUS_DEFAULT;

      telemetry.recordRequest({
        method,
        path,
        statusCode: status,
        durationMs: duration,
      });
      telemetry.decrementConnections();
    }
  };
}

/**
 * Create Hono middleware for metrics only (no tracing)
 */
export function metricsMiddleware(telemetry: TelemetryService) {
  return async (
    c: { req: { method: string; path: string }; res?: { status?: number } },
    next: () => Promise<void>
  ) => {
    const start = Date.now();
    const method = c.req.method;
    const path = c.req.path;

    telemetry.incrementConnections();

    try {
      await next();
    } finally {
      const duration = Date.now() - start;
      const status = c.res?.status ?? HTTP_STATUS_DEFAULT;

      telemetry.recordRequest({
        method,
        path,
        statusCode: status,
        durationMs: duration,
      });
      telemetry.decrementConnections();
    }
  };
}

// Export OpenTelemetry API types for direct usage
export type {
  Counter,
  Histogram,
  Meter,
  Span,
  Tracer,
  UpDownCounter,
} from "@opentelemetry/api";
