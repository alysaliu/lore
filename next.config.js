/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
    domains: ['image.tmdb.org', 'firebasestorage.googleapis.com'],
  },
  // If your site is at https://<user>.github.io/<repo>/, set basePath to `'/<repo>'`
  // basePath: process.env.BASE_PATH || '',
};

module.exports = nextConfig;
