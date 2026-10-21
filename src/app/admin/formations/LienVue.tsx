'use client'
// Lien « Liste / Vue détaillée » qui mémorise le choix (cookie, un an) pour les prochaines visites.
import Link from 'next/link'

export default function LienVue({ href, vue, children, style, actif }: { href: string; vue: 'liste' | 'cartes'; children: React.ReactNode; style: React.CSSProperties; actif: boolean }) {
  return (
    <Link href={href} style={style} aria-current={actif ? 'page' : undefined}
      onClick={() => { document.cookie = `ws_vue_formations=${vue}; path=/admin; max-age=31536000; samesite=lax` }}>
      {children}
    </Link>
  )
}
