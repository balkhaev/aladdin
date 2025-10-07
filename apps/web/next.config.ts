import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const baseUrl = isDev
  ? "http://localhost:3000"
  : "https://gateway.aladdin.balkhaev.com";
const wsUrl = isDev
  ? "ws://localhost:3000"
  : "ws://gateway.aladdin.balkhaev.com";

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
