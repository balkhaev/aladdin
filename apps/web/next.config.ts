import type { NextConfig } from "next";

import { API_BASE_URL, WS_BASE_URL } from "./lib/runtime-env";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_BASE_URL}/api/:path*`,
      },
      {
        source: "/ws/:path*",
        destination: `${WS_BASE_URL}/ws/:path*`,
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
