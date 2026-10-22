'use client'
// Publication d'une ou de plusieurs politiques : chaque document devient une politique,
// son titre est proposé à partir du nom du fichier ; le même public s'applique à toutes.
import { useT } from '@/lib/i18n/client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { envoyerDocument } from '@/components/politiques/ChoixDocument'
import ChampsCiblage, { Ciblage, EmployeOption, corpsCiblage, ciblageVide } from '@/components/politiques/ChampsCiblage'
import { CliniqueEmploye } from '@/lib/cliniques'
import { REGLES_MEDIAS } from '@/lib/medias'
import { titreDepuisFichier } from '@/lib/titre-fichier'

type Ligne = {
  cle: string
  nomFichier: string
  titre: string
  description: string
  etat: 'envoi' | 'pret' | 'erreur' | 'publiee'
  reference?: string
  erreur?: string
  id?: string
}

export default function FormulairePolitique({ cliniques, options, courrielsActifs }: {
  cliniques: CliniqueEmploye[]
  options: { departements: { id: string; nom: string }[]; postes: string[]; employes: EmployeOption[]; rolesPostes: boolean }
  courrielsActifs: boolean
}) {
  const { t } = useT()
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [lignes, setLignes] = useState<Ligne[]>([])
  const [ciblage, setCiblage] = useState<Ciblage>({ clinique: cliniques[0], tous: true, departements: [], employes: [], roles: [], postes: [] })
  const [notifier, setNotifier] = useState(true)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState('')
  const [survol, setSurvol] = useState(false)

  const maj = (cle: string, p: Partial<Ligne>) => setLignes(ls => ls.map(l => (l.cle === cle ? { ...l, ...p } : l)))

  function ajouter(fichiers: FileList | File[] | null) {
    if (!fichiers) return
    for (const f of Array.from(fichiers)) {
      const cle = `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 8)}`
      setLignes(ls => [...ls, { cle, nomFichier: f.name, titre: titreDepuisFichier(f.name), description: '', etat: 'envoi' }])
      envoyerDocument(f)
        .then(d => maj(cle, { etat: 'pret', reference: d.reference }))
        .catch(e => maj(cle, { etat: 'erreur', erreur: e instanceof Error ? e.message : t('Erreur') }))
    }
  }

  const aPublier = lignes.filter(l => l.etat === 'pret')
  const envoiEnCours = lignes.some(l => l.etat === 'envoi')

  async function publier(e: React.FormEvent) {
    e.preventDefault()
    setErreur('')
    if (aPublier.length === 0) return setErreur(t('Ajoutez au moins un document.'))
    if (aPublier.some(l => !l.titre.trim())) return setErreur(t('Chaque politique doit avoir un titre.'))
    if (ciblageVide(ciblage)) return setErreur(t('Choisissez au moins un critère pour le public ciblé.'))
    setEnCours(true)
    let derniere: string | undefined
    for (const l of aPublier) {
      const res = await fetch('/api/politiques', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titre: l.titre, description: l.description, ...corpsCiblage(ciblage), fichier: l.reference, nom_fichier: l.nomFichier, notifier }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) { maj(l.cle, { etat: 'publiee', id: d.id }); derniere = d.id }
      else maj(l.cle, { etat: 'erreur', erreur: d.error ?? t('Erreur') })
    }
    setEnCours(false)
    // Une seule politique : on ouvre sa fiche ; plusieurs : retour à la liste
    if (aPublier.length === 1 && derniere) { router.push(`/admin/politiques/${derniere}`); router.refresh() }
    else if (derniere) { router.push('/admin/politiques'); router.refresh() }
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
  return (
    <form onSubmit={publier} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
      {erreur && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{erreur}</div>}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('Documents *')}</label>
        <div
          onClick={() => input.current?.click()}
          onDragOver={e => { e.preventDefault(); setSurvol(true) }}
          onDragLeave={() => setSurvol(false)}
          onDrop={e => { e.preventDefault(); setSurvol(false); ajouter(e.dataTransfer.files) }}
          className={'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ' + (survol ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400 bg-gray-50')}
        >
          <p className="text-sm font-medium text-gray-700">{t('📄 Glissez un ou plusieurs documents ici, ou cliquez pour les choisir')}</p>
          <p className="text-xs text-gray-500 mt-1">{REGLES_MEDIAS.fichier.libelle}{' '}{t('· chaque document devient une politique, son titre est tiré du nom du fichier')}</p>
        </div>
        <input ref={input} type="file" multiple className="hidden" accept={REGLES_MEDIAS.fichier.types.join(',')}
          onChange={e => { ajouter(e.target.files); e.target.value = '' }} />
      </div>

      {lignes.length > 0 && (
        <div className="space-y-2">
          {lignes.map(l => (
            <div key={l.cle} className={'rounded-lg border p-3 ' + (l.etat === 'erreur' ? 'border-red-200 bg-red-50' : l.etat === 'publiee' ? 'border-green-200 bg-green-50' : 'border-gray-200')}>
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                <span className="truncate">📄 {l.nomFichier}</span>
                <span className="ml-auto whitespace-nowrap">
                  {l.etat === 'envoi' ? t('Envoi…') : l.etat === 'pret' ? '✓ ' + t('Prêt') : l.etat === 'publiee' ? '✓ ' + t('Publiée') : l.erreur}
                </span>
                {l.etat !== 'publiee' && (
                  <button type="button" onClick={() => setLignes(ls => ls.filter(x => x.cle !== l.cle))} className="text-gray-400 hover:text-red-600" aria-label={t('Retirer')}>✕</button>
                )}
              </div>
              <input className={inputCls} value={l.titre} disabled={l.etat === 'publiee'} onChange={e => maj(l.cle, { titre: e.target.value })} placeholder={t('Titre de la politique *')} aria-label={t('Titre de la politique *')} />
              {lignes.length === 1 && (
                <textarea className={inputCls + ' mt-2'} rows={2} value={l.description} onChange={e => maj(l.cle, { description: e.target.value })} placeholder={t('Résumé (facultatif) : à quoi sert cette politique ?')} />
              )}
            </div>
          ))}
        </div>
      )}

      <ChampsCiblage valeur={ciblage} onChange={setCiblage} cliniques={cliniques} departements={options.departements} postes={options.postes} employes={options.employes} rolesPostes={options.rolesPostes} />

      <label className={'flex items-start gap-2 text-sm ' + (courrielsActifs ? 'text-gray-700' : 'text-gray-400')}>
        <input type="checkbox" className="mt-0.5" checked={notifier && courrielsActifs} disabled={!courrielsActifs} onChange={e => setNotifier(e.target.checked)} />
        <span>
          {t('Avertir les employés concernés par courriel')}
          {!courrielsActifs && <span className="block text-xs">{t('(envoi de courriels pas encore configuré — la politique apparaîtra quand même dans leur portail)')}</span>}
        </span>
      </label>
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={enCours || envoiEnCours || aPublier.length === 0} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm">
          {enCours ? t('Publication…') : envoiEnCours ? t('Envoi des documents…') : aPublier.length > 1 ? t('Publier les {n} politiques', { n: aPublier.length }) : t('Publier la politique')}
        </button>
        <a href="/admin/politiques" className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">{t('Annuler')}</a>
      </div>
    </form>
  )
}
