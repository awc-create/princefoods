// site/next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  trailingSlash: false,
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
      { protocol: 'https', hostname: 'scontent.cdninstagram.com', pathname: '/**' },
      { protocol: 'https', hostname: 'prince-foods-media.hel1.your-objectstorage.com' }
    ]
  },

  outputFileTracingIncludes: {
    '/**/*': ['./node_modules/bcryptjs/**']
  },

  // Baseline security headers. These are the ones that cannot break a working
  // site — no Content-Security-Policy here on purpose: this site loads Crisp,
  // Stripe, Instagram and Google-hosted images, so a CSP needs to be written
  // against the real pages and tested, or it will silently break them.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Stop the browser guessing content types (MIME-sniffing XSS).
          { key: 'X-Content-Type-Options', value: 'nosniff' },

          // Clickjacking. SAMEORIGIN rather than DENY so our own embeds still work.
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },

          // Don't leak full admin/order URLs to third parties via Referer.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },

          // Nothing here needs these devices.
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
          },

          // HTTPS only. Traefik already terminates TLS for every host.
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains'
          }
        ]
      },
      {
        // Admin and account pages must never be cached by a shared proxy.
        source: '/:path(admin|account)/:rest*',
        headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }]
      }
    ];
  }
};

module.exports = nextConfig;
