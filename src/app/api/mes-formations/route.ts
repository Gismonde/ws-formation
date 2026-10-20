// api/mes-formations/route.ts — formations proposées à l'employé connecté (ex. pour soumettre une preuve)
import { NextResponse } from "next/server"
import { getActeur, serviceClient } from "@/lib/permissions"
import { getEspace } from "@/lib/espace"

export async function GET() {
  const moi = await getActeur()
  if (!moi) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const sb = serviceClient()
  const espace = await getEspace(moi)

  // 1. Les formations qui lui sont assignées (dans l'espace actif)
  const { data: assignations } = await sb.from("assignations").select("formation_id").eq("employe_id", moi.id)
  const formationIds = (assignations ?? []).map((a: { formation_id: string }) => a.formation_id)

  let formations: { id: string; titre: string; obligatoire: boolean | null }[] = []
  if (formationIds.length > 0) {
    const { data } = await sb.from("formations").select("id, titre, obligatoire")
      .in("id", formationIds).in("clinique", espace.cliniquesContenu)
    formations = data ?? []
  }

  // 2. Aucune assignation : seulement les formations PUBLIÉES de sa clinique (jamais celles de l'autre clinique ni les brouillons)
  if (formations.length === 0) {
    const { data } = await sb.from("formations").select("id, titre, obligatoire")
      .eq("publiee", true).in("clinique", espace.cliniquesContenu).order("titre")
    formations = data ?? []
  }

  return NextResponse.json({ formations })
}
