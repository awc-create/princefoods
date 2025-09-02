/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: true,
  images: {
    remotePatterns: [
      // Wix
      { protocol: 'https', hostname: 'static.wixstatic.com', pathname: '/**' },
      { protocol: 'https', hostname: 'images.wixstatic.com', pathname: '/**' },

      // Google Drive direct view endpoints (if you actually serve images from there)
      { protocol: 'https', hostname: 'drive.google.com', pathname: '/**' },

      // Google Photos / user content CDNs
      { protocol: 'https', hostname: 'lh3.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'lh4.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'lh5.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'lh6.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'ssl.gstatic.com', pathname: '/**' },

      // Add any other CDNs you use explicitly
      // { protocol: 'https', hostname: 'cdn.example.com', pathname: '/**' },
    ],
  },
};

module.exports = nextConfig;
