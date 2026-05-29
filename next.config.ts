import type { NextConfig } from 'next'

// Loi 25 compliance build - 2026-05-29T23:04:45.303Z
const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
