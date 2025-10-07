/**
 * Logger utility
 * Development-only logging with typed levels
 * Automatically disabled in production
 */

type LogLevel = "info" | "warn" | "error" | "debug";

const isDevelopment = process.env.NODE_ENV === "development";

function log(level: LogLevel, prefix: string, ...args: unknown[]): void {
  if (!isDevelopment) return;

  const timestamp = new Date().toISOString();
  const formattedPrefix = `[${timestamp}] [${prefix}]`;

  if (level === "error") {
    console.error(formattedPrefix, ...args);
    return;
  }

  if (level === "warn") {
    console.warn(formattedPrefix, ...args);
    return;
  }

  if (level === "debug") {
    console.debug(formattedPrefix, ...args);
    return;
  }

  console.log(formattedPrefix, ...args);
}

export const logger = {
  info: (prefix: string, ...args: unknown[]) => log("info", prefix, ...args),
  warn: (prefix: string, ...args: unknown[]) => log("warn", prefix, ...args),
  error: (prefix: string, ...args: unknown[]) => log("error", prefix, ...args),
  debug: (prefix: string, ...args: unknown[]) => log("debug", prefix, ...args),
};
