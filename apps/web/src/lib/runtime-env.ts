const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const runtimeOrigin =
  typeof window !== "undefined" ? trimTrailingSlash(window.location.origin) : undefined;

const rawApiFromEnv = import.meta.env.VITE_API_URL?.trim();
const apiBaseFromEnv = rawApiFromEnv?.length ? trimTrailingSlash(rawApiFromEnv) : undefined;

const apiBaseFallback = runtimeOrigin ?? "http://localhost:3000";

export const API_BASE_URL = apiBaseFromEnv ?? apiBaseFallback;

const rawWsFromEnv = import.meta.env.VITE_WS_URL?.trim();

const computeWsFromApi = (apiUrl: string) => {
  try {
    const url = new URL(apiUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = `${trimTrailingSlash(url.pathname)}/ws`;
    return url.toString();
  } catch {
    return apiUrl.replace(/^http(s?)/, (_match, secure) => `ws${secure ? "s" : ""}`);
  }
};

export const WS_BASE_URL = rawWsFromEnv?.length
  ? rawWsFromEnv
  : computeWsFromApi(API_BASE_URL);
