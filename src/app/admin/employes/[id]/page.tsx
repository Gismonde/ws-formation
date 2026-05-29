import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient } from "@supabase/supabase-js"
import { redirect, notFound } from "next/navigation"
import { headers } from "next/headers"
import EditEmployeForm from "./EditEmployeForm"

export default async function EditEmployePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Use service role client to bypass RLS (avoids 42P17 infinite recursion)
  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: emp } = await adminSupabase
    .from("employes")
    .select("role")
    .eq("auth_user_id", user.id)
    .single()

  if (!emp || (emp.role !== "admin" && emp.role !== "gestionnaire")) redirect("/admin")

  const { data: employe } = await adminSupabase
    .from("employes")
    .select("*, departements(id, nom)")
    .eq("id", id)
    .single()

  if (!employe) notFound()

  const { data: departements } = await adminSupabase
    .from("departements")
    .select("id, nom")
    .order("nom")

  // Journal de consultation (Loi 25 - tracabilite des acces)
  const headersList = await headers()
  const ipRaw = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || null
  const ipAddress = ipRaw ? ipRaw.split(",")[0].trim() : null
  const userAgent = headersList.get("user-agent") || null

  await adminSupabase.from("audit_logs").insert({
    acteur_id: user.id,
    type_action: "CONSULTATION_DOSSIER",
    description: "Consultation du dossier employe par " + (emp.role || "inconnu"),
    cible_employe_id: id,
    ip_address: ipAddress,
    user_agent: userAgent,
    metadata: { page: "/admin/employes/" + id, role_consultant: emp.role },
  })

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <div className="mb-6">
        <a href="/admin/employes" className="text-sm text-blue-600 hover:underline">← Retour aux employes</a>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Modifier l&apos;employe</h1>
        <p className="text-gray-500 text-sm mt-1">{employe.prenom} {employe.nom}</p>
      </div>
      <EditEmployeForm employe={employe} departements={departements || []} />
    </div>
  )
    }
