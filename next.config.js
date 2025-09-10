// site/next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // <- required to emit .next/standalone
  reactStrictMode: true,
  trailingSlash: true,
  eslint: { ignoreDuringBuilds: true },

  images: {
    unoptimized: true, // works well behind a reverse-proxy/CDN
    remotePatterns: [
      { protocol: 'https', hostname: 'utfs.io', pathname: '/**' },
      { protocol: 'https', hostname: 'static.wixstatic.com', pathname: '/**' },
      { protocol: 'https', hostname: 'images.wixstatic.com', pathname: '/**' },
      { protocol: 'https', hostname: 'drive.google.com', pathname: '/**' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'lh4.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'lh5.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'lh6.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'ssl.gstatic.com', pathname: '/**' }
    ]
  },

  // make sure native/optional deps get traced into the standalone build
  outputFileTracingIncludes: {
    '/**/*': ['./node_modules/bcryptjs/**']
  }
};

module.exports = nextConfig;
