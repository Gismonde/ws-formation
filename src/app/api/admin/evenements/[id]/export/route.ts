// Export Excel des inscriptions d'un événement (une feuille par séance).
import { getActeur, serviceClient } from '@/lib/permissions'
import { chargerEvenement } from '@/lib/evenements'
import { peutGererEvenement } from '@/lib/evenements-admin'
import { classeurExcel, nomFichier, reponseFichier, type Feuille } from '@/lib/export-tableur'

type Ligne = { nom: string; email: string; poste: string; statut: string; present: string; inscrit_le: string }

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acteur = await getActeur()
  const sb = serviceClient()
  const d = await chargerEvenement(sb, id)
  if (!acteur || !d || !peutGererEvenement(acteur, d.ev)) return new Response('Introuvable', { status: 404 })
  const ids = Array.from(new Set(d.inscriptions.map(i => i.employe_id)))
  const { data: emps } = ids.length ? await sb.from('employes').select('id, prenom, nom, email, poste').in('id', ids) : { data: [] }
  const e = new Map((emps ?? []).map(x => [x.id, x]))
  const f = (iso: string) => new Date(iso).toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Toronto' })
  const feuilles: Feuille<Ligne>[] = d.seances.map(s => ({
    nom: f(s.debut).replace(/[/:]/g, '-') + (s.annulee ? ' annulée' : ''),
    colonnes: [
      { titre: 'Nom', valeur: l => l.nom, largeur: 28 }, { titre: 'Courriel', valeur: l => l.email, largeur: 32 },
      { titre: 'Poste', valeur: l => l.poste, largeur: 24 }, { titre: 'Statut', valeur: l => l.statut, largeur: 16 },
      { titre: 'Présence', valeur: l => l.present, largeur: 12 }, { titre: 'Inscrit le', valeur: l => l.inscrit_le, largeur: 18 },
    ],
    lignes: d.inscriptions.filter(i => i.seance_id === s.id && i.statut !== 'annule')
      .sort((a, b) => a.statut.localeCompare(b.statut) || a.inscrit_le.localeCompare(b.inscrit_le))
      .map(i => {
        const p = e.get(i.employe_id)
        return {
          nom: `${p?.prenom ?? ''} ${p?.nom ?? ''}`.trim(), email: p?.email ?? '', poste: p?.poste ?? '',
          statut: i.statut === 'inscrit' ? 'Inscrit' : 'Liste d’attente', present: i.present === true ? 'Présent' : i.present === false ? 'Absent' : '',
          inscrit_le: f(i.inscrit_le),
        }
      }),
  }))
  const buf = await classeurExcel(feuilles.length ? feuilles : [{ nom: 'Inscriptions', colonnes: [], lignes: [] }], { titre: d.ev.titre })
  return reponseFichier(buf, nomFichier(`inscriptions-${d.ev.titre}`, 'xlsx'))
}
