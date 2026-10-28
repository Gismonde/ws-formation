'use client'
// Paramètres → Notifications : chaque type de courriel peut être activé / désactivé et personnalisé,
// avec un aperçu fidèle du courriel reçu.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useT } from '@/lib/i18n/client'
import { CATALOGUE, GROUPES, VARIABLES, REGLAGES_DEFAUT, rendreCourriel, remplir, type ReglagesNotifications, type TypeNotification } from '@/lib/notifications-catalogue'

type Ligne = { cle: string; actif: boolean; sujet: string | null; message: string | null; bouton: string | null }
const EXEMPLE: Record<string, string> = {
  activite: 'Utilisation de l’équipement médical', date: 'jeudi 5 novembre 2026', echeance: 'À compléter avant le 5 novembre 2026.',
  lieu: 'Lieu : salle de formation', calendrier: 'Ajouter à votre calendrier : https://…', detail: 'Elle est à terminer d’ici le 5 novembre 2026 (dans 7 jours).',
  progression: '40', courriel: 'marie.tremblay@exemple.com',
}

export default function GestionNotifications({ cliniques }: { cliniques: ('CMC' | 'WSSC')[] }) {
  const { t } = useT()
  const [modeles, setModeles] = useState<Record<string, Ligne>>({})
  const [reglages, setReglages] = useState<ReglagesNotifications>(REGLAGES_DEFAUT)
  const [actifs, setActifs] = useState(false)
  const [migration, setMigration] = useState<string | null>(null)
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [brouillon, setBrouillon] = useState<{ sujet: string; message: string; bouton: string; actif: boolean } | null>(null)
  const [q, setQ] = useState('')
  const [filtre, setFiltre] = useState<'tous' | 'envoyees'>('envoyees')
  const [clinique, setClinique] = useState<'CMC' | 'WSSC'>(cliniques[0] ?? 'CMC')
  const [etat, setEtat] = useState<{ ok: boolean; texte: string } | null>(null)
  const [envoi, setEnvoi] = useState(false)

  const charger = useCallback(async () => {
    const r = await fetch('/api/admin/notifications-modeles')
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { setEtat({ ok: false, texte: d.error ?? t('Chargement impossible') }); return }
    setModeles(d.modeles ?? {}); setReglages({ ...REGLAGES_DEFAUT, ...(d.reglages ?? {}) }); setActifs(!!d.courrielsActifs); setMigration(d.migration)
  }, [t])
  useEffect(() => { charger() }, [charger])

  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const visibles = CATALOGUE.filter(x => (filtre === 'tous' || x.envoyee) && (!q || norm(x.libelle).includes(norm(q))))
  const actuel = (x: TypeNotification) => {
    const l = modeles[x.cle]
    return { actif: l?.actif !== false, sujet: l?.sujet || x.defaut.sujet, message: l?.message || x.defaut.message, bouton: l?.bouton || x.defaut.bouton, perso: !!l }
  }

  const ouvrir = (x: TypeNotification) => {
    if (ouvert === x.cle) { setOuvert(null); return }
    const a = actuel(x)
    setOuvert(x.cle); setEtat(null)
    setBrouillon({ sujet: a.sujet, message: a.message, bouton: a.bouton, actif: a.actif })
  }

  async function appel(methode: 'PUT' | 'POST', corps: unknown, succes: string) {
    setEnvoi(true); setEtat(null)
    try {
      const r = await fetch('/api/admin/notifications-modeles', { method: methode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) setEtat({ ok: false, texte: d.error ?? t('Action impossible') })
      else { setEtat({ ok: true, texte: succes }); await charger() }
    } catch { setEtat({ ok: false, texte: t('Action impossible') }) }
    setEnvoi(false)
  }

  const basculer = (x: TypeNotification, actif: boolean) => {
    const a = actuel(x)
    const l = modeles[x.cle]
    appel('PUT', { cle: x.cle, actif, sujet: l?.sujet ?? null, message: l?.message ?? null, bouton: l?.bouton ?? null }, actif ? t('✓ Notification activée') : t('✓ Notification désactivée'))
    if (ouvert === x.cle && brouillon) setBrouillon({ ...brouillon, actif })
    void a
  }

  const type = ouvert ? CATALOGUE.find(x => x.cle === ouvert)! : null
  const apercu = useMemo(() => {
    if (!type || !brouillon || typeof window === 'undefined') return ''
    const vars = { prenom: 'Marie', nom: 'Tremblay', nom_complet: 'Marie Tremblay', ...EXEMPLE }
    return rendreCourriel({
      origine: window.location.origin, clinique, destinataire: 'Marie Tremblay', titre: remplir(brouillon.sujet, vars),
      message: brouillon.message, vars, bouton: { libelle: brouillon.bouton || type.defaut.bouton, lien: window.location.origin + '/dashboard' }, reglages,
    }).html
  }, [type, brouillon, clinique, reglages])

  const champ = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">🔔 {t('Notifications')}</h2>
        <p className="text-sm text-gray-500 mt-1">{t('Courriels envoyés automatiquement aux utilisateurs. Activez ou désactivez chaque notification et personnalisez son texte ; l’aperçu montre le courriel tel qu’il sera reçu.')}</p>
      </div>
      {migration && <p className="text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2">{migration}</p>}
      {!actifs && <p className="text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2">{t('L’envoi de courriels n’est pas encore configuré : vos réglages sont enregistrés et s’appliqueront dès que l’envoi sera activé.')}</p>}
      {etat && <p role="status" className={'text-sm ' + (etat.ok ? 'text-green-700' : 'text-red-600')}>{etat.texte}</p>}

      <details className="border border-gray-200 rounded-lg p-3">
        <summary className="text-sm font-medium text-gray-800 cursor-pointer">{t('Pied de page des courriels (coordonnées du service à la clientèle)')}</summary>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
          <input className={champ} value={reglages.contact_libelle} onChange={e => setReglages({ ...reglages, contact_libelle: e.target.value })} placeholder={t('Service à la clientèle')} maxLength={80} />
          <input className={champ} value={reglages.contact_courriel} onChange={e => setReglages({ ...reglages, contact_courriel: e.target.value })} placeholder={t('Courriel de contact')} maxLength={200} />
          <input className={champ} value={reglages.contact_telephone} onChange={e => setReglages({ ...reglages, contact_telephone: e.target.value })} placeholder={t('Téléphone')} maxLength={40} />
        </div>
        <button type="button" disabled={envoi} onClick={() => appel('PUT', { reglages }, t('✓ Coordonnées enregistrées'))} className="mt-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-40">{t('Enregistrer')}</button>
      </details>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
          <button type="button" onClick={() => setFiltre('envoyees')} className={'px-3 py-1.5 ' + (filtre === 'envoyees' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700')}>{t('Utilisées par WS Formation')}</button>
          <button type="button" onClick={() => setFiltre('tous')} className={'px-3 py-1.5 ' + (filtre === 'tous' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700')}>{t('Toutes ({n})', { n: CATALOGUE.length })}</button>
        </div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('Rechercher…')} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm ml-auto w-56" />
      </div>

      {GROUPES.map(g => {
        const liste = visibles.filter(x => x.groupe === g.id)
        if (!liste.length) return null
        return (
          <div key={g.id}>
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">{t(g.titre)}</h3>
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
              {liste.map(x => {
                const a = actuel(x)
                return (
                  <div key={x.cle}>
                    <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                      <label className="relative inline-flex items-center cursor-pointer" title={a.actif ? t('Active') : t('Désactivée')}>
                        <input type="checkbox" className="sr-only peer" checked={a.actif} disabled={envoi || !!migration} onChange={e => basculer(x, e.target.checked)} />
                        <span className="w-9 h-5 bg-gray-300 rounded-full peer-checked:bg-green-500 transition-colors" />
                        <span className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
                      </label>
                      <button type="button" onClick={() => ouvrir(x)} className="flex-1 text-left text-sm text-gray-800 min-w-[220px]">{t(x.libelle)}</button>
                      <span className={'text-[11px] font-semibold px-2 py-0.5 rounded-full ' + (a.perso ? 'bg-violet-50 text-violet-700' : 'bg-gray-100 text-gray-600')}>{a.perso ? t('Personnalisé') : t('Par défaut')}</span>
                      {!x.envoyee && <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{t('Pas encore utilisé')}</span>}
                      <button type="button" onClick={() => ouvrir(x)} className="text-sm text-indigo-700">{ouvert === x.cle ? t('Fermer') : t('Modifier')}</button>
                    </div>
                    {ouvert === x.cle && brouillon && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-3 pb-4">
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-gray-600">{t('Objet du courriel')}</label>
                          <input className={champ} value={brouillon.sujet} onChange={e => setBrouillon({ ...brouillon, sujet: e.target.value })} maxLength={200} />
                          <label className="block text-xs font-medium text-gray-600">{t('Message (une ligne = un paragraphe)')}</label>
                          <textarea className={champ} rows={7} value={brouillon.message} onChange={e => setBrouillon({ ...brouillon, message: e.target.value })} maxLength={4000} />
                          <label className="block text-xs font-medium text-gray-600">{t('Texte du bouton')}</label>
                          <input className={champ} value={brouillon.bouton} onChange={e => setBrouillon({ ...brouillon, bouton: e.target.value })} maxLength={60} />
                          <div className="flex flex-wrap gap-1">
                            {VARIABLES.map(v => (
                              <button key={v.cle} type="button" title={t(v.aide)} onClick={() => setBrouillon({ ...brouillon, message: brouillon.message + ` {${v.cle}}` })}
                                className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 hover:bg-indigo-50">{`{${v.cle}}`}</button>
                            ))}
                          </div>
                          <p className="text-xs text-gray-500">{t('Cliquez une variable pour l’ajouter. « Bonjour Prénom Nom, », les logos, le bouton vers l’activité et le pied de page sont ajoutés automatiquement.')}</p>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <button type="button" disabled={envoi || !!migration} onClick={() => appel('PUT', { cle: x.cle, ...brouillon }, t('✓ Notification enregistrée'))} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-40">{t('Enregistrer')}</button>
                            {a.perso && <button type="button" disabled={envoi} onClick={async () => { await appel('PUT', { cle: x.cle, reinitialiser: true }, t('✓ Texte par défaut rétabli')); setBrouillon({ ...x.defaut, actif: true }) }} className="px-3 py-2 rounded-lg border border-gray-300 text-sm">{t('Rétablir le texte par défaut')}</button>}
                            <button type="button" disabled={envoi || !actifs} title={!actifs ? t('L’envoi de courriels n’est pas encore configuré') : undefined} onClick={() => appel('POST', { cle: x.cle, ...brouillon }, t('✓ Courriel test envoyé à votre adresse'))} className="px-3 py-2 rounded-lg border border-gray-300 text-sm disabled:opacity-40">{t('M’envoyer un test')}</button>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-gray-600">{t('Aperçu')}</span>
                            {cliniques.length > 1 && cliniques.map(c => (
                              <button key={c} type="button" onClick={() => setClinique(c)} className={'text-xs px-2 py-0.5 rounded-full border ' + (clinique === c ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600')}>{c}</button>
                            ))}
                          </div>
                          <iframe title={t('Aperçu du courriel')} srcDoc={apercu} className="w-full h-[560px] border border-gray-200 rounded-lg bg-white" sandbox="" />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </section>
  )
}
