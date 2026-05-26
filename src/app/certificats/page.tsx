import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function CertificatsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: employe } = await supabase.from('employes').select('id, prenom, nom').eq('auth_user_id', user.id).single()
  const { data: certificats } = await supabase.from('certificats').select('*, formations(titre, categorie, niveau)').eq('employe_id', employe?.id ?? '').eq('valide', true).order('date_emission', { ascending: false })
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/dashboard" className="text-gray-500 hover:text-gray-900 text-sm">← Dashboard</Link>
          <h1 className="font-semibold text-gray-900">Mes certificats</h1>
        </div>
      </nav>
      <main className="max-w-4xl mx-auto px-6 py-8">
        {!certificats?.length ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🎓</div>
            <p className="text-gray-500">Vous n'avez pas encore de certificats.</p>
            <Link href="/formations"><button className="mt-4 px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Voir les formations</button></Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            {certificats.map((cert: any) => (
              <div key={cert.id} className="bg-white border-2 border-purple-200 rounded-2xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <span className="text-3xl">🏆</span>
                  <span className="text-xs font-mono text-purple-600 bg-purple-50 px-2 py-1 rounded">{cert.numero_certificat}</span>
                </div>
                <p className="text-xs text-purple-500 font-medium uppercase tracking-wide mb-1">Certificat de compétence</p>
                <h3 className="text-lg font-bold text-gray-900 mb-1">{cert.formations?.titre}</h3>
                <p className="text-sm text-gray-500 mb-4">{cert.formations?.categorie}</p>
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm text-gray-600">Délivré à <span className="font-semibold">{(employe as any)?.prenom} {(employe as any)?.nom}</span></p>
                  <p className="text-xs text-gray-400 mt-1">Le {new Date(cert.date_emission).toLocaleDateString('fr-CA', {year:'numeric',month:'long',day:'numeric'})}</p>
                  {cert.note_finale && <p className="text-xs text-green-600 font-medium mt-1">Note : {Math.round(cert.note_finale)}%</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}