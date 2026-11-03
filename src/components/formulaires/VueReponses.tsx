// Affichage en lecture seule d'une réponse (portail employé, réception admin, impression).
import { champsAvecReserve, valeurLisible, type Champ, type Reponses } from '@/lib/formulaires'

export default function VueReponses({ champs, reponses, reserve, avecReserve, accent = '#4f46e5', t }: {
  champs: Champ[]
  reponses: Reponses
  /** Valeurs des sections réservées */
  reserve?: Reponses
  /** Afficher les sections réservées (jamais pour l'employé) */
  avecReserve: boolean
  accent?: string
  t: (s: string, v?: Record<string, string | number>) => string
}) {
  const liste = champsAvecReserve(champs).filter(c => avecReserve || !c.estReserve)
  const groupes: { section: (Champ & { estReserve: boolean }) | null; champs: (Champ & { estReserve: boolean })[] }[] = []
  for (const c of liste) {
    if (c.type === 'section' || !groupes.length) groupes.push({ section: c.type === 'section' ? c : null, champs: [] })
    if (c.type !== 'section' && c.type !== 'info') groupes[groupes.length - 1].champs.push(c)
  }
  return (
    <div className="space-y-4">
      {groupes.filter(g => g.champs.length || g.section).map((g, i) => (
        <section key={i} className="break-inside-avoid overflow-hidden rounded-xl border border-gray-200 bg-white">
          {g.section && (
            <header className="px-4 py-2 text-white print:text-black" style={{ background: g.section.estReserve ? '#374151' : accent }}>
              <h2 className="text-xs font-bold uppercase tracking-wide">{g.section.libelle}</h2>
            </header>
          )}
          <dl className="divide-y divide-gray-100">
            {g.champs.map(c => {
              const source = c.estReserve ? (reserve ?? {}) : reponses
              const v = valeurLisible(c, source)
              return (
                <div key={c.id} className="grid gap-1 px-4 py-2.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4">
                  <dt className="text-sm font-medium text-gray-600">{c.libelle}</dt>
                  <dd className={'whitespace-pre-wrap text-sm ' + (v ? 'text-gray-900' : 'italic text-gray-400')}>{v || t('Non rempli')}</dd>
                </div>
              )
            })}
          </dl>
        </section>
      ))}
    </div>
  )
}
