import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'optim-images.krea.ai',
      },
    ],
  },
};

export default nextConfig;
