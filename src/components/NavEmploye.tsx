'use client'
// Menu latéral (menus déroulants) et onglets du groupe actif, pour le portail employé.
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
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
  const chemin = usePathname() ?? ''
  const actif = groupeActif(chemin)
  // Menus déroulants : le groupe de la page ouverte est déplié ; les autres s'ouvrent d'un clic
  const [ouverts, setOuverts] = useState<string[]>(actif ? [actif.groupe.id] : [])
  useEffect(() => { if (actif) setOuverts(o => (o.includes(actif.groupe.id) ? o : [...o, actif.groupe.id])) }, [actif?.groupe.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const basculer = (id: string) => setOuverts(o => (o.includes(id) ? o.filter(x => x !== id) : [...o, id]))
  return (
    <nav className="sidebar-nav">
      {MENU_EMPLOYE.filter(g => g.onglets.some(o => !masques.includes(o.href))).map(g => {
        const onglets = g.onglets.filter(o => !masques.includes(o.href))
        const total = onglets.reduce((s, o) => s + (compteurs[o.href] ?? 0), 0)
        const couleur = onglets.map(o => COULEUR[o.href]).find((c, i) => c && (compteurs[onglets[i].href] ?? 0) > 0) ?? '#4f46e5'
        const estActif = actif?.groupe.id === g.id
        const styleActif = estActif ? { background: 'rgba(255,255,255,0.14)', color: '#fff', fontWeight: 600 } : undefined
        if (onglets.length < 2) return (
          <Link key={g.id} href={onglets[0].href} className="sidebar-nav-item" aria-current={estActif ? 'page' : undefined} style={styleActif}>
            <span className="sidebar-icone"><IconeMenu id={g.id} /></span>
            <span>{t(g.label)}</span>
            <Pastille n={total} couleur={couleur} />
          </Link>
        )
        const ouvert = ouverts.includes(g.id)
        return (
          <div key={g.id}>
            <button type="button" className="sidebar-nav-item" aria-expanded={ouvert} aria-controls={`menu-${g.id}`} onClick={() => basculer(g.id)}
              style={{ ...styleActif, width: '100%', background: styleActif?.background ?? 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', font: 'inherit' }}>
              <span className="sidebar-icone"><IconeMenu id={g.id} /></span>
              <span>{t(g.label)}</span>
              {!ouvert && <Pastille n={total} couleur={couleur} />}
              <span aria-hidden="true" style={{ marginLeft: ouvert || total === 0 ? 'auto' : '6px', fontSize: '11px', opacity: 0.8, transition: 'transform .15s', transform: ouvert ? 'rotate(90deg)' : 'none' }}>▶</span>
            </button>
            {ouvert && (
              <div id={`menu-${g.id}`} style={{ display: 'grid', gap: '2px', margin: '2px 0 6px', paddingLeft: '34px' }}>
                {onglets.map(o => {
                  const sur = correspond(o.href, chemin)
                  return (
                    <Link key={o.href} href={o.href} aria-current={sur ? 'page' : undefined} className="sidebar-nav-item"
                      style={{ fontSize: '13px', padding: '7px 10px', ...(sur ? { background: 'rgba(255,255,255,0.18)', color: '#fff', fontWeight: 600 } : { opacity: 0.85 }) }}>
                      <span>{t(o.label)}</span>
                      <Pastille n={compteurs[o.href] ?? 0} couleur={COULEUR[o.href] ?? '#4f46e5'} />
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
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
  const barre = useRef<HTMLDivElement>(null)
  // Sur téléphone, les onglets défilent : on amène l'onglet ouvert dans l'écran
  useEffect(() => {
    const b = barre.current
    const sel = b?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!b || !sel) return
    const gauche = sel.offsetLeft - b.offsetLeft
    if (gauche + sel.offsetWidth > b.scrollLeft + b.clientWidth || gauche < b.scrollLeft) b.scrollLeft = Math.max(0, gauche - (b.clientWidth - sel.offsetWidth) / 2)
  }, [chemin])
  if (!actif || onglets.length < 2) return null
  return (
    <div ref={barre} role="tablist" aria-label={t(actif.groupe.label)} style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #e5e7eb', marginBottom: '24px', overflowX: 'auto' }}>
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
