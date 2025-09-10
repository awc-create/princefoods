// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 👇 Required so Dockerfile can run `node server.js` from .next/standalone
  output: 'standalone',

  reactStrictMode: true,
  trailingSlash: true,

  // Keep builds green in CI (lint still runs in the pipeline step)
  eslint: { ignoreDuringBuilds: true },

  // If you’re not using Next’s image optimizer (common behind Traefik/CDN)
  images: {
    unoptimized: true,
    remotePatterns: [
      // utfs.io (UploadThing CDN)
      { protocol: 'https', hostname: 'utfs.io', pathname: '/**' },

      // Wix
      { protocol: 'https', hostname: 'static.wixstatic.com', pathname: '/**' },
      { protocol: 'https', hostname: 'images.wixstatic.com', pathname: '/**' },

      // Google Drive / Photos
      { protocol: 'https', hostname: 'drive.google.com', pathname: '/**' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'lh4.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'lh5.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'lh6.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'ssl.gstatic.com', pathname: '/**' }
    ]
  },

  // Ensure certain modules are copied into .next/standalone
  // (Keep if you actually use bcryptjs; otherwise you can remove)
  outputFileTracingIncludes: {
    '/**/*': ['./node_modules/bcryptjs/**']
  }
};

export default nextConfig;
