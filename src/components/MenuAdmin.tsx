'use client'
// Menu de gauche de l'administration : grands onglets qui se déplient (accordéon).
// Le groupe de la page affichée est ouvert automatiquement et le lien actif est mis en évidence.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export type LienMenu = { href: string; label: string; icon: string }
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
            </Link>
          )
        }
        const ouvert = ouverts.includes(g.id)
        return (
          <div key={g.id} style={{ marginBottom: '2px' }}>
            <button type='button' onClick={() => basculer(g.id)} aria-expanded={ouvert}
              className={'admin-nav-link admin-nav-groupe' + (groupeActif === g.id && !ouvert ? ' actif' : '')}>
              <span className='material-icons' style={{ fontSize: '18px' }}>{g.icon}</span>
              <span style={{ flex: 1, textAlign: 'left' }}>{g.label}</span>
              <span className='material-icons' style={{ fontSize: '18px', transition: 'transform 0.15s', transform: ouvert ? 'rotate(180deg)' : 'none' }}>expand_more</span>
            </button>
            {ouvert && (
              <div style={{ margin: '2px 0 6px 20px', paddingLeft: '8px', borderLeft: '1px solid rgba(255,255,255,0.12)' }}>
                {g.liens.map(l => (
                  <Link key={l.href} href={l.href} className={'admin-nav-link admin-nav-sous' + (actif === l.href ? ' actif' : '')} aria-current={actif === l.href ? 'page' : undefined}>
                    <span className='material-icons' style={{ fontSize: '16px' }}>{l.icon}</span>
                    {l.label}
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
