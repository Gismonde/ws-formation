import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/permissions'
import { CliniqueLogos } from '@/components/CliniqueBadge'
import { ROLE_LABEL, Role, cliniquesDe, CLINIQUE_INFO } from '@/lib/cliniques'
import { i18n } from '@/lib/i18n/serveur'
import ChoixPronoms from './ChoixPronoms'

export default async function ProfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { t, loc } = await i18n()

  // Lecture de SON propre dossier uniquement (filtré sur l'utilisateur connecté)
  const { data: employe } = await serviceClient()
    .from('employes')
    .select('*, departements(nom)')
    .eq('auth_user_id', user.id)
    .single()

  if (!employe) redirect('/login')

  const initiales = ((employe.prenom?.[0] ?? '') + (employe.nom?.[0] ?? '')).toUpperCase()
  // L'admin global (sans clinique) voit les deux cliniques
  const cliniqueAffichee = employe.clinique ?? (employe.role === 'super_admin' ? 'LES_DEUX' : null)
  const cliniques = cliniquesDe(cliniqueAffichee)
  const nomDepartement = (employe as any).departements?.nom ?? employe.departement ?? '-'

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1a1f36', margin: 0 }}>{t('Profil')}</h1>
        <p style={{ color: '#6b7280', marginTop: '4px', fontSize: '14px' }}>{t('Vos informations personnelles')}</p>
      </div>
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ background: 'var(--degrade-clinique)', height: '100px', position: 'relative' }}>
          <div style={{ position: 'absolute', bottom: '-32px', left: '32px', width: '64px', height: '64px', borderRadius: '50%', background: '#fff', border: '3px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: '700', color: 'var(--accent-clinique)' }}>
            {initiales}
          </div>
        </div>
        <div style={{ padding: '48px 32px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px', flexWrap: 'wrap', marginBottom: '24px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1a1f36', margin: '0 0 4px 0' }}>
                {employe.prenom} {employe.nom}
                {employe.pronoms && <span style={{ fontSize: '14px', fontWeight: 500, color: '#6b7280', marginLeft: '8px' }}>({employe.pronoms})</span>}
              </h2>
              <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>{employe.poste ?? t('Employé')}</p>
            </div>
            <CliniqueLogos clinique={cliniqueAffichee} hauteur={56} />
          </div>
          <div className='grille-2-colonnes' style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {([
              [t('Courriel'), employe.email],
              [t('Clinique'), cliniques.length ? cliniques.map(c => CLINIQUE_INFO[c].nom).join(' + ') : '-'],
              [t('Rôle'), (ROLE_LABEL[employe.role as Role] ? t(ROLE_LABEL[employe.role as Role]) : employe.role) + (employe.externe ? ' · ' + t('Membre externe') + (employe.organisation ? ` (${employe.organisation})` : '') : '')],
              [t('Département'), nomDepartement],
              [t('Poste'), employe.poste ?? '-'],
              [t('Date d’embauche'), employe.date_embauche ? new Date(employe.date_embauche).toLocaleDateString(loc) : '-'],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} style={{ background: '#f9fafb', borderRadius: '8px', padding: '14px 16px' }}>
                <p style={{ fontSize: '11px', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 4px 0' }}>{label}</p>
                <p style={{ fontSize: '14px', fontWeight: '500', color: '#1a1f36', margin: 0 }}>{value}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '16px' }}><ChoixPronoms initial={(employe as { pronoms?: string | null }).pronoms ?? null} /></div>
        </div>
      </div>
    </div>
  )
}
