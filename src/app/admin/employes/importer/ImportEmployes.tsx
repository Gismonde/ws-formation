'use client'
// Import d'employés : modèle à télécharger, aperçu ligne par ligne, puis création des lignes valides.
import { useState } from 'react'
import Link from 'next/link'
import { useT } from '@/lib/i18n/client'
import { ROLE_LABEL } from '@/lib/cliniques'
import type { LigneImport, ErreurImport } from '@/lib/import-employes'

type Resultat = { numero: number; email: string; ok: boolean; erreur?: string; employeId?: string; lien?: string | null; courrielEnvoye?: boolean }

export default function ImportEmployes({ estGestionnaire }: { estGestionnaire: boolean }) {
  const { t } = useT()
  const [fichier, setFichier] = useState<File | null>(null)
  const [lignes, setLignes] = useState<LigneImport[] | null>(null)
  const [total, setTotal] = useState(0)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState<null | 'apercu' | 'creer'>(null)
  const [resultats, setResultats] = useState<Resultat[] | null>(null)

  const libelleErreur = (e: ErreurImport) => ({
    prenom_manquant: t('Prénom manquant'),
    nom_manquant: t('Nom manquant'),
    email_manquant: t('Courriel manquant'),
    email_invalide: t('Courriel invalide'),
    email_double_fichier: t('Courriel en double dans le fichier'),
    email_existant: t('Un compte existe déjà avec ce courriel'),
    clinique_invalide: t('Clinique manquante ou invalide (CMC, WSSC ou Les deux)'),
    clinique_hors_perimetre: t('Clinique hors de votre périmètre'),
    departement_introuvable: t('Département introuvable'),
    role_invalide: t('Rôle invalide'),
    role_non_autorise: t('Vous ne pouvez pas attribuer ce rôle'),
    gestionnaire_sans_departement: t('Un gestionnaire doit avoir un département'),
    poste_inconnu: t('Poste absent de la liste officielle (menu Employés → Postes)'),
  }[e])

  const libelleErreurFichier = (code: string, manquantes?: string[]) => ({
    format: t('Choisissez un fichier .xlsx ou .csv.'),
    taille: t('Le fichier dépasse 5 Mo.'),
    lecture: t('Impossible de lire ce fichier.'),
    vide: t('Le fichier ne contient aucune ligne d’employé.'),
    colonnes: t('Colonnes obligatoires introuvables : {c}', { c: (manquantes ?? []).map(c => ({ prenom: t('Prénom'), nom: t('Nom'), email: t('Courriel') } as Record<string, string>)[c] ?? c).join(', ') }),
  } as Record<string, string>)[code] ?? code

  const envoyer = async (action: 'apercu' | 'creer') => {
    if (!fichier) return
    setEnvoi(action); setErreur(null)
    const fd = new FormData()
    fd.append('fichier', fichier); fd.append('action', action)
    const r = await fetch('/api/admin/employes/importer', { method: 'POST', body: fd }).catch(() => null)
    const d = r ? await r.json().catch(() => ({})) : {}
    setEnvoi(null)
    if (!r || !r.ok) { setErreur(libelleErreurFichier(d.error ?? 'lecture', d.colonnesManquantes)); return }
    if (action === 'apercu') { setLignes(d.lignes); setTotal(d.total) } else setResultats(d.resultats)
  }

  const telechargerModele = () => {
    const entete = estGestionnaire ? 'Prénom;Nom;Courriel;Poste' : 'Prénom;Nom;Courriel;Poste;Clinique;Département;Rôle'
    const ex = estGestionnaire ? 'Marie;Tremblay;marie.tremblay@exemple.com;Infirmière' : 'Marie;Tremblay;marie.tremblay@exemple.com;Infirmière;WSSC;Bloc opératoire;Employé'
    const blob = new Blob(['﻿' + entete + '\n' + ex + '\n'], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = 'modele-import-employes.csv'; a.click()
    URL.revokeObjectURL(a.href)
  }

  const valides = lignes?.filter(l => l.erreurs.length === 0) ?? []
  const carte = 'bg-white border border-gray-200 rounded-xl p-6'

  if (resultats) {
    const ok = resultats.filter(r => r.ok)
    const liens = ok.filter(r => r.lien)
    return (
      <div className={carte}>
        <p className="font-semibold text-green-800">{t('{n} employé(s) créé(s).', { n: ok.length })}</p>
        {resultats.some(r => !r.ok) && (
          <ul className="mt-3 text-sm text-red-700 list-disc pl-5">
            {resultats.filter(r => !r.ok).map(r => <li key={r.numero}>{t('Ligne {n}', { n: r.numero })} — {r.email} : {r.erreur}</li>)}
          </ul>
        )}
        {liens.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-2">{t('Les courriels n’ont pas pu être envoyés automatiquement. Transmettez ces liens personnels aux employés :')}</p>
            <ul className="text-xs space-y-1">{liens.map(r => <li key={r.numero}><b>{r.email}</b> : <span className="break-all">{r.lien}</span></li>)}</ul>
          </div>
        )}
        <div className="flex gap-3 mt-5">
          <Link href="/admin/employes" className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm">{t('Retour aux employés')}</Link>
          <button type="button" onClick={() => { setResultats(null); setLignes(null); setFichier(null) }} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700">{t('Importer un autre fichier')}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className={carte}>
        <h2 className="font-semibold text-gray-900 mb-2">{t('1. Préparez le fichier')}</h2>
        <p className="text-sm text-gray-600 mb-3">
          {estGestionnaire
            ? t('Colonnes : Prénom, Nom, Courriel (obligatoires) et Poste. Les employés sont ajoutés à votre département.')
            : t('Colonnes : Prénom, Nom, Courriel (obligatoires), Poste, Clinique (CMC, WSSC ou Les deux), Département (nom exact) et Rôle (Employé ou Gestionnaire ; Employé par défaut).')}
        </p>
        <button type="button" onClick={telechargerModele} className="text-sm font-medium text-indigo-600 hover:underline">⬇ {t('Télécharger le modèle (CSV)')}</button>
      </div>

      <div className={carte}>
        <h2 className="font-semibold text-gray-900 mb-3">{t('2. Choisissez le fichier')}</h2>
        <div className="flex flex-wrap items-center gap-3">
          <input type="file" accept=".xlsx,.csv" onChange={e => { setFichier(e.target.files?.[0] ?? null); setLignes(null); setErreur(null) }} className="text-sm" />
          <button type="button" disabled={!fichier || envoi !== null} onClick={() => envoyer('apercu')} className="text-sm font-semibold px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 disabled:opacity-50">
            {envoi === 'apercu' ? t('Analyse…') : t('Vérifier le fichier')}
          </button>
        </div>
        {erreur && <p className="text-sm text-red-600 mt-3">{erreur}</p>}
      </div>

      {lignes && (
        <div className={carte}>
          <h2 className="font-semibold text-gray-900 mb-1">{t('3. Vérifiez et créez')}</h2>
          <p className="text-sm text-gray-600 mb-3">
            {t('{v} ligne(s) prête(s), {e} ligne(s) avec erreur (ignorées).', { v: valides.length, e: lignes.length - valides.length })}
            {total > lignes.length && ' ' + t('Seules les {n} premières lignes sont traitées.', { n: lignes.length })}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500 border-b">
                <th className="py-2 pr-2">#</th><th className="pr-2">{t('Nom')}</th><th className="pr-2">{t('Courriel')}</th><th className="pr-2">{t('Clinique')}</th><th className="pr-2">{t('Département')}</th><th className="pr-2">{t('Rôle')}</th><th>{t('Statut')}</th>
              </tr></thead>
              <tbody>
                {lignes.map(l => (
                  <tr key={l.numero} className={'border-b border-gray-100 ' + (l.erreurs.length ? 'bg-red-50' : '')}>
                    <td className="py-2 pr-2 text-gray-400">{l.numero}</td>
                    <td className="pr-2">{l.prenom} {l.nom}{l.poste && <span className="block text-xs text-gray-500">{l.poste}</span>}</td>
                    <td className="pr-2">{l.email}</td>
                    <td className="pr-2">{l.clinique === 'LES_DEUX' ? t('Les deux') : l.clinique ?? '—'}</td>
                    <td className="pr-2">{l.departement_nom || '—'}</td>
                    <td className="pr-2">{t(ROLE_LABEL[l.role])}</td>
                    <td>{l.erreurs.length ? <span className="text-xs text-red-700">{l.erreurs.map(libelleErreur).join(' · ')}</span> : <span className="text-xs text-green-700">✓ {t('Prêt')}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" disabled={valides.length === 0 || envoi !== null} onClick={() => envoyer('creer')} className="mt-4 text-sm font-semibold px-4 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-50">
            {envoi === 'creer' ? t('Création en cours…') : t('Créer {n} employé(s) et envoyer les invitations', { n: valides.length })}
          </button>
        </div>
      )}
    </div>
  )
}
