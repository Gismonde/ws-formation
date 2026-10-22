import { NextRequest, NextResponse } from 'next/server'
import { getActeur, serviceClient } from '@/lib/permissions'
import { aAccesAdmin } from '@/lib/cliniques'
import { QUESTIONS_SONDAGE } from '@/lib/sondages'
import { chargerResultatsSondages, type LigneSondage } from '@/lib/sondages-admin'
import { classeurExcel, nomFichier, reponseFichier, type Colonne } from '@/lib/export-tableur'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const acteur = await getActeur()
  if (!acteur || !aAccesAdmin(acteur)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const { lignes } = await chargerResultatsSondages(serviceClient(), acteur)

  const colonnes: Colonne<LigneSondage>[] = [
    { titre: 'Formation', valeur: l => l.titre, largeur: 44 },
    { titre: 'Réponses', valeur: l => l.reponses, largeur: 10 },
    { titre: 'Satisfaits (%)', valeur: l => l.satisfaits, largeur: 12 },
    ...QUESTIONS_SONDAGE.map(q => ({ titre: q.texte, valeur: (l: LigneSondage) => l.moyennes[q.cle], largeur: 22 })),
  ]
  type Com = { titre: string; texte: string; date: string }
  const commentaires: Com[] = lignes.flatMap(l => l.commentaires.map(c => ({ titre: l.titre, ...c })))

  await logAudit({
    acteur_id: acteur.id, type_action: 'EXPORT_DONNEES', description: `Export des sondages de satisfaction (${lignes.length} formation(s))`,
    metadata: { rapport: 'sondages' }, ip_address: req.headers.get('x-forwarded-for'), user_agent: req.headers.get('user-agent'),
  })
  const xlsx = await classeurExcel([
    { nom: 'Résultats (moyennes sur 5)', colonnes, lignes },
    { nom: 'Commentaires', colonnes: [
      { titre: 'Formation', valeur: (c: Com) => c.titre, largeur: 40 },
      { titre: 'Date', valeur: (c: Com) => c.date.slice(0, 10), largeur: 12 },
      { titre: 'Commentaire', valeur: (c: Com) => c.texte, largeur: 90 },
    ], lignes: commentaires },
  ], { titre: 'Sondages de satisfaction' })
  return reponseFichier(xlsx, nomFichier('sondages-satisfaction', 'xlsx'))
}
