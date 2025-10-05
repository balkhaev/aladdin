/**
 * Logger utility
 * Development-only logging with typed levels
 * Automatically disabled in production
 */

type LogLevel = "info" | "warn" | "error" | "debug";

const isDevelopment = import.meta.env.DEV;

function log(level: LogLevel, prefix: string, ...args: unknown[]): void {
  if (!isDevelopment) return;

  const timestamp = new Date().toISOString();
  const formattedPrefix = `[${timestamp}] [${prefix}]`;

  switch (level) {
    case "error":
      // biome-ignore lint/suspicious/noConsole: Development-only logging
      console.error(formattedPrefix, ...args);
      break;
    case "warn":
      // biome-ignore lint/suspicious/noConsole: Development-only logging
      console.warn(formattedPrefix, ...args);
      break;
    case "debug":
      // biome-ignore lint/suspicious/noConsole: Development-only logging
      console.debug(formattedPrefix, ...args);
      break;
    case "info":
    default:
      // biome-ignore lint/suspicious/noConsole: Development-only logging
      console.log(formattedPrefix, ...args);
      break;
  }
}

export const logger = {
  info: (prefix: string, ...args: unknown[]) => log("info", prefix, ...args),
  warn: (prefix: string, ...args: unknown[]) => log("warn", prefix, ...args),
  error: (prefix: string, ...args: unknown[]) => log("error", prefix, ...args),
  debug: (prefix: string, ...args: unknown[]) => log("debug", prefix, ...args),
};

