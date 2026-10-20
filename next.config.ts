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

// En-têtes de sécurité appliqués à toutes les pages et API
const enTetesSecurite = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },                 // aucun autre site ne peut afficher la plateforme dans un iframe (clickjacking)
  { key: 'X-Content-Type-Options', value: 'nosniff' },             // le navigateur respecte le type des fichiers
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }, // HTTPS obligatoire
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
]

const nextConfig: NextConfig = {
      poweredByHeader: false,
      async headers() {
              return [{ source: '/:path*', headers: enTetesSecurite }]
      },
      eslint: {
              ignoreDuringBuilds: true,
      },
}

export default nextConfig
