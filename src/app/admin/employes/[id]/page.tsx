import { badgesEmploye } from "@/lib/badges"
import GrilleBadges from "@/components/GrilleBadges"
import { i18n } from '@/lib/i18n/serveur'
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { headers } from "next/headers"
import EditEmployeForm from "./EditEmployeForm"
import SuiviFormationsEmploye from "./SuiviFormationsEmploye"
import RenvoyerInvitation from "./RenvoyerInvitation"
import DeuxFacteurs from "./DeuxFacteurs"
import { chargerPostes, parFamille } from "@/lib/postes"
import ListePreuvesAdmin from "./ListePreuvesAdmin"
import ToggleActifButton from "../ToggleActifButton"
import { CliniqueBadge } from "@/components/CliniqueBadge"
import {
  getActeur, serviceClient, peutVoirEmploye, peutGererEmploye,
  departementsVisibles, rolesAttribuables, cliniquesAttribuables,
} from "@/lib/permissions"
import { aAccesAdmin, estAdministrateur } from "@/lib/cliniques"
import { chargerDossier } from "@/lib/dossier-employe"

const ONGLETS = [
  { id: "profil", libelle: "Profil" },
  { id: "formations", libelle: "Formations et progression" },
  { id: "certificats", libelle: "Certificats" },
  { id: "preuves", libelle: "Preuves" },
  { id: "politiques", libelle: "Politiques" },
  { id: "badges", libelle: "Badges et parcours" },
  { id: "journal", libelle: "Journal", adminSeulement: true },
] as const
type Onglet = (typeof ONGLETS)[number]["id"]

const jourEn = (loc: string) => (d: string | null) => (d ? new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString(loc, { dateStyle: "medium" }) : "—")
const momentEn = (loc: string) => (d: string | null) => (d ? new Date(d).toLocaleString(loc, { dateStyle: "medium", timeStyle: "short" }) : "—")

const COULEUR_STATUT: Record<string, string> = {
  non_commence: "bg-gray-100 text-gray-600",
  en_cours: "bg-amber-50 text-amber-700",
  termine: "bg-indigo-50 text-indigo-700",
  certifie: "bg-green-50 text-green-700",
}

