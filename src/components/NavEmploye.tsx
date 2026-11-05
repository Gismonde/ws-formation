'use client'
// Menu latéral (5 entrées) et onglets du groupe actif, pour le portail employé.
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useT } from '@/lib/i18n/client'
import { MENU_EMPLOYE, groupeActif, correspond } from '@/lib/menu-employe'
import IconeMenu from './IconeMenu'

export type Compteurs = Record<string, number>

const Pastille = ({ n, couleur }: { n: number; couleur: string }) =>
  n > 0 ? <span style={{ marginLeft: 'auto', background: couleur, color: '#fff', fontSize: '11px', fontWeight: 700, borderRadius: '999px', padding: '1px 7px' }}>{n}</span> : null
const COULEUR: Record<string, string> = { '/dashboard/evenements': '#4f46e5', '/dashboard/politiques': '#f59e0b' }

export function MenuEmploye({ compteurs, masques = [] }: { compteurs: Compteurs; masques?: string[] }) {
  const { t } = useT()
  const actif = groupeActif(usePathname() ?? '')
  return (
    <nav className="sidebar-nav">
      {MENU_EMPLOYE.filter(g => g.onglets.some(o => !masques.includes(o.href))).map(g => {
        const total = g.onglets.reduce((s, o) => s + (compteurs[o.href] ?? 0), 0)
        const couleur = g.onglets.map(o => COULEUR[o.href]).find((c, i) => c && (compteurs[g.onglets[i].href] ?? 0) > 0) ?? '#4f46e5'
        const estActif = actif?.groupe.id === g.id
        return (
          <Link key={g.id} href={g.onglets[0].href} className="sidebar-nav-item" aria-current={estActif ? 'page' : undefined}
            style={estActif ? { background: 'rgba(255,255,255,0.14)', color: '#fff', fontWeight: 600 } : undefined}>
            <span className="sidebar-icone"><IconeMenu id={g.id} /></span>
            <span>{t(g.label)}</span>
            <Pastille n={total} couleur={couleur} />
          </Link>
        )
      })}
    </nav>
  )
}

export function OngletsEmploye({ compteurs, masques = [] }: { compteurs: Compteurs; masques?: string[] }) {
  const { t } = useT()
  const chemin = usePathname() ?? ''
  const actif = groupeActif(chemin)
  const onglets = actif ? actif.groupe.onglets.filter(o => !masques.includes(o.href)) : []
  if (!actif || onglets.length < 2) return null
  return (
    <div role="tablist" aria-label={t(actif.groupe.label)} style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #e5e7eb', marginBottom: '24px', overflowX: 'auto' }}>
      {onglets.map(o => {
        const sel = correspond(o.href, chemin)
        return (
          <Link key={o.href} href={o.href} role="tab" aria-selected={sel}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px', fontSize: '14px', whiteSpace: 'nowrap', textDecoration: 'none',
              color: sel ? 'var(--accent-clinique, #4f46e5)' : '#6b7280', fontWeight: sel ? 700 : 500,
              borderBottom: sel ? '2px solid var(--accent-clinique, #4f46e5)' : '2px solid transparent', marginBottom: '-1px',
            }}>
            <span aria-hidden>{o.emoji}</span>{t(o.label)}
            {(compteurs[o.href] ?? 0) > 0 && <span style={{ background: COULEUR[o.href] ?? '#4f46e5', color: '#fff', fontSize: '11px', fontWeight: 700, borderRadius: '999px', padding: '0 6px' }}>{compteurs[o.href]}</span>}
          </Link>
        )
      })}
    </div>
  )
}
