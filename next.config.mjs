// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverActions: { bodySizeLimit: '2mb' } },
  webpack(config, { dev }) {
    if (dev) {
      // Use in-memory cache in dev to avoid ENOENT rename issues
      config.cache = { type: 'memory' }
    }
    return config
  },
}
export default nextConfig
