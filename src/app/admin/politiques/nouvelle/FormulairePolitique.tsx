'use client'
import { useT } from '@/lib/i18n/client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ChoixDocument, { DocumentEnvoye } from '@/components/politiques/ChoixDocument'
import ChampsCiblage, { Ciblage } from '@/components/politiques/ChampsCiblage'
import { CliniqueEmploye } from '@/lib/cliniques'

export default function FormulairePolitique({ cliniques, departements, courrielsActifs }: {
  cliniques: CliniqueEmploye[]
  departements: { id: string; nom: string }[]
  courrielsActifs: boolean
}) {
  const { t } = useT()
  const router = useRouter()
  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [doc, setDoc] = useState<DocumentEnvoye | null>(null)
  const [ciblage, setCiblage] = useState<Ciblage>({ clinique: cliniques[0], tous: true, departements: [] })
  const [notifier, setNotifier] = useState(true)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState('')

  async function publier(e: React.FormEvent) {
    e.preventDefault()
    setErreur('')
    if (!doc) return setErreur(t('Ajoutez le document de la politique.'))
    if (!ciblage.tous && ciblage.departements.length === 0) return setErreur(t('Choisissez au moins un département.'))
    setEnCours(true)
    const res = await fetch('/api/politiques', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titre, description, clinique: ciblage.clinique,
        departements: ciblage.tous ? [] : ciblage.departements,
        fichier: doc.reference, nom_fichier: doc.nom, notifier,
      }),
    })
    const d = await res.json().catch(() => ({}))
    setEnCours(false)
    if (!res.ok) return setErreur(d.error ?? 'Erreur')
    router.push(`/admin/politiques/${d.id}`)
    router.refresh()
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  return (
    <form onSubmit={publier} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
      {erreur && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{erreur}</div>}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('Titre de la politique *')}</label>
        <input className={inputCls} value={titre} onChange={e => setTitre(e.target.value)} required placeholder={t('Ex : Politique de confidentialité des dossiers patients')} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Résumé (facultatif)</label>
        <textarea className={inputCls} rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder={t('En une ou deux phrases : à quoi sert cette politique ?')} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('Document *')}</label>
        <ChoixDocument valeur={doc} onChange={setDoc} />
      </div>
      <ChampsCiblage valeur={ciblage} onChange={setCiblage} cliniques={cliniques} departements={departements} />
      <label className={'flex items-start gap-2 text-sm ' + (courrielsActifs ? 'text-gray-700' : 'text-gray-400')}>
        <input type="checkbox" className="mt-0.5" checked={notifier && courrielsActifs} disabled={!courrielsActifs} onChange={e => setNotifier(e.target.checked)} />
        <span>
          Avertir les employés concernés par courriel
          {!courrielsActifs && <span className="block text-xs">(envoi de courriels pas encore configuré — la politique apparaîtra quand même dans leur portail)</span>}
        </span>
      </label>
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={enCours} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm">
          {enCours ? 'Publication…' : t('Publier la politique')}
        </button>
        <a href="/admin/politiques" className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">{t('Annuler')}</a>
      </div>
    </form>
  )
}
