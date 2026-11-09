'use client'
// Menu de gauche de l'administration : grands onglets qui se déplient (accordéon).
// Le groupe de la page affichée est ouvert automatiquement et le lien actif est mis en évidence.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

/** compte : pastille de notification (éléments qui attendent une action) ; titre : son infobulle */
export type LienMenu = { href: string; label: string; icon: string; compte?: number; titre?: string }
export type GroupeMenu = { id: string; label: string; icon: string; liens: LienMenu[] }

/** Lien le plus précis correspondant à l'adresse (ex. /admin/employes/suppressions plutôt que /admin/employes). */
function lienActif(chemin: string, hrefs: string[]): string | null {
  let meilleur: string | null = null
  for (const h of hrefs) {
    const ok = h === '/admin' ? chemin === '/admin' : chemin === h || chemin.startsWith(h + '/')
    if (ok && (!meilleur || h.length > meilleur.length)) meilleur = h
  }
  return meilleur
}

function Pastille({ n, titre }: { n?: number; titre?: string }) {
  if (!n) return null
  return (
    <span title={titre} aria-label={titre} style={{ marginLeft: 'auto', minWidth: '20px', height: '20px', padding: '0 6px', borderRadius: '999px', background: '#ef4444', color: '#fff', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
      {n > 99 ? '99+' : n}
    </span>
  )
}

export function MenuAdmin({ groupes }: { groupes: GroupeMenu[] }) {
  const chemin = usePathname() ?? ''
  const actif = lienActif(chemin, groupes.flatMap(g => g.liens.map(l => l.href)))
  const groupeActif = groupes.find(g => g.liens.some(l => l.href === actif))?.id ?? null
  const [ouverts, setOuverts] = useState<string[]>(groupeActif ? [groupeActif] : [])

  // En changeant de page, le groupe de la nouvelle page s'ouvre
  useEffect(() => {
    if (groupeActif) setOuverts(o => (o.includes(groupeActif) ? o : [...o, groupeActif]))
  }, [groupeActif])

  const basculer = (id: string) => setOuverts(o => (o.includes(id) ? o.filter(x => x !== id) : [...o, id]))

  return (
    <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
      {groupes.map(g => {
        // Onglet sans sous-menu (ex. Tableau de bord)
        if (g.liens.length === 1) {
          const l = g.liens[0]
          return (
            <Link key={g.id} href={l.href} className={'admin-nav-link' + (actif === l.href ? ' actif' : '')} aria-current={actif === l.href ? 'page' : undefined}>
              <span className='material-icons' style={{ fontSize: '18px' }}>{g.icon}</span>
              {g.label}
              <Pastille n={l.compte} titre={l.titre} />
            </Link>
          )
        }
        const ouvert = ouverts.includes(g.id)
        const total = g.liens.reduce((s, l) => s + (l.compte ?? 0), 0)
        return (
          <div key={g.id} style={{ marginBottom: '2px' }}>
            <button type='button' onClick={() => basculer(g.id)} aria-expanded={ouvert}
              className={'admin-nav-link admin-nav-groupe' + (groupeActif === g.id && !ouvert ? ' actif' : '')}>
              <span className='material-icons' style={{ fontSize: '18px' }}>{g.icon}</span>
              <span style={{ flex: 1, textAlign: 'left' }}>{g.label}</span>
              {!ouvert && <Pastille n={total} titre={g.liens.filter(l => l.compte).map(l => l.titre).join(' · ')} />}
              <span className='material-icons' style={{ fontSize: '18px', transition: 'transform 0.15s', transform: ouvert ? 'rotate(180deg)' : 'none' }}>expand_more</span>
            </button>
            {ouvert && (
              <div style={{ margin: '2px 0 6px 20px', paddingLeft: '8px', borderLeft: '1px solid rgba(255,255,255,0.12)' }}>
                {g.liens.map(l => (
                  <Link key={l.href} href={l.href} className={'admin-nav-link admin-nav-sous' + (actif === l.href ? ' actif' : '')} aria-current={actif === l.href ? 'page' : undefined}>
                    <span className='material-icons' style={{ fontSize: '16px' }}>{l.icon}</span>
                    {l.label}
                    <Pastille n={l.compte} titre={l.titre} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}
