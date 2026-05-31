/*
 * Copyright © 2026 Gismonde Gnanhoue
 * All Rights Reserved
 *
 * WS Formation – Plateforme de formation professionnelle
 * Unauthorized copying, modification, distribution, or use of this software,
 * via any medium, is strictly prohibited without the prior written permission
 * of the copyright owner.
 */

import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
      typescript: {
              ignoreBuildErrors: true,
      },
      eslint: {
              ignoreDuringBuilds: true,
      },
}

export default nextConfig
