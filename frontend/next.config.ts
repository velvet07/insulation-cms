import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Production optimizations (only in production)
  ...(process.env.NODE_ENV === 'production' && {
    output: 'standalone', // For better Docker/PM2 compatibility
  }),
  compress: true,
  poweredByHeader: false,
  
  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
