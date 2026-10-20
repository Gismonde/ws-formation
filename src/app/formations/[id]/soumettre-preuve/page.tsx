'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter, useParams } from 'next/navigation'
import { useT } from '@/lib/i18n/client'

type Preuve = {
  id: string
  nom_fichier: string
  statut: string
  created_at: string
  commentaire_admin?: string
}

export default function SoumettrePreuvePage() {
  const params = useParams()
  const formationId = params.id as string
  const router = useRouter()
  const { t, loc } = useT()

  const [formation, setFormation] = useState<{ titre: string } | null>(null)
  const [existingPreuves, setExistingPreuves] = useState<Preuve[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: f } = await supabase
        .from('formations')
        .select('titre')
        .eq('id', formationId)
        .single()
      if (f) setFormation(f)

      const res = await fetch('/api/preuves?formation_id=' + formationId)
      if (res.ok) {
        const d = await res.json()
        setExistingPreuves(d.preuves || [])
      }
    }
    load()
  }, [formationId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) { setError(t('Veuillez sélectionner un fichier')); return }
    setLoading(true)
    setError('')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('formation_id', formationId)

    const res = await fetch('/api/upload-preuve', { method: 'POST', body: formData })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || t('Erreur lors du téléversement'))
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
    setFile(null)
    const res2 = await fetch('/api/preuves?formation_id=' + formationId)
    if (res2.ok) {
      const d = await res2.json()
      setExistingPreuves(d.preuves || [])
    }
  }

  function getStatutLabel(statut: string): string {
    if (statut === 'en_attente') return t('En attente de validation')
    if (statut === 'valide' || statut === 'validee') return t('Validée')
    if (statut === 'refuse' || statut === 'refusee') return t('Refusée')
    return statut
  }

  function getStatutClass(statut: string): string {
    if (statut === 'en_attente') return 'bg-yellow-100 text-yellow-800'
    if (statut === 'valide' || statut === 'validee') return 'bg-green-100 text-green-800'
    if (statut === 'refuse' || statut === 'refusee') return 'bg-red-100 text-red-800'
    return 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <a href={'/formations/' + formationId} className="text-blue-600 hover:underline text-sm">
          ← {t('Retour à la formation')}
        </a>
        <h1 className="text-2xl font-bold mt-2">{t('Soumettre une preuve externe')}</h1>
        {formation && <p className="text-gray-600 mt-1">{formation.titre}</p>}
      </div>

      {existingPreuves.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">{t('Preuves soumises')}</h2>
          <div className="space-y-3">
            {existingPreuves.map((p) => (
              <div key={p.id} className="border rounded-lg p-4 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{p.nom_fichier}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {t('Soumis le {date}', { date: new Date(p.created_at).toLocaleDateString(loc) })}
                    </p>
                    {p.commentaire_admin && (
                      <p className="text-xs text-gray-700 mt-1 italic">
                        {t('Commentaire : {texte}', { texte: p.commentaire_admin })}
                      </p>
                    )}
                  </div>
                  <span className={'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' + getStatutClass(p.statut)}>
                    {getStatutLabel(p.statut)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">{t('Ajouter un document')}</h2>
        <p className="text-sm text-gray-600 mb-4">
          {t('Soumettez un certificat ou une attestation de formation externe. Un administrateur examinera le document et validera votre formation.')}
        </p>

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-800 text-sm">
            {t('Document soumis avec succès ! Un administrateur va examiner votre preuve.')}
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('Document (PDF, JPG, PNG — 10 Mo max.)')}
            </label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
              className="block w-full text-sm text-gray-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !file}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? t('Envoi en cours…') : t('Soumettre la preuve')}
          </button>
        </form>
      </div>
    </div>
  )
}
