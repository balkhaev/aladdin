const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const resolveBase = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimTrailingSlash(trimmed) : undefined;
};

const isDev = process.env.NODE_ENV !== "production";
const isServer = typeof window === "undefined";

// В dev режиме всегда используем gateway на localhost:3000
const defaultApiBaseUrl = resolveBase(
  isDev ? "http://localhost:3000" : "https://gateway.aladdin.balkhaev.com"
);

const rawApiFromEnv = resolveBase(process.env.NEXT_PUBLIC_API_URL);

const rawApiFromProcess =
  isServer && typeof process !== "undefined"
    ? resolveBase(
        process.env.API_BASE_URL ??
          process.env.NEXT_PUBLIC_API_URL ??
          process.env.API_URL ??
          process.env.GATEWAY_URL
      )
    : undefined;

export const API_BASE_URL =
  rawApiFromEnv ?? rawApiFromProcess ?? defaultApiBaseUrl ?? "";

const computeWsFromApi = (apiUrl: string) => {
  if (!apiUrl) {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.origin);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      url.pathname = `${trimTrailingSlash(url.pathname)}/ws`;
      return url.toString();
    }
    return "";
  }

  try {
    const url = new URL(
      apiUrl,
      typeof window !== "undefined" ? window.location.origin : undefined
    );
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = `${trimTrailingSlash(url.pathname)}/ws`;
    return url.toString();
  } catch {
    return apiUrl.replace(
      /^http(s?)/,
      (_match, secure) => `ws${secure ? "s" : ""}`
    );
  }
};

const rawWsFromEnv = resolveBase(process.env.NEXT_PUBLIC_WS_URL);

const rawWsFromProcess =
  isServer && typeof process !== "undefined"
    ? resolveBase(
        process.env.WS_BASE_URL ??
          process.env.NEXT_PUBLIC_WS_URL ??
          process.env.WS_URL
      )
    : undefined;

export const WS_BASE_URL =
  rawWsFromEnv ?? rawWsFromProcess ?? computeWsFromApi(API_BASE_URL);
