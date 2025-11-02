/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['open.feishu.cn', 'i.ytimg.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.feishu.cn',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
}

module.exports = nextConfig
