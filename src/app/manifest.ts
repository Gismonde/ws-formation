import type { MetadataRoute } from 'next'

// Application installable (tablettes) : écran d'accueil, plein écran, hors ligne.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'WS Formation',
    short_name: 'WS Formation',
    description: 'Plateforme de formation — CMC et WSSC',
    start_url: '/dashboard/accueil',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1e3a6e',
    lang: 'fr-CA',
    icons: [
      { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  }
}