export default async function FicheEmployePage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ onglet?: string }>
}) {
  const { t, loc } = await i18n()
  const jour = jourEn(loc)
  const moment = momentEn(loc)
  const { id } = await params
  const acteur = await getActeur()
  if (!acteur) redirect("/login")
  if (!aAccesAdmin(acteur)) redirect("/dashboard/accueil")

  const sb = serviceClient()
  const { data: employe } = await sb
    .from("employes")
    .select("*, departements(id, nom, clinique)")
    .eq("id", id)
    .single()

  // Hors périmètre : on répond comme si le dossier n'existait pas
  if (!employe || !peutVoirEmploye(acteur, employe)) notFound()

  const estAdmin = estAdministrateur(acteur.role)
  const onglets = ONGLETS.filter(o => !("adminSeulement" in o) || estAdmin)
  const demande = (await searchParams).onglet
  const onglet: Onglet = onglets.some(o => o.id === demande) ? (demande as Onglet) : "profil"

  const modifiable = peutGererEmploye(acteur, employe)
  const dossier = await chargerDossier(sb, id, { journal: onglet === "journal" && estAdmin })
  if (!dossier) notFound()
  const preuvesEnAttente = dossier.preuves.filter(p => p.statut === "en_attente").length
  const enRetard = dossier.formations.filter(f => f.en_retard).length

  // Journal de consultation (Loi 25 - traçabilité des accès)
  const headersList = await headers()
  const ipRaw = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || null
  await sb.from("audit_logs").insert({
    acteur_id: acteur.id,
    type_action: "CONSULTATION_DOSSIER",
    description: "Consultation du dossier employé par " + acteur.role,
    cible_employe_id: id,
    ip_address: ipRaw ? ipRaw.split(",")[0].trim() : null,
    user_agent: headersList.get("user-agent") || null,
    metadata: { page: "/admin/employes/" + id, onglet, role_consultant: acteur.role },
  })

  let contenu: React.ReactNode = null
  if (onglet === "profil") {
    const departements = await departementsVisibles(acteur, sb)
    if (employe.departements && !departements.some(d => d.id === employe.departements.id)) departements.push(employe.departements)
    contenu = (
      <>
        <EditEmployeForm
          employe={employe}
          departements={departements}
          modifiable={modifiable}
          rolesPossibles={rolesAttribuables(acteur)}
          cliniquesPossibles={cliniquesAttribuables(acteur)}
          estGestionnaire={acteur.role === "gestionnaire"}
          afficherAutorisationCreation={acteur.role === "super_admin" || acteur.role === "admin"}
          postes={parFamille(await chargerPostes(serviceClient()))}
        />
        {modifiable && employe.actif !== false && <RenvoyerInvitation employeId={id} email={employe.email} />}
        {acteur.role === "super_admin" && <DeuxFacteurs employeId={id} nom={`${employe.prenom} ${employe.nom}`} />}
      </>
    )
  } else if (onglet === "formations") {
    contenu = (
      <>
        {dossier.formations.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">{t('Aucune formation assignée.')}</div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="bg-gray-50 text-xs uppercase text-gray-500 text-left">
                  <th className="px-4 py-2.5 font-semibold">{t('Formation')}</th>
                  <th className="px-3 py-2.5 font-semibold">{t('Assignée le')}</th>
                  <th className="px-3 py-2.5 font-semibold">{t('Échéance')}</th>
                  <th className="px-3 py-2.5 font-semibold">{t('Statut')}</th>
                  <th className="px-3 py-2.5 font-semibold w-40">{t('Progression')}</th>
                  <th className="px-3 py-2.5 font-semibold">{t('Leçons')}</th>
                  <th className="px-3 py-2.5 font-semibold">{t('Certificat')}</th>
                </tr>
              </thead>
              <tbody>
                {dossier.formations.map(f => (
                  <tr key={f.formation_id} className="border-t border-gray-100">
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/formations/${f.formation_id}`} className="font-medium text-gray-900 hover:underline">{f.titre}</Link>
                      {f.obligatoire && <span className="ml-2 text-[10px] font-bold uppercase text-red-600">{t('Obligatoire')}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{jour(f.assignee_le)}</td>
                    <td className={"px-3 py-2.5 whitespace-nowrap " + (f.en_retard ? "text-red-600 font-semibold" : "text-gray-600")}>
                      {jour(f.echeance)}{f.en_retard ? ' · ' + t('en retard') : ''}
                    </td>
                    <td className="px-3 py-2.5"><span className={"text-xs font-semibold px-2 py-1 rounded-full " + COULEUR_STATUT[f.statut]}>{f.statut_libelle}</span></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full"><div className="h-2 rounded-full bg-indigo-500" style={{ width: `${f.progression}%` }} /></div>
                        <span className="text-xs text-gray-600 w-9 text-right">{f.progression} %</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">{f.lecons}</td>
                    <td className="px-3 py-2.5 text-xs font-mono text-gray-600">{f.certificat || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <SuiviFormationsEmploye sb={sb} employeId={id} />
      </>
    )
  } else if (onglet === "certificats") {
    contenu = dossier.certificats.length === 0
      ? <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">{t('Aucun certificat.')}</div>
      : (
        <>
        {(() => {
          // Heures de formation continue créditées, par année de délivrance du certificat
          const parAnnee = new Map<string, number>()
          for (const c of dossier.certificats) if (c.heures && c.etat !== 'Révoqué' && c.emis_le) parAnnee.set(c.emis_le.slice(0, 4), (parAnnee.get(c.emis_le.slice(0, 4)) ?? 0) + c.heures)
          if (parAnnee.size === 0) return null
          return (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4 flex flex-wrap gap-6 text-sm">
              <span className="font-semibold text-indigo-900">🎓 {t('Heures de formation continue créditées')}</span>
              {Array.from(parAnnee).sort((a, b) => b[0].localeCompare(a[0])).map(([an, h]) => (
                <span key={an} className="text-indigo-800">{an} : <strong>{String(Math.round(h * 100) / 100).replace('.', ',')} h</strong></span>
              ))}
            </div>
          )
        })()}
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase text-gray-500 text-left">
                <th className="px-4 py-2.5 font-semibold">{t('Formation')}</th>
                <th className="px-3 py-2.5 font-semibold">{t('Heures créditables')}</th>
                <th className="px-3 py-2.5 font-semibold">{t('Numéro')}</th>
                <th className="px-3 py-2.5 font-semibold">{t('Émis le')}</th>
                <th className="px-3 py-2.5 font-semibold">{t('Expire le')}</th>
                <th className="px-3 py-2.5 font-semibold">{t('Note')}</th>
                <th className="px-3 py-2.5 font-semibold">{t('État')}</th>
                <th className="px-3 py-2.5 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {dossier.certificats.map(c => (
                <tr key={c.numero + c.emis_le} className="border-t border-gray-100">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{c.formation}</td>
                  <td className="px-3 py-2.5 text-gray-600">{c.heures ? `${String(c.heures).replace('.', ',')} h${c.organisme ? ' · ' + c.organisme : ''}` : '—'}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">{c.numero}</td>
                  <td className="px-3 py-2.5 text-gray-600">{jour(c.emis_le)}</td>
                  <td className="px-3 py-2.5 text-gray-600">{c.expire_le ? jour(c.expire_le) : t('Permanent')}</td>
                  <td className="px-3 py-2.5 text-gray-600">{c.note != null ? `${c.note} %` : "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className={"text-xs font-semibold px-2 py-1 rounded-full " + (c.etat === "Valide" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>{c.etat}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    {c.etat !== "Révoqué" && <Link href={`/certificat/${c.id}`} className="text-xs font-semibold text-indigo-600 hover:underline">{t('🏆 Voir / télécharger')}</Link>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )
  } else if (onglet === "preuves") {
    contenu = <ListePreuvesAdmin preuves={dossier.preuves} peutDecider={acteur.id !== id} />
  } else if (onglet === "badges") {
    const badges = await badgesEmploye(sb, employe)
    contenu = <div className="bg-white rounded-2xl border border-gray-200 p-6"><GrilleBadges badges={badges} t={t} loc={loc} liens={false} /></div>
  } else if (onglet === "politiques") {
    contenu = dossier.politiques.length === 0
      ? <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">{t('Aucune politique confirmée.')}</div>
      : (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {dossier.politiques.map(p => (
            <div key={p.politique + p.version} className="px-4 py-3 flex flex-wrap items-center gap-3">
              <span className="font-medium text-gray-900 flex-1 min-w-[200px]">📜 {p.politique} <span className="text-xs text-gray-400">v{p.version}</span></span>
              <span className="text-xs text-green-700" title={p.texte}>{t('✅ Lu et compris le')}{' '}{moment(p.confirme_le)}</span>
            </div>
          ))}
        </div>
      )
  } else if (onglet === "journal") {
    contenu = (
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="bg-gray-50 text-xs uppercase text-gray-500 text-left">
              <th className="px-4 py-2.5 font-semibold">{t('Date')}</th>
              <th className="px-3 py-2.5 font-semibold">{t('Action')}</th>
              <th className="px-3 py-2.5 font-semibold">{t('Description')}</th>
              <th className="px-3 py-2.5 font-semibold">{t('Par')}</th>
            </tr>
          </thead>
          <tbody>
            {dossier.journal.slice(0, 200).map((j, i) => (
              <tr key={i} className="border-t border-gray-100 align-top">
                <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{moment(j.date)}</td>
                <td className="px-3 py-2 font-medium text-gray-800">{j.action}</td>
                <td className="px-3 py-2 text-gray-600">{j.description}</td>
                <td className="px-3 py-2 text-gray-600">{j.par}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
          {t('200 derniers événements affichés · l’export Excel en contient jusqu’à 500 ·')} <Link href={`/admin/audit?employes=${id}`} className="underline">{t('ouvrir dans le journal d’audit')}</Link>
        </p>
      </div>
    )
  }

  const p = dossier.profil
  return (
    <div className="max-w-5xl">
      <Link href="/admin/employes" className="text-sm text-indigo-600 hover:underline">{t('← Retour aux employés')}</Link>

      {/* En-tête du dossier */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mt-3 mb-4 flex flex-wrap items-start gap-4">
        <div className="w-14 h-14 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center text-lg font-bold flex-shrink-0">
          {((p.prenom[0] ?? "") + (p.nom[0] ?? "")).toUpperCase()}
        </div>
        <div className="flex-1 min-w-[220px]">
          <h1 className="text-xl font-bold text-gray-900">{p.prenom} {p.nom}</h1>
          <div className="text-sm text-gray-500 break-all">{p.email}{p.poste ? ` · ${p.poste}` : ""}</div>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">{p.role_libelle}</span>
            <CliniqueBadge clinique={employe.clinique} role={employe.role} />
            {p.departement && <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">{p.departement}</span>}
            <span className={"text-xs font-semibold px-2.5 py-1 rounded-full " + (p.actif ? "bg-green-50 text-green-700" : "bg-gray-200 text-gray-600")}>{p.actif ? "Actif" : "Archivé"}</span>
            {!p.invitation_acceptee && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">{t('Invitation non acceptée')}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href={`/api/admin/employes/export?ids=${id}&format=xlsx`} className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50">{t('⬇ Excel')}</a>
          <a href={`/api/admin/employes/export?ids=${id}&format=zip`} title={t('Classeur Excel et documents de preuves')} className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50">⬇ Dossier complet (ZIP)</a>
          {modifiable && <ToggleActifButton id={id} actif={p.actif} nom={`${p.prenom} ${p.nom}`} />}
        </div>
      </div>

      {/* Indicateurs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { v: dossier.formations.length, l: t('Formations assignées') },
          { v: dossier.formations.filter(f => f.statut === "termine" || f.statut === "certifie").length, l: "Terminées" },
          { v: enRetard, l: "En retard", alerte: enRetard > 0 },
          { v: dossier.certificats.filter(c => c.etat === "Valide").length, l: "Certificats valides" },
        ].map(k => (
          <div key={k.l} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <div className={"text-2xl font-bold " + (k.alerte ? "text-red-600" : "text-gray-900")}>{k.v}</div>
            <div className="text-xs text-gray-500">{k.l}</div>
          </div>
        ))}
      </div>

      {/* Onglets */}
      <nav className="flex gap-1 overflow-x-auto border-b border-gray-200 mb-5" aria-label={t('Sections du dossier')}>
        {onglets.map(o => {
          const actif = o.id === onglet
          const pastille = o.id === "preuves" && preuvesEnAttente > 0 ? preuvesEnAttente : null
          return (
            <Link key={o.id} href={`/admin/employes/${id}?onglet=${o.id}`} aria-current={actif ? "page" : undefined}
              className={"px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px " + (actif ? "border-indigo-600 text-indigo-700" : "border-transparent text-gray-500 hover:text-gray-800")}>
              {t(o.libelle)}
              {pastille && <span className="ml-1.5 text-[11px] bg-amber-500 text-white rounded-full px-1.5 py-0.5">{pastille}</span>}
            </Link>
          )
        })}
      </nav>

      {contenu}
    </div>
  )
}
