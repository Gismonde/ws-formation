'use client'
import { useT } from '@/lib/i18n/client'
import { useConfirmer } from '@/components/Confirmation'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ChoixDocument, { DocumentEnvoye } from '@/components/politiques/ChoixDocument'
import ChampsCiblage, { Ciblage, EmployeOption, corpsCiblage, ciblageVide } from '@/components/politiques/ChampsCiblage'
import { CliniqueEmploye } from '@/lib/cliniques'

type Props = {
  id: string
  titre: string
  description: string | null
  clinique: CliniqueEmploye
  ciblage: Ciblage
  options: { departements: { id: string; nom: string }[]; postes: string[]; familles: { famille: string; postes: string[] }[]; employes: EmployeOption[]; rolesPostes: boolean } | null
  actif: boolean
  enAttente: number
  peutGerer: boolean
  courrielsActifs: boolean
  cliniques: CliniqueEmploye[]
}

export default function ActionsPolitique(p: Props) {
  const { t } = useT()
  const confirmer = useConfirmer()
  const router = useRouter()
  const [panneau, setPanneau] = useState<null | 'version' | 'modifier'>(null)
  const [msg, setMsg] = useState<{ ok: boolean; texte: string } | null>(null)
  const [enCours, setEnCours] = useState(false)
  // Nouvelle version
  const [doc, setDoc] = useState<DocumentEnvoye | null>(null)
  const [note, setNote] = useState('')
  const [notifier, setNotifier] = useState(true)
  // Modifier
  const [titre, setTitre] = useState(p.titre)
  const [description, setDescription] = useState(p.description ?? '')
  const [ciblage, setCiblage] = useState<Ciblage>(p.ciblage)

  async function appeler(corps: Record<string, unknown>, succes: (d: Record<string, unknown>) => string) {
    setEnCours(true); setMsg(null)
    const res = await fetch(`/api/politiques/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) })
    const d = await res.json().catch(() => ({}))
    setEnCours(false)
    if (!res.ok) { setMsg({ ok: false, texte: d.error ?? 'Erreur' }); return false }
    setMsg({ ok: true, texte: succes(d) }); setPanneau(null); router.refresh()
    return true
  }

  const btn = 'px-4 py-2 rounded-lg text-sm font-medium border disabled:opacity-50'
  return (
    <div className="mb-6">
      <div className="flex flex-wrap gap-2">
        {p.actif && p.enAttente > 0 && (
          <button className={btn + ' border-amber-500 text-amber-800 bg-amber-50 hover:bg-amber-100'} disabled={enCours || !p.courrielsActifs}
            title={p.courrielsActifs ? '' : t('Envoi de courriels pas encore configuré')}
            onClick={async () => (await confirmer({ message: t('Envoyer un rappel par courriel aux {n} employé(s) en attente ?', { n: p.enAttente }), bouton: t('Envoyer') })) &&
              appeler({ action: 'rappel' }, d => t('Rappel envoyé à {n} employé(s).', { n: Number(d.courriels) }))}>
            {t('📧 Relancer les {n} en attente', { n: p.enAttente })}
          </button>
        )}
        {p.peutGerer && p.actif && (
          <>
            <button className={btn + ' border-indigo-600 text-indigo-700 bg-white hover:bg-indigo-50'} onClick={() => setPanneau(panneau === 'version' ? null : 'version')}>{t('⬆ Publier une nouvelle version')}</button>
            <button className={btn + ' border-gray-300 text-gray-700 bg-white hover:bg-gray-50'} onClick={() => setPanneau(panneau === 'modifier' ? null : 'modifier')}>{t('✏️ Modifier titre / public')}</button>
            <button className={btn + ' border-gray-300 text-gray-500 bg-white hover:bg-gray-50'} disabled={enCours}
              onClick={async () => (await confirmer({ message: t('Archiver cette politique ? Elle ne sera plus affichée aux employés (les confirmations sont conservées).'), bouton: t('Archiver') })) &&
                appeler({ action: 'archiver' }, () => t('Politique archivée.'))}>{t('🗄 Archiver')}</button>
          </>
        )}
        {p.peutGerer && !p.actif && (
          <button className={btn + ' border-green-600 text-green-700 bg-white'} disabled={enCours}
            onClick={() => appeler({ action: 'reactiver' }, () => t('Politique réactivée.'))}>{t('↩ Réactiver')}</button>
        )}
      </div>

      {msg && <p className={'text-sm mt-3 ' + (msg.ok ? 'text-green-700' : 'text-red-600')}>{msg.texte}</p>}

      {panneau === 'version' && (
        <div className="bg-white border border-indigo-200 rounded-xl p-5 mt-4 space-y-4">
          <p className="text-sm text-gray-700">
            {t('La nouvelle version remplace le document actuel.')} <b>{t('Tous les employés visés devront confirmer à nouveau')}</b> {t('« J’ai lu et compris ». Les confirmations des versions précédentes restent dans l’historique.')}
          </p>
          <ChoixDocument valeur={doc} onChange={setDoc} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ce qui change (facultatif)</label>
            <input className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm" value={note} onChange={e => setNote(e.target.value)} placeholder={t('Ex : ajout de la section sur le télétravail')} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={notifier && p.courrielsActifs} disabled={!p.courrielsActifs} onChange={e => setNotifier(e.target.checked)} />
            Avertir les employés par courriel {!p.courrielsActifs && <span className="text-xs text-gray-400">(courriels non configurés)</span>}
          </label>
          <button className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50" disabled={!doc || enCours}
            onClick={() => appeler({ action: 'nouvelle_version', fichier: doc?.reference, nom_fichier: doc?.nom, note_version: note, notifier },
              d => t('Version {v} publiée', { v: String(d.version) }) + (Number(d.courriels) > 0 ? ' — ' + t('{n} courriel(s) envoyé(s)', { n: Number(d.courriels) }) : '') + '.')}>
            {enCours ? t('Publication…') : t('Publier la nouvelle version')}
          </button>
        </div>
      )}

      {panneau === 'modifier' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Titre')}</label>
            <input className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm" value={titre} onChange={e => setTitre(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Résumé')}</label>
            <textarea className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm" rows={2} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          {p.options && <ChampsCiblage valeur={ciblage} onChange={setCiblage} cliniques={p.cliniques} departements={p.options.departements} postes={p.options.postes} familles={p.options.familles} employes={p.options.employes} rolesPostes={p.options.rolesPostes} />}
          <p className="text-xs text-gray-500">Les employés ajoutés au public devront confirmer ; les confirmations déjà faites sont conservées.</p>
          <button className="px-5 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            disabled={enCours || ciblageVide(ciblage)}
            onClick={() => appeler({ action: 'modifier', titre, description, ...corpsCiblage(ciblage) }, () => t('Modifications enregistrées.'))}>
            {t('Enregistrer')}
          </button>
        </div>
      )}
    </div>
  )
}
