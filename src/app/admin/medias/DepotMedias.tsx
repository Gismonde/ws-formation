'use client'

import { useState } from 'react'
import { useT } from '@/lib/i18n/client'

type Media = { nom: string; url: string }

export default function DepotMedias() {
  const { t } = useT()
  const [medias, setMedias] = useState<Media[]>([])
  const [survol, setSurvol] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const envoyer = async (fichiers: FileList | File[]) => {
    setErreur(null)
    setEnCours(true)
    for (const f of Array.from(fichiers)) {
      const fd = new FormData()
      fd.append('file', f)
      try {
        const r = await fetch('/api/upload-lesson-image', { method: 'POST', body: fd })
        const j = await r.json().catch(() => ({}))
        if (!r.ok || !j.url) setErreur(j.error || t('Échec du téléversement ({code})', { code: String(r.status) }))
        else setMedias(m => [{ nom: f.name, url: j.url }, ...m])
      } catch { setErreur(t('Échec du téléversement')) }
    }
    setEnCours(false)
  }

  return (
    <div className="space-y-4">
      <label
        onDragOver={e => { e.preventDefault(); setSurvol(true) }}
        onDragLeave={() => setSurvol(false)}
        onDrop={e => { e.preventDefault(); setSurvol(false); if (e.dataTransfer.files.length) envoyer(e.dataTransfer.files) }}
        data-depot-medias
        className={'flex flex-col items-center justify-center h-56 rounded-xl border-2 border-dashed cursor-pointer transition-colors ' + (survol ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 bg-white hover:bg-gray-50')}>
        <span className="text-3xl">🖼️</span>
        <span className="mt-2 text-sm font-medium text-gray-700">{enCours ? t('Téléversement…') : t('Glissez une image ou un GIF ici, ou cliquez pour choisir')}</span>
        <span className="text-xs text-gray-500 mt-1">{t('JPG, PNG, GIF ou WebP')}</span>
        <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple className="hidden" onChange={e => e.target.files && envoyer(e.target.files)} />
      </label>
      {erreur && <p className="text-sm text-red-600">{erreur}</p>}
      {medias.length > 0 && (
        <ul className="space-y-2" data-medias>
          {medias.map(m => (
            <li key={m.url} className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt="" className="w-20 h-12 object-cover rounded" />
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-gray-800 truncate">{m.nom}</span>
                <span className="block text-xs text-gray-500 truncate" data-url>{m.url}</span>
              </span>
              <button type="button" onClick={() => navigator.clipboard?.writeText(m.url)} className="text-sm text-indigo-600 hover:underline">{t('Copier le lien')}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
