/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
    serverActions: true
  },
  typescript: {
    ignoreBuildErrors: false
  }
}

module.exports = nextConfig
