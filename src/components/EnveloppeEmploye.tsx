// Habillage aux couleurs de la clinique (CMC ou WSSC) des pages employé hors du tableau de bord :
// formations, leçons, questionnaires, certificats. Fournit les variables CSS du thème.
import Link from 'next/link'
import { themeEmploye } from '@/lib/theme-employe'
import { CLINIQUE_INFO } from '@/lib/cliniques'

export default async function EnveloppeEmploye({ children }: { children: React.ReactNode }) {
  const { espace, variables } = await themeEmploye()
  const c = espace.actif
  return (
    <div className="espace-employe" style={{ ...(variables as React.CSSProperties), background: 'var(--fond-clinique)', minHeight: '100vh' }}>
      <div className="bandeau-clinique" style={{ background: 'var(--barre-clinique)', color: '#fff' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px' }}>
          {c && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={CLINIQUE_INFO[c].logo} alt={CLINIQUE_INFO[c].nom} style={{ height: '26px', background: '#fff', borderRadius: '6px', padding: '2px 6px' }} />
          )}
          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c ? `Espace ${CLINIQUE_INFO[c].court} — ${CLINIQUE_INFO[c].nom}` : 'WS Formation'}
          </span>
          <Link href="/dashboard" style={{ marginLeft: 'auto', color: '#fff', textDecoration: 'none', opacity: 0.9, whiteSpace: 'nowrap' }}>Mon espace →</Link>
        </div>
      </div>
      {children}
      <style>{`
        /* Les pages employé reprennent l'accent de la clinique à la place de l'indigo par défaut */
        .espace-employe .bg-indigo-600, .espace-employe .bg-blue-600 { background-color: var(--accent-clinique) !important; }
        .espace-employe .hover\\:bg-indigo-700:hover, .espace-employe .hover\\:bg-blue-700:hover { background-color: var(--accent-clinique-fonce) !important; }
        .espace-employe .text-indigo-600, .espace-employe .text-blue-600, .espace-employe .text-indigo-700 { color: var(--accent-clinique) !important; }
        .espace-employe .bg-indigo-50, .espace-employe .bg-blue-50, .espace-employe .bg-indigo-100 { background-color: var(--accent-clinique-clair) !important; }
        .espace-employe .border-indigo-200, .espace-employe .border-indigo-500, .espace-employe .border-blue-500 { border-color: var(--accent-clinique) !important; }
        @media print { .bandeau-clinique { display: none !important; } .espace-employe { background: #fff !important; } }
        .espace-employe .bg-gray-50.min-h-screen { background-color: var(--fond-clinique) !important; }
      `}</style>
    </div>
  )
}
