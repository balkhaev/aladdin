import { type BetterAuthOptions, betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "../db";

const resolveCookieDomain = () => {
  if (process.env.BETTER_AUTH_COOKIE_DOMAIN) {
    return process.env.BETTER_AUTH_COOKIE_DOMAIN;
  }

  const origin = process.env.CORS_ORIGIN;
  if (!origin) {
    return undefined;
  }

  try {
    const host = new URL(origin).hostname;
    const isLoopback = host === "localhost" || host === "127.0.0.1";
    const isIpAddress = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);

    if (isLoopback || isIpAddress) {
      return undefined;
    }

    return host;
  } catch {
    return undefined;
  }
};

const cookieDomain = resolveCookieDomain();

export const auth = betterAuth<BetterAuthOptions>({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  trustedOrigins: [process.env.CORS_ORIGIN || "http://localhost:3001"],
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "user",
        input: false,
      },
    },
  },
  advanced: {
    defaultCookieAttributes: {
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    },
    crossSubDomainCookies: cookieDomain
      ? {
          enabled: true,
          domain: cookieDomain,
        }
      : {
          enabled: false,
        },
  },
});
