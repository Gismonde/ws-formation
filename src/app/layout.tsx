import type { Metadata } from "next"
import Link from "next/link"
import "./globals.css"
import { i18n } from "@/lib/i18n/serveur"
import { FournisseurLangue } from "@/lib/i18n/client"
import { FournisseurConfirmation } from "@/components/Confirmation"
import ModeHorsLigne from "@/components/ModeHorsLigne"
import { getActeur } from "@/lib/permissions"
import { getEspace } from "@/lib/espace"

// Icône de l'onglet : CMC dans l'espace CMC, WS ailleurs (WSSC, les deux, administration globale)
export async function generateMetadata(): Promise<Metadata> {
  const acteur = await getActeur().catch(() => null)
  const espace = acteur ? await getEspace(acteur).catch(() => null) : null
  const cmc = espace?.actif === "CMC"
  return {
    title: "WS Formation",
    description: "Plateforme de formations en ligne",
    appleWebApp: { capable: true, title: "WS Formation", statusBarStyle: "default" },
    icons: {
      icon: [{ url: cmc ? "/icones/cmc.png" : "/icones/ws.png", type: "image/png", sizes: "512x512" }],
      apple: [{ url: cmc ? "/icones/cmc-apple.png" : "/icones/ws-apple.png", sizes: "180x180" }],
    },
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { langue, t } = await i18n()
  const acteur = await getActeur().catch(() => null)
  return (
    <html lang={langue}>
      <body style={{ display: "flex", flexDirection: "column", minHeight: "100vh", margin: 0 }}>
        <FournisseurLangue langue={langue}>
        <FournisseurConfirmation>
          <ModeHorsLigne utilisateur={acteur?.id ?? null} />
          <main style={{ flex: 1 }}>
            {children}
          </main>

          <footer style={{
            borderTop: "1px solid #e5e7eb",
            padding: "16px 24px",
            background: "#f9fafb",
            fontSize: "12px",
            color: "#6b7280",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
          }}>
            <span>
              &copy; {new Date().getFullYear()} WS Formation
            </span>
            <span style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
              <Link href="/confidentialite" style={{ color: "#6b7280", textDecoration: "underline" }}>
                {t("Politique de confidentialité")}
              </Link>
              <a href="mailto:confidentialite@wssurgical.com" style={{ color: "#6b7280", textDecoration: "underline" }}>
                {t("RPP")}: confidentialite@wssurgical.com
              </a>
            </span>
          </footer>
        </FournisseurConfirmation>
        </FournisseurLangue>
      </body>
    </html>
  )
}
