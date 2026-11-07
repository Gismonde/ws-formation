import { i18n } from '@/lib/i18n/serveur'
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdmin } from "@supabase/supabase-js"
import Link from "next/link"
import { cookies } from "next/headers"
import LienVue from "./LienVue"
import VueCartes, { type CarteFormation } from "./VueCartes"
import { concordances } from "@/lib/concordance-langues"
import SectionRepliable from "@/components/SectionRepliable"
import ToutReplier from "@/components/politiques/ToutReplier"
import { couleurCategorie } from "@/lib/politiques-categories"
import { redirect } from "next/navigation"
import { getActeur, peutCreerFormations, cliniquesContenuVisibles } from "@/lib/permissions"
import { CLINIQUE_INFO, estCliniqueContenu, type CliniqueContenu } from "@/lib/cliniques"

function BadgeCliniqueContenu({ c }: { c: CliniqueContenu }) {
  if (c === "LES_DEUX") {
    return <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "20px", fontSize: "11px", fontWeight: 700, background: "#f3f4f6", color: "#374151" }}>CMC + WSSC</span>
  }
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "20px", fontSize: "11px", fontWeight: 700, background: CLINIQUE_INFO[c].fond, color: CLINIQUE_INFO[c].couleur, border: `1px solid ${CLINIQUE_INFO[c].couleur}33` }}>
      {CLINIQUE_INFO[c].court}
    </span>
  )
}

const niveauStyles: Record<string, { bg: string; color: string; label: string }> = {
  debutant: { bg: "#f0fdf4", color: "#16a34a", label: "Débutant" },
  intermediaire: { bg: "#fefce8", color: "#ca8a04", label: "Intermédiaire" },
  avance: { bg: "#fff1f2", color: "#e11d48", label: "Avancé" },
}

