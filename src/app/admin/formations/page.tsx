import { createClient } from "@/lib/supabase/server"
import { createClient as createAdmin } from "@supabase/supabase-js"
import Link from "next/link"
import { redirect } from "next/navigation"

const niveauStyles: Record<string, { bg: string; color: string; label: string }> = {
  debutant: { bg: "#f0fdf4", color: "#16a34a", label: "Débutant" },
  intermediaire: { bg: "#fefce8", color: "#ca8a04", label: "Intermédiaire" },
  avance: { bg: "#fff1f2", color: "#e11d48", label: "Avancé" },
}

export default async function AdminFormationsPage() {
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

  const isAdmin = moi?.role === "admin"

  const { data: formations } = await adminSupabase
    .from("formations")
    .select("id, titre, categorie, niveau, publiee, obligatoire")
    .order("created_at", { ascending: false })

  const { data: modules } = await adminSupabase
    .from("modules")
    .select("id, formation_id")

  const { data: assignations } = await adminSupabase
    .from("assignations")
    .select("id, formation_id")

  const nbModules = (id: string) => modules?.filter((m: any) => m.formation_id === id).length ?? 0
  const nbAssign = (id: string) => assignations?.filter((a: any) => a.formation_id === id).length ?? 0

  return (
    <div>
      <style>{`
        .formations-row:hover { background: #fafafa; }
      `}</style>

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "700", color: "#111827", margin: 0, letterSpacing: "-0.5px" }}>
            Formations
          </h1>
          <p style={{ color: "#6b7280", fontSize: "14px", marginTop: "4px", margin: "4px 0 0 0" }}>
            {formations?.length ?? 0} formation(s) disponible(s)
          </p>
        </div>
        {isAdmin && (
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <Link href="/admin/formations/generer" style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "10px 18px",
              background: "#fff",
              color: "#2563eb",
              border: "2px solid #2563eb",
              borderRadius: "8px",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: "600",
            }}>
              Créer à partir d&apos;un document
            </Link>
            <Link href="/admin/formations/depuis-pp" style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "10px 18px",
              background: "#fff",
              color: "#7c3aed",
              border: "2px solid #7c3aed",
              borderRadius: "8px",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: "600",
            }}>
              Créer à partir d&apos;un PP
            </Link>
            <Link href="/admin/formations/nouvelle" style={{
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
              + Nouvelle formation
            </Link>
          </div>
        )}
      </div>

      {/* Formations table */}
      <div style={{
        background: "#fff",
        borderRadius: "16px",
        border: "1px solid #e5e7eb",
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
          <thead>
            <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
              <th style={{ textAlign: "left", padding: "12px 20px", fontWeight: "600", color: "#6b7280", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Titre</th>
              <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: "600", color: "#6b7280", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Categorie</th>
              <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: "600", color: "#6b7280", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Niveau</th>
              <th style={{ textAlign: "center", padding: "12px 16px", fontWeight: "600", color: "#dc2626", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Oblig. LSST</th>
              <th style={{ textAlign: "center", padding: "12px 16px", fontWeight: "600", color: "#6b7280", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Modules</th>
              <th style={{ textAlign: "center", padding: "12px 16px", fontWeight: "600", color: "#6b7280", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Assignees</th>
              <th style={{ textAlign: "center", padding: "12px 16px", fontWeight: "600", color: "#6b7280", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Statut</th>
              <th style={{ padding: "12px 20px" }}></th>
            </tr>
          </thead>
          <tbody>
            {formations?.map((f: any) => {
              const style = niveauStyles[f.niveau] ?? { bg: "#f3f4f6", color: "#6b7280", label: f.niveau }
              return (
                <tr key={f.id} className="formations-row" style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "14px 20px", fontWeight: "500", color: "#111827" }}>{f.titre}</td>
                  <td style={{ padding: "14px 16px", color: "#6b7280" }}>{f.categorie}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{
                      display: "inline-block",
                      padding: "2px 10px",
                      borderRadius: "999px",
                      background: style.bg,
                      color: style.color,
                      fontSize: "12px",
                      fontWeight: "600",
                    }}>{style.label}</span>
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
                    }}>{f.publiee ? "Publié" : "Brouillon"}</span>
                  </td>
                  <td style={{ padding: "14px 20px", textAlign: "right" }}>
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
                      Gérer →
                    </Link>
                  </td>
                </tr>
              )
            })}
            {(!formations || formations.length === 0) && (
              <tr>
                <td colSpan={8} style={{ padding: "48px", textAlign: "center", color: "#9ca3af" }}>
                  Aucune formation pour le moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
