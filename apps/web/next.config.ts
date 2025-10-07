import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const baseUrl = isDev ? "http://localhost:3000" : process.env.API_BASE_URL;
const wsUrl = isDev ? "http://localhost:3000" : process.env.WS_BASE_URL;

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${baseUrl}/api/:path*`,
      },
      {
        source: "/ws/:path*",
        destination: `${wsUrl}/ws/:path*`,
      },
    ];
  },
  experimental: {
    optimizePackageImports: ["@radix-ui/react-icons", "lucide-react"],
  },
  // typescript: {
  //   ignoreBuildErrors: true,
  // },
};

export default nextConfig;