export default async function AdminFormationsPage({ searchParams }: { searchParams: Promise<{ clinique?: string; vue?: string; statut?: string }> }) {
  const { t, loc } = await i18n()
  const { clinique: filtre, vue: vueDemandee, statut: statutDemande } = await searchParams
  const statut: "brouillon" | "publiee" | null = statutDemande === "brouillon" || statutDemande === "publiee" ? statutDemande : null
  const vueMemorisee = (await cookies()).get("ws_vue_formations")?.value
  const vue: "liste" | "cartes" = (vueDemandee ?? vueMemorisee) === "cartes" ? "cartes" : "liste"
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const adminSupabase = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: moi } = await adminSupabase
    .from("employes")
    .select("role")
    .eq("auth_user_id", user.id)
    .single()

  const acteur = await getActeur()
  if (!acteur) redirect("/login")
  const isAdmin = peutCreerFormations(acteur)

  // Chaque administrateur ne voit que les formations de sa (ses) clinique(s) + celles communes aux deux
  const visibles = cliniquesContenuVisibles(acteur)
  const onglets: CliniqueContenu[] = (["CMC", "WSSC", "LES_DEUX"] as CliniqueContenu[]).filter(c => visibles.includes(c))
  const filtreActif = estCliniqueContenu(filtre) && visibles.includes(filtre) ? filtre : null

  const { data: toutesAvecCopies } = await adminSupabase
    .from("formations")
    .select("*")
    .in("clinique", filtreActif ? [filtreActif] : visibles)
    .order("created_at", { ascending: false })
  // Copies de travail : pas listées à part, signalées sur leur formation publiée
  const avecCopie = new Set((toutesAvecCopies ?? []).map(f => f.copie_de).filter(Boolean))
  // Versions anglaises reliées : pas listées à part, signalées (badge EN) sur leur formation française
  const anglaiseDe = new Map((toutesAvecCopies ?? []).filter(f => f.version_de && !f.copie_de).map(f => [f.version_de as string, f]))
  const toutes = (toutesAvecCopies ?? []).filter(f => !f.copie_de && !f.version_de)
  const nbBrouillons = (toutes ?? []).filter(f => !f.publiee).length
  const nbPubliees = (toutes ?? []).length - nbBrouillons
  const formations = (toutes ?? []).filter(f => statut === null || (statut === "publiee") === !!f.publiee)

  const { data: modules } = await adminSupabase
    .from("modules")
    .select("id, formation_id")

  const { data: assignations } = await adminSupabase
    .from("assignations")
    .select("id, formation_id")

  // Concordance FR / EN de chaque formation qui a une version anglaise (pastille ⚠ en cas d'écart)
  const conc = await concordances(adminSupabase, Array.from(anglaiseDe.entries()).map(([fr, en]) => ({ fr, en: en.id as string })))

  const nbModules = (id: string) => modules?.filter((m: any) => m.formation_id === id).length ?? 0
  const nbAssign = (id: string) => assignations?.filter((a: any) => a.formation_id === id || a.formation_id === anglaiseDe.get(id)?.id).length ?? 0
  const badgeEN = (f: any) => {
    const en = anglaiseDe.get(f.id)
    if (!en) return null
    const c = conc.get(f.id)
    const alerte = !!c && (c.ecarts.length > 0 || c.fr_modifiee_apres)
    const titre = en.titre + (c?.ecarts.length ? " — " + t("{n} écart(s) de structure FR/EN", { n: c.ecarts.length }) : "") + (c?.fr_modifiee_apres ? " — " + t("Version française modifiée après la version anglaise") : "")
    return <Link href={`/admin/formations/${en.id}`} title={titre} style={{ marginLeft: "8px", fontSize: "11px", fontWeight: 700, color: alerte ? "#92400e" : "#075985", background: alerte ? "#fef3c7" : "#e0f2fe", padding: "1px 8px", borderRadius: "999px", textDecoration: "none" }}>FR · EN{alerte ? " ⚠" : ""}{en.publiee ? "" : " (" + t("brouillon") + ")"}</Link>
  }
  const lien = (c: CliniqueContenu | null, v: "liste" | "cartes", st: "brouillon" | "publiee" | null = statut) => {
    const q = new URLSearchParams()
    if (c) q.set("clinique", c)
    if (st) q.set("statut", st)
    if (v === "cartes") q.set("vue", "cartes")
    const s = q.toString()
    return "/admin/formations" + (s ? "?" + s : "")
  }

  // Données de la vue détaillée (filtres côté navigateur)
  const cartes: CarteFormation[] = ((toutes ?? []) as any[]).map(f => {
    const en = anglaiseDe.get(f.id); const c = conc.get(f.id)
    return {
      id: f.id, titre: f.titre, description: f.description ?? null, categorie: String(f.categorie ?? "").trim(), niveau: f.niveau ?? null,
      obligatoire: !!f.obligatoire, clinique: estCliniqueContenu(f.clinique) ? f.clinique : "LES_DEUX", publiee: !!f.publiee,
      statut_validation: f.statut_validation ?? null, image: f.image_couverture ?? null, modules: nbModules(f.id), assignations: nbAssign(f.id),
      duree: f.duree_estimee_minutes ?? null, tags: Array.isArray(f.tags) ? f.tags.map(String) : [], copie: avecCopie.has(f.id),
      en: en ? { id: en.id, titre: en.titre, publiee: !!en.publiee, ecarts: c?.ecarts.length ?? 0, fr_apres: !!c?.fr_modifiee_apres } : null,
    }
  })

  // Liste rangée par catégorie (ordre alphabétique ; « Sans catégorie » à la fin)
  const groupesCategorie = (() => {
    const m = new Map<string, any[]>()
    for (const f of (formations ?? []) as any[]) {
      const c = String(f.categorie ?? '').trim()
      if (!m.has(c)) m.set(c, [])
      m.get(c)!.push(f)
    }
    return Array.from(m.entries()).map(([nom, formations]) => ({ nom, formations }))
      .sort((x, y) => (x.nom ? 0 : 1) - (y.nom ? 0 : 1) || x.nom.localeCompare(y.nom, 'fr'))
  })()

  const ligneFormation = (f: any) => {
              const style = niveauStyles[f.niveau] ?? { bg: "#f3f4f6", color: "#6b7280", label: f.niveau }
              return (
                <tr key={f.id} className="formations-row" style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "14px 20px", fontWeight: "500", color: "#111827" }}><Link href={`/admin/formations/${f.id}`} style={{ color: "inherit", textDecoration: "none" }}>{f.titre}</Link>{badgeEN(f)}{avecCopie.has(f.id) && <span style={{ marginLeft: "8px", fontSize: "11px", fontWeight: 700, color: "#6d28d9", background: "#ede9fe", padding: "1px 8px", borderRadius: "999px" }}>✏️ {t("Copie de travail en cours")}</span>}</td>
                  <td style={{ padding: "14px 16px" }}><BadgeCliniqueContenu c={estCliniqueContenu(f.clinique) ? f.clinique : "LES_DEUX"} /></td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{
                      display: "inline-block",
                      padding: "2px 10px",
                      borderRadius: "999px",
                      background: style.bg,
                      color: style.color,
                      fontSize: "12px",
                      fontWeight: "600",
                    }}>{t(style.label)}</span>
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}>
                    {f.obligatoire
                      ? <span style={{ color: "#dc2626", fontWeight: "700", fontSize: "16px" }}>✓</span>
                      : <span style={{ color: "#d1d5db" }}>—</span>}
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "center", color: "#6b7280" }}>{nbModules(f.id)}</td>
                  <td style={{ padding: "14px 16px", textAlign: "center", color: "#6b7280" }}>{nbAssign(f.id)}</td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}>
                    <span style={{
                      display: "inline-block",
                      padding: "2px 10px",
                      borderRadius: "999px",
                      background: f.publiee ? "#f0fdf4" : "#f9fafb",
                      color: f.publiee ? "#16a34a" : "#9ca3af",
                      fontSize: "12px",
                      fontWeight: "600",
                    }}>{f.publiee ? t("Publié") : t("Brouillon")}</span>
                    {f.statut_validation && f.statut_validation !== "brouillon" && !(f.publiee && f.statut_validation === "approuvee") ? <div style={{ fontSize: "11px", marginTop: "3px", color: f.statut_validation === "approuvee" ? "#166534" : f.statut_validation === "a_modifier" ? "#b91c1c" : "#92400e" }}>{f.statut_validation === "approuvee" ? t("Approuvée") : f.statut_validation === "a_modifier" ? t("Modifications demandées") : t("En validation")}</div> : null}
                    {f.publiee && f.version ? <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "3px", whiteSpace: "nowrap" }}>v{f.version}{f.version_le ? " · " + new Date(f.version_le).toLocaleDateString(loc, { dateStyle: "medium" }) : ""}</div> : null}
                  </td>
                  <td style={{ padding: "14px 20px", textAlign: "right", whiteSpace: "nowrap" }}>
                    <Link href={`/admin/formations/${f.id}`} style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "6px 14px",
                      background: "#f3f4f6",
                      color: "#374151",
                      borderRadius: "6px",
                      textDecoration: "none",
                      fontSize: "13px",
                      fontWeight: "500",
                    }}>
                      {t('Gérer →')}
                    </Link>
                    <Link href={`/admin/assigner?formations=${f.id}`} style={{ marginLeft: "6px", padding: "6px 12px", background: "#eef2ff", color: "#4f46e5", borderRadius: "6px", textDecoration: "none", fontSize: "13px", fontWeight: 500 }}>
                      {t('Assigner')}
                    </Link>
                  </td>
                </tr>
              )
  }

  return (
    <div>
      <style>{`
        .formations-row:hover { background: #fafafa; }
      `}</style>

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "16px", marginBottom: "28px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "700", color: "#111827", margin: 0, letterSpacing: "-0.5px" }}>
            {t('Formations')}
          </h1>
          <p style={{ color: "#6b7280", fontSize: "14px", marginTop: "4px", margin: "4px 0 0 0" }}>
            {t('{n} formation(s) disponible(s)', { n: formations?.length ?? 0 })}
          </p>
        </div>
        {isAdmin && (
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <Link href="/admin/formations/creer" style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "10px 18px",
              background: "#6366f1",
              color: "#fff",
              borderRadius: "8px",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: "600",
              boxShadow: "0 2px 8px rgba(99,102,241,0.35)",
            }}>
              {t('+ Nouvelle formation')}
            </Link>
          </div>
        )}
      </div>

      {/* Filtre par clinique */}
      {onglets.length > 1 && (
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
          {[{ v: null as CliniqueContenu | null, l: t("Toutes") }, ...onglets.map(c => ({ v: c as CliniqueContenu | null, l: c === "LES_DEUX" ? t("Communes (CMC + WSSC)") : CLINIQUE_INFO[c].nom }))].map(o => {
            const actif = o.v === filtreActif
            return (
              <Link key={o.l} href={lien(o.v, vue)} style={{
                padding: "6px 14px", borderRadius: "999px", fontSize: "13px", fontWeight: 600, textDecoration: "none",
                background: actif ? "#111827" : "#fff", color: actif ? "#fff" : "#374151", border: "1px solid #e5e7eb",
              }}>{o.l}</Link>
            )
          })}
        </div>
      )}

      {/* Choix de la vue et filtre par statut */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
        <div role="group" aria-label={t('Statut')} style={{ display: "inline-flex", border: "1px solid #e5e7eb", borderRadius: "10px", background: "#fff", padding: "3px" }}>
          {([{ v: null, l: t('Toutes ({n})', { n: nbBrouillons + nbPubliees }) }, { v: "brouillon", l: t('Brouillons ({n})', { n: nbBrouillons }) }, { v: "publiee", l: t('Publiées ({n})', { n: nbPubliees }) }] as const).map(o => (
            <Link key={o.l} href={lien(filtreActif, vue, o.v)} style={{
              padding: "6px 14px", borderRadius: "7px", fontSize: "13px", fontWeight: 600, textDecoration: "none",
              background: statut === o.v ? "#111827" : "transparent", color: statut === o.v ? "#fff" : "#374151",
            }}>{o.l}</Link>
          ))}
        </div>
        <div role="group" aria-label={t('Affichage')} style={{ display: "inline-flex", border: "1px solid #e5e7eb", borderRadius: "10px", background: "#fff", padding: "3px" }}>
          {([{ v: "liste", l: t('☰ Liste') }, { v: "cartes", l: t('▦ Vue détaillée') }] as const).map(o => (
            <LienVue key={o.v} href={lien(filtreActif, o.v) + (o.v === "liste" ? (lien(filtreActif, o.v).includes("?") ? "&" : "?") + "vue=liste" : "")} vue={o.v} actif={vue === o.v} style={{
              padding: "6px 14px", borderRadius: "7px", fontSize: "13px", fontWeight: 600, textDecoration: "none",
              background: vue === o.v ? "#111827" : "transparent", color: vue === o.v ? "#fff" : "#374151",
            }}>{o.l}</LienVue>
          ))}
        </div>
      </div>

      {vue === "cartes" && <VueCartes formations={cartes} statutInitial={statut ?? ""} />}

      {/* Liste : formations rangées par catégorie, en sections repliables (la vue détaillée a ses propres filtres : VueCartes) */}
      {vue === "liste" && (
        (!formations || formations.length === 0) ? (
          <div style={{ background: "#fff", borderRadius: "16px", border: "1px solid #e5e7eb", padding: "48px", textAlign: "center", color: "#9ca3af" }}>{t('Aucune formation pour le moment.')}</div>
        ) : (<>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "10px" }}><ToutReplier /></div>
          {groupesCategorie.map(g => (
            <SectionRepliable key={g.nom || '—'} couleur={g.nom ? couleurCategorie(g.nom) : "#9ca3af"} icone="📚" titre={g.nom || t('Sans catégorie')}
              sousTitre={t('{n} formation(s)', { n: g.formations.length })}
              detail={<span style={{ color: "#6b7280" }}>{t('{p} publiée(s) · {b} brouillon(s)', { p: g.formations.filter((f: any) => f.publiee).length, b: g.formations.filter((f: any) => !f.publiee).length })}</span>}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                <thead>
                  <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ textAlign: "left", padding: "12px 20px", fontWeight: "600", color: "#6b7280", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t('Titre')}</th>
                    <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: "600", color: "#6b7280", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t('Clinique')}</th>
                    <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: "600", color: "#6b7280", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t('Niveau')}</th>
                    <th style={{ textAlign: "center", padding: "12px 16px", fontWeight: "600", color: "#dc2626", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t('Oblig. LSST')}</th>
                    <th style={{ textAlign: "center", padding: "12px 16px", fontWeight: "600", color: "#6b7280", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t('Modules')}</th>
                    <th style={{ textAlign: "center", padding: "12px 16px", fontWeight: "600", color: "#6b7280", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t('Assignées')}</th>
                    <th style={{ textAlign: "center", padding: "12px 16px", fontWeight: "600", color: "#6b7280", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t('Statut')}</th>
                    <th style={{ padding: "12px 20px" }}></th>
                  </tr>
                </thead>
                  <tbody>{g.formations.map(ligneFormation)}</tbody>
                </table>
              </div>
            </SectionRepliable>
          ))}
        </>)
      )}
    </div>
  )
}
