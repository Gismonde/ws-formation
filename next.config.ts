/*
 * Copyright © 2026 Gismonde Gnanhoue
 * All Rights Reserved
 *
 * WS Formation — Plateforme de formation professionnelle
 * Unauthorized copying, modification, distribution, or use of this software,
 * via any medium, is strictly prohibited without the prior written permission
 * of the copyright owner.
 */

import type { NextConfig } from 'next'
const webpack = require('webpack')

// Loi 25 compliance build — 2026-05-29T23:04:45.303Z
const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack(config: any) {
    config.plugins.push(
      new webpack.BannerPlugin({
        banner: `Copyright © 2026 Gismonde Gnanhoue — All Rights Reserved`,
        raw: false,
      })
    )
    return config
  },
}

export default nextConfig
