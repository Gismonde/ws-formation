import { redirect, notFound } from "next/navigation"
import { headers } from "next/headers"
import EditEmployeForm from "./EditEmployeForm"
import SuiviFormationsEmploye from "./SuiviFormationsEmploye"
import RenvoyerInvitation from "./RenvoyerInvitation"
import {
  getActeur, serviceClient, peutVoirEmploye, peutGererEmploye,
  departementsVisibles, rolesAttribuables, cliniquesAttribuables,
} from "@/lib/permissions"
import { aAccesAdmin } from "@/lib/cliniques"

export default async function EditEmployePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acteur = await getActeur()
  if (!acteur) redirect("/login")
  if (!aAccesAdmin(acteur.role)) redirect("/dashboard")

  const sb = serviceClient()
  const { data: employe } = await sb
    .from("employes")
    .select("*, departements(id, nom, clinique)")
    .eq("id", id)
    .single()

  // Hors périmètre : on répond comme si le dossier n'existait pas
  if (!employe || !peutVoirEmploye(acteur, employe)) notFound()

  const modifiable = peutGererEmploye(acteur, employe)
  const departements = await departementsVisibles(acteur, sb)
  // Le département actuel reste affiché même s'il est hors liste
  if (employe.departements && !departements.some(d => d.id === employe.departements.id)) {
    departements.push(employe.departements)
  }

  // Journal de consultation (Loi 25 - tracabilite des acces)
  const headersList = await headers()
  const ipRaw = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || null
  await sb.from("audit_logs").insert({
    acteur_id: acteur.id,
    type_action: "CONSULTATION_DOSSIER",
    description: "Consultation du dossier employé par " + acteur.role,
    cible_employe_id: id,
    ip_address: ipRaw ? ipRaw.split(",")[0].trim() : null,
    user_agent: headersList.get("user-agent") || null,
    metadata: { page: "/admin/employes/" + id, role_consultant: acteur.role },
  })

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <div className="mb-6">
        <a href="/admin/employes" className="text-sm text-blue-600 hover:underline">← Retour aux employés</a>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">{modifiable ? "Modifier l'employé" : "Dossier employé"}</h1>
        <p className="text-gray-500 text-sm mt-1">{employe.prenom} {employe.nom}</p>
      </div>
      <EditEmployeForm
        employe={employe}
        departements={departements}
        modifiable={modifiable}
        rolesPossibles={rolesAttribuables(acteur)}
        cliniquesPossibles={cliniquesAttribuables(acteur)}
        estGestionnaire={acteur.role === "gestionnaire"}
        afficherAutorisationCreation={acteur.role === "super_admin" || acteur.role === "admin"}
      />
      {modifiable && employe.actif !== false && <RenvoyerInvitation employeId={id} email={employe.email} />}
      <SuiviFormationsEmploye sb={sb} employeId={id} />
    </div>
  )
}
