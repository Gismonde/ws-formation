import type { Metadata } from "next"
import Link from "next/link"
import "./globals.css"
import { i18n } from "@/lib/i18n/serveur"
import { FournisseurLangue } from "@/lib/i18n/client"

export const metadata: Metadata = {
  title: "WS Formation",
  description: "Plateforme de formations en ligne",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { langue, t } = await i18n()
  return (
    <html lang={langue}>
      <body style={{ display: "flex", flexDirection: "column", minHeight: "100vh", margin: 0 }}>
        <FournisseurLangue langue={langue}>
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
        </FournisseurLangue>
      </body>
    </html>
  )
}
