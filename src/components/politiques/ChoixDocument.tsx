'use client'
import { useT } from '@/lib/i18n/client'
import { useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { REGLES_MEDIAS } from '@/lib/medias'

export type DocumentEnvoye = { reference: string; nom: string }

/** Envoie le document d'une politique directement dans l'espace privé. */
export async function envoyerDocument(fichier: File): Promise<DocumentEnvoye> {
  const regle = REGLES_MEDIAS.fichier
  if (!regle.types.includes(fichier.type)) throw new Error(`Format non accepté (${regle.libelle})`)
  if (fichier.size > regle.tailleMaxMo * 1024 * 1024) throw new Error(`Fichier trop volumineux (${regle.libelle})`)
  const res = await fetch('/api/politiques/fichier', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: fichier.type, taille: fichier.size }),
  })
  const d = await res.json()
  if (!res.ok) throw new Error(d.error ?? 'Envoi refusé')
  const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { error } = await sb.storage.from(d.bucket).uploadToSignedUrl(d.chemin, d.jeton, fichier, { contentType: fichier.type })
  if (error) throw new Error('Envoi échoué : ' + error.message)
  return { reference: d.reference, nom: fichier.name }
}

/** Zone « glisser-déposer » pour choisir le document (PDF recommandé). */
export default function ChoixDocument({ valeur, onChange }: { valeur: DocumentEnvoye | null; onChange: (d: DocumentEnvoye | null) => void }) {
  const { t } = useT()
  const input = useRef<HTMLInputElement>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState('')
  const [survol, setSurvol] = useState(false)

  async function traiter(f: File | undefined) {
    if (!f) return
    setErreur(''); setEnCours(true)
    try { onChange(await envoyerDocument(f)) }
    catch (e) { setErreur(e instanceof Error ? e.message : 'Erreur') }
    finally { setEnCours(false) }
  }

  return (
    <div>
      <div
        onClick={() => !enCours && input.current?.click()}
        onDragOver={e => { e.preventDefault(); setSurvol(true) }}
        onDragLeave={() => setSurvol(false)}
        onDrop={e => { e.preventDefault(); setSurvol(false); traiter(e.dataTransfer.files?.[0]) }}
        className={'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ' +
          (survol ? 'border-blue-500 bg-blue-50' : valeur ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-blue-400 bg-gray-50')}
      >
        {enCours ? <p className="text-sm text-gray-600">{t('Envoi du document…')}</p>
          : valeur ? (
            <div>
              <p className="text-sm font-semibold text-green-800">📄 {valeur.nom}</p>
              <p className="text-xs text-green-700 mt-1">{t('Document prêt — cliquez pour le remplacer')}</p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-gray-700">{t('📄 Glissez le document ici ou cliquez pour le choisir')}</p>
              <p className="text-xs text-gray-500 mt-1">{REGLES_MEDIAS.fichier.libelle}{' '}{t('· le PDF s’affiche directement dans le portail')}</p>
            </div>
          )}
      </div>
      <input ref={input} type="file" className="hidden"
        accept={REGLES_MEDIAS.fichier.types.join(',')}
        onChange={e => { traiter(e.target.files?.[0]); e.target.value = '' }} />
      {erreur && <p className="text-sm text-red-600 mt-2">{erreur}</p>}
    </div>
  )
}
