import { resolve, join } from "node:path";

const port = Number(process.env.PORT ?? "3001");
const host = process.env.HOST ?? "0.0.0.0";
const distRoot = resolve(import.meta.dir, "dist");

const HEALTH_PATH = "/health";

function buildFilePath(pathname: string): string | null {
  const sanitized = pathname === "/" ? "index.html" : pathname.slice(1);
  const fullPath = resolve(distRoot, sanitized);
  if (!fullPath.startsWith(distRoot)) {
    return null;
  }
  return fullPath;
}

function assetHeaders(pathname: string): HeadersInit | undefined {
  if (pathname.startsWith("/assets/")) {
    return { "Cache-Control": "public, max-age=31536000, immutable" };
  }
  return undefined;
}

const server = Bun.serve({
  port,
  hostname: host,
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === HEALTH_PATH) {
      return new Response("ok", { status: 200 });
    }

    const filePath = buildFilePath(url.pathname);

    if (filePath) {
      const file = Bun.file(filePath);
      if (await file.exists()) {
        return new Response(file, {
          headers: assetHeaders(url.pathname),
        });
      }
    }

    const fallback = Bun.file(join(distRoot, "index.html"));
    if (await fallback.exists()) {
      return new Response(fallback, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`▪︎ Web UI listening on http://${server.hostname}:${server.port}`);
