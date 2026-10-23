import { i18n } from '@/lib/i18n/serveur'
import { redirect } from 'next/navigation'
import { getActeur, serviceClient, filtrerEmployes, cliniquesContenuVisibles } from '@/lib/permissions'
import { cliniqueAffichee, CLINIQUE_EMPLOYE_LABEL } from '@/lib/cliniques'
import { peutPublierPolitiques, peutGererPolitique, type Politique } from '@/lib/politiques'
import { peutGererJournees, CHAMPS_JOURNEE, RAISONS_JOURNEE, avancementJournees, type Journee } from '@/lib/journees'
import JourneesClient, { type Suivi } from './JourneesClient'

export default async function JourneesPage() {
  const { t } = await i18n()
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!peutGererJournees(acteur)) redirect('/dashboard/accueil')
  const sb = serviceClient()
  const visibles = cliniquesContenuVisibles(acteur)
  const politiquesPermises = peutPublierPolitiques(acteur)

  const [{ data: formations }, { data: politiques }, { data: librairie }, { data: employes }, { data: journees, error }] = await Promise.all([
    sb.from('formations').select('id, titre, categorie, clinique, publiee').is('copie_de', null).in('clinique', visibles).order('titre'),
    politiquesPermises ? sb.from('politiques').select('*').eq('actif', true).order('titre') : Promise.resolve({ data: [] as Politique[] }),
    sb.from('librairie').select('id, titre, type, categorie').eq('archive', false).in('clinique', visibles).order('titre'),
    filtrerEmployes(sb.from('employes').select('id, prenom, nom, role, clinique, departements(nom)').or('actif.is.null,actif.eq.true').order('nom'), acteur),
    sb.from('journees_formation').select(CHAMPS_JOURNEE).in('clinique', visibles).order('cree_le', { ascending: false }).limit(200),
  ])
  const migration = !!error && /journees_formation/.test(error.message)
  const liste = (journees ?? []) as Journee[]

  // Avancement des journées lancées : employés ayant tout complété (formations + politiques confirmées)
  const lancees = liste.filter(j => !j.modele)
  const avancement = await avancementJournees(sb, lancees)
  const nomEmploye = new Map((employes ?? []).map(e => [e.id as string, `${e.prenom ?? ''} ${e.nom ?? ''}`.trim()]))
  const suivi: Record<string, Suivi[]> = {}
  for (const j of lancees) {
    suivi[j.id] = (avancement[j.id] ?? []).map(x => ({ ...x, nom: nomEmploye.get(x.employe_id) ?? 'Employé archivé ou hors de votre périmètre' }))
  }

  return (
    <JourneesClient
      migration={migration}
      raisons={[...RAISONS_JOURNEE]}
      cliniques={visibles}
      journees={liste}
      suivi={suivi}
      politiquesPermises={politiquesPermises}
      formations={(formations ?? []).map(f => ({ id: f.id, titre: f.titre, detail: [f.categorie, f.clinique === 'LES_DEUX' ? 'CMC + WSSC' : f.clinique, f.publiee ? null : 'brouillon'].filter(Boolean).join(' · ') }))}
      politiques={((politiques ?? []) as Politique[]).filter(p => peutGererPolitique(acteur, p)).map(p => ({ id: p.id, titre: p.titre, detail: `${CLINIQUE_EMPLOYE_LABEL[p.clinique]} · v${p.version}` }))}
      librairie={(librairie ?? []).map(l => ({ id: l.id, titre: l.titre, detail: [l.type === 'video' ? 'Vidéo' : l.type === 'lien' ? 'Lien' : 'Document', l.categorie].filter(Boolean).join(' · ') }))}
      employes={(employes ?? []).map(e => {
        const c = cliniqueAffichee(e.clinique, e.role)
        const d = e.departements as { nom?: string } | { nom?: string }[] | null
        return { id: e.id, titre: `${e.prenom ?? ''} ${e.nom ?? ''}`.trim(), detail: [c ? CLINIQUE_EMPLOYE_LABEL[c] : '', (Array.isArray(d) ? d[0]?.nom : d?.nom) ?? ''].filter(Boolean).join(' · ') }
      })}
    />
  )
}
