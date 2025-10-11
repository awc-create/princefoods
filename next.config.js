// site/next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  trailingSlash: true,
  eslint: { ignoreDuringBuilds: true },

  images: {
    unoptimized: true,
    remotePatterns: [
      // UploadThing / utfs
      { protocol: 'https', hostname: 'utfs.io', pathname: '/**' },
      { protocol: 'https', hostname: '**.uploadthing.com', pathname: '/**' },

      // Existing allowlist (use ** not * for wildcards)
      { protocol: 'https', hostname: 'static.wixstatic.com', pathname: '/**' },
      { protocol: 'https', hostname: 'images.wixstatic.com', pathname: '/**' },
      { protocol: 'https', hostname: 'drive.google.com', pathname: '/**' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'lh4.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'lh5.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'lh6.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'ssl.gstatic.com', pathname: '/**' },
      { protocol: 'https', hostname: '**.cdninstagram.com', pathname: '/**' },
      { protocol: 'https', hostname: '**.fbcdn.net', pathname: '/**' },
      { protocol: 'https', hostname: 'scontent.cdninstagram.com', pathname: '/**' }
    ]
  },

  outputFileTracingIncludes: {
    '/**/*': ['./node_modules/bcryptjs/**']
  }
};

module.exports = nextConfig;
