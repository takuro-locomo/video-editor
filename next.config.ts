import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 動画ファイルの大きなリクエストボディを許可
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
  },
  // 同じWi-Fi内のスマホ等からの開発アクセスを許可（LAN IP）
  allowedDevOrigins: ['192.168.10.1', '192.168.10.*'],
};

export default nextConfig;
