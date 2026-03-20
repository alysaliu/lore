/** @type {import('next').NextConfig} */
// For GitHub Pages project site (e.g. lore-2026.github.io/lore/), set BASE_PATH=/lore in the deploy workflow
const basePath = process.env.BASE_PATH || '';
const nextConfig = {
  ...(basePath && { basePath, assetPrefix: basePath + '/' }),
  output: 'export',
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'image.tmdb.org', pathname: '/**' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com', pathname: '/**' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com', pathname: '/**' },
    ],
  },
};

module.exports = nextConfig;
