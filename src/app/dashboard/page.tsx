import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getEspace } from '@/lib/espace'
import { serviceClient } from '@/lib/permissions'
import { chargerEtatsFormations, estComplete } from '@/lib/etat-formations'
import { prerequisManquants } from '@/lib/prerequis'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let { data: employe, error: empError } = await supabase
    .from('employes')
    .select('id, prenom, nom, role, clinique, departement, poste, email, actif')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!employe && !empError && user.email) {
    const { data: employeByEmail } = await supabase
      .from('employes')
      .select('id, prenom, nom, role, clinique, departement, poste, email, actif')
      .eq('email', user.email)
      .maybeSingle()
    if (employeByEmail) {
      await supabase.from('employes').update({ auth_user_id: user.id }).eq('id', employeByEmail.id)
      employe = employeByEmail
    }
  }

  if (empError) {
    return (
      <div style={{ textAlign: 'center', padding: '48px' }}>
        <p style={{ color: '#dc2626' }}>Erreur de configuration. Contactez votre administrateur.</p>
      </div>
    )
  }

  if (!employe) redirect('/login')

  const { data: assignations } = await supabase
    .from('assignations')
    .select('formation_id, date_assignation')
    .eq('employe_id', employe.id)

  const assignedIds = assignations?.map((a: any) => a.formation_id) ?? []

  // Seulement les formations de l'espace actif (CMC ou WSSC) + celles communes aux deux cliniques
  const espace = await getEspace(employe)

  let formations: any[] = []
  if (assignedIds.length > 0) {
    const { data } = await supabase
      .from('formations')
      .select('*')
      .eq('publiee', true)
      .in('id', assignedIds)
      .in('clinique', espace.cliniquesContenu)
      .order('created_at', { ascending: false })
    formations = data ?? []
  }

  const { data: progressions } = await supabase
    .from('progressions')
    .select('formation_id, module_id, statut, updated_at')
    .eq('employe_id', employe.id)

  const { data: certificats } = await supabase
    .from('certificats')
    .select('formation_id, numero_certificat, date_emission')
    .eq('employe_id', employe.id)

  const certMap = new Map(certificats?.map((c: any) => [c.formation_id, c]) ?? [])

  // Récupérer les résultats de questionnaire pour les formations terminées
  // Dernier résultat de questionnaire par formation
  const { data: questionnairesF } = await supabase
    .from('questionnaires').select('id, formation_id').eq('actif', true)
  const formationDuQ = new Map((questionnairesF ?? []).map((q: any) => [q.id, q.formation_id]))
  const { data: tentativesBrutes } = await supabase
    .from('tentatives_questionnaire')
    .select('*')
    .eq('employe_id', employe.id)
    .order('date_fin', { ascending: false })
  const resultats = (tentativesBrutes ?? [])
    .filter((t: any) => t.annulee !== true && formationDuQ.has(t.questionnaire_id))
    .map((t: any) => ({
      formation_id: formationDuQ.get(t.questionnaire_id),
      score: t.note_maximale ? Math.round((Number(t.note_obtenue ?? 0) / Number(t.note_maximale)) * 100) : 0,
      reussi: t.reussi === true,
    }))
  const resultatMap = new Map<string, any>()
  resultats?.forEach((r: any) => {
    if (!resultatMap.has(r.formation_id)) resultatMap.set(r.formation_id, r)
  })

  // Avancement réel (leçons ou modules, certificat) et verrouillage par prérequis
  const sb = serviceClient()
  const etat = await chargerEtatsFormations(sb, [employe.id], formations.map((f: any) => f.id))
  const formationsAvecProgression = await Promise.all(
    formations.map(async (f: any) => {
      const e = etat(employe.id, f.id)
      const certif = certMap.get(f.id) ?? null
      const resultat = resultatMap.get(f.id) ?? null
      const derniereProg = progressions
        ?.filter((p: any) => p.formation_id === f.id && p.updated_at)
        .sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0]
      const prerequis = e.progression > 0 ? [] : await prerequisManquants(sb, employe.id, f.id)
      return {
        ...f,
        progressionPct: estComplete(e.statut) ? 100 : Math.min(e.progression, 99),
        certifie: e.certificat_valide, certif, resultat,
        derniereActivite: derniereProg?.updated_at ?? e.certificat?.date_emission ?? null,
        verrouillee: prerequis.length > 0,
        prerequis: prerequis.map(p => p.titre),
      }
    })
  )

  const enCours = formationsAvecProgression.filter(f => f.progressionPct < 100)
  const terminees = formationsAvecProgression.filter(f => f.progressionPct === 100)

  const formatDate = (iso: string | null) => {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1a1f36', margin: 0 }}>Bonjour, {employe.prenom} !</h1>
        <p style={{ color: '#6b7280', marginTop: '4px', fontSize: '14px' }}>Voici vos formations assignées{espace.actif ? ` — espace ${espace.actif}` : ''}.</p>
      </div>

      {/* Compteurs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px' }}>
          <p style={{ fontSize: '28px', fontWeight: '700', color: 'var(--accent-clinique)', margin: 0 }}>{formationsAvecProgression.length}</p>
          <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Formation(s) assignée(s)</p>
        </div>
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px' }}>
          <p style={{ fontSize: '28px', fontWeight: '700', color: '#f59e0b', margin: 0 }}>{enCours.filter(f => f.progressionPct > 0).length}</p>
          <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>En cours</p>
        </div>
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px' }}>
          <p style={{ fontSize: '28px', fontWeight: '700', color: '#10b981', margin: 0 }}>{terminees.length}</p>
          <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Terminée(s)</p>
        </div>
      </div>

      {/* Section En cours / À faire */}
      {enCours.length > 0 && (
        <div style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1a1f36', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📚</span> Formations en cours ({enCours.length})
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
            {enCours.map((f: any) => (
              <Link key={f.id} href={'/formations/' + f.id} style={{ textDecoration: 'none' }}>
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', transition: 'box-shadow 0.15s' }}>
                  <div style={{ background: 'var(--degrade-clinique)', height: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    <span style={{ fontSize: '32px' }}>📚</span>
                    {f.verrouillee ? (
                      <span style={{ position: 'absolute', top: '8px', right: '8px', background: '#fff', color: '#92400e', fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px' }}>🔒 Verrouillée</span>
                    ) : f.progressionPct === 0 && (
                      <span style={{ position: 'absolute', top: '8px', right: '8px', background: '#fff', color: '#374151', fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px' }}>Nouveau</span>
                    )}
                  </div>
                  <div style={{ padding: '16px' }}>
                    <h3 style={{ fontWeight: '600', color: '#1a1f36', fontSize: '14px', margin: '0 0 4px 0' }}>{f.titre}</h3>
                    <p style={{ color: '#6b7280', fontSize: '12px', marginBottom: '12px' }}>{f.description?.slice(0, 60)}{f.description?.length > 60 ? '...' : ''}</p>
                    {f.verrouillee && (
                      <p style={{ color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '11px', padding: '6px 8px', margin: '0 0 12px' }}>
                        À faire d’abord : {f.prerequis.join(', ')}
                      </p>
                    )}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                        <span>Progression</span>
                        <span style={{ fontWeight: '500' }}>{f.progressionPct}%</span>
                      </div>
                      <div style={{ background: '#f3f4f6', borderRadius: '99px', height: '6px' }}>
                        <div style={{ height: '6px', borderRadius: '99px', background: 'var(--accent-clinique)', width: f.progressionPct + '%' }} />
                      </div>
                    </div>
                    {f.progressionPct > 0 && f.derniereActivite && (
                      <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '8px', marginBottom: 0 }}>
                        Dernière activité : {formatDate(f.derniereActivite)}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Section Terminées */}
      {terminees.length > 0 && (
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1a1f36', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>✅</span> Formations terminées ({terminees.length})
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
            {terminees.map((f: any) => (
              <Link key={f.id} href={'/formations/' + f.id} style={{ textDecoration: 'none' }}>
                <div style={{ background: '#fff', border: '1px solid #d1fae5', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer' }}>
                  <div style={{ background: 'linear-gradient(135deg, #10b981, #059669)', height: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    <span style={{ fontSize: '32px' }}>✅</span>
                    {f.certifie && (
                      <span style={{ position: 'absolute', top: '8px', right: '8px', background: '#fbbf24', color: '#78350f', fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px' }}>🏆 Certifié</span>
                    )}
                  </div>
                  <div style={{ padding: '16px' }}>
                    <h3 style={{ fontWeight: '600', color: '#1a1f36', fontSize: '14px', margin: '0 0 4px 0' }}>{f.titre}</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '8px 0' }}>
                      <span style={{ background: '#d1fae5', color: '#065f46', fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px' }}>100% complété</span>
                      {f.resultat && (
                        <span style={{ background: f.resultat.reussi ? '#d1fae5' : '#fee2e2', color: f.resultat.reussi ? '#065f46' : '#991b1b', fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px' }}>
                          Score : {f.resultat.score}% {f.resultat.reussi ? '✓' : '✗'}
                        </span>
                      )}
                    </div>
                    {f.derniereActivite && (
                      <p style={{ fontSize: '11px', color: '#6b7280', margin: '6px 0 0' }}>
                        Complétée le {formatDate(f.derniereActivite)}
                      </p>
                    )}
                    <p style={{ fontSize: '12px', color: 'var(--accent-clinique)', marginTop: '8px', marginBottom: 0, fontWeight: '500' }}>
                      Revoir le contenu →
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {formationsAvecProgression.length === 0 && (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '48px', textAlign: 'center' }}>
          <p style={{ fontSize: '40px', marginBottom: '12px' }}>📚</p>
          <p style={{ color: '#6b7280', fontSize: '15px' }}>Aucune formation ne vous a encore été assignée dans cet espace.</p>
        </div>
      )}
    </div>
  )
}
