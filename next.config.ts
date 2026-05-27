import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 動画ファイルの大きなリクエストボディを許可
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
  },
};

export default nextConfig;
