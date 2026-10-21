import { redirect } from 'next/navigation'
import { getActeur, serviceClient, filtrerEmployes, cliniquesContenuVisibles } from '@/lib/permissions'
import { cliniqueAffichee, CLINIQUE_EMPLOYE_LABEL } from '@/lib/cliniques'
import { peutPublierPolitiques, peutGererPolitique, type Politique } from '@/lib/politiques'
import { chargerEtatsFormations, estComplete } from '@/lib/etat-formations'
import { peutGererJournees, CHAMPS_JOURNEE, RAISONS_JOURNEE, type Journee } from '@/lib/journees'
import JourneesClient, { type Suivi } from './JourneesClient'

export default async function JourneesPage() {
  const acteur = await getActeur()
  if (!acteur) redirect('/login')
  if (!peutGererJournees(acteur)) redirect('/dashboard/accueil')
  const sb = serviceClient()
  const visibles = cliniquesContenuVisibles(acteur)
  const politiquesPermises = peutPublierPolitiques(acteur)

  const [{ data: formations }, { data: politiques }, { data: librairie }, { data: employes }, { data: journees, error }] = await Promise.all([
    sb.from('formations').select('id, titre, categorie, clinique, publiee').in('clinique', visibles).order('titre'),
    politiquesPermises ? sb.from('politiques').select('*').eq('actif', true).order('titre') : Promise.resolve({ data: [] as Politique[] }),
    sb.from('librairie').select('id, titre, type, categorie').eq('archive', false).in('clinique', visibles).order('titre'),
    filtrerEmployes(sb.from('employes').select('id, prenom, nom, role, clinique, departements(nom)').or('actif.is.null,actif.eq.true').order('nom'), acteur),
    sb.from('journees_formation').select(CHAMPS_JOURNEE).in('clinique', visibles).order('cree_le', { ascending: false }).limit(200),
  ])
  const migration = !!error && /journees_formation/.test(error.message)
  const liste = (journees ?? []) as Journee[]

  // Avancement des journées lancées : employés ayant tout complété (formations + politiques confirmées)
  const lancees = liste.filter(j => !j.modele)
  const tousEmployes = Array.from(new Set(lancees.flatMap(j => j.employe_ids)))
  const toutesFormations = Array.from(new Set(lancees.flatMap(j => j.formation_ids)))
  const toutesPolitiques = Array.from(new Set(lancees.flatMap(j => j.politique_ids)))
  const etat = await chargerEtatsFormations(sb, tousEmployes, toutesFormations)
  const { data: pols } = toutesPolitiques.length ? await sb.from('politiques').select('id, version').in('id', toutesPolitiques) : { data: [] as { id: string; version: number }[] }
  const { data: confs } = toutesPolitiques.length && tousEmployes.length
    ? await sb.from('politiques_confirmations').select('employe_id, politique_id, version').in('politique_id', toutesPolitiques).in('employe_id', tousEmployes)
    : { data: [] as { employe_id: string; politique_id: string; version: number }[] }
  const confirmee = (e: string, p: string) => (confs ?? []).some(c => c.employe_id === e && c.politique_id === p && c.version === (pols ?? []).find(x => x.id === p)?.version)
  const nomEmploye = new Map((employes ?? []).map(e => [e.id as string, `${e.prenom ?? ''} ${e.nom ?? ''}`.trim()]))
  const suivi: Record<string, Suivi[]> = {}
  for (const j of lancees) {
    suivi[j.id] = j.employe_ids.map(e => {
      const faits = j.formation_ids.filter(f => estComplete(etat(e, f).statut)).length + j.politique_ids.filter(p => confirmee(e, p)).length
      return { employe_id: e, nom: nomEmploye.get(e) ?? 'Employé archivé ou hors de votre périmètre', faits, total: j.formation_ids.length + j.politique_ids.length }
    })
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
