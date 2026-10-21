// Envoi de courriels. Deux fournisseurs possibles, choisis selon les variables Vercel :
//  - Mailgun (prioritaire) : MAILGUN_API_KEY, MAILGUN_DOMAIN (ex. « mg.wssurgical.com »),
//    MAILGUN_REGION (« us » par défaut, ou « eu »)
//  - Resend : RESEND_API_KEY
// Dans les deux cas : COURRIEL_EXPEDITEUR (ex. « WS Formation <formation@wssurgical.com> »).
// Sans ces variables, rien n'est envoyé et l'application continue de fonctionner normalement.

import { CLINIQUE_INFO, cliniquesDe } from '@/lib/cliniques'

export type Courriel = { a: string; sujet: string; html: string; texte: string }
type Resultat = { envoyes: number; erreur?: string }

function fournisseur(): 'mailgun' | 'resend' | null {
  if (!process.env.COURRIEL_EXPEDITEUR) return null
  if (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) return 'mailgun'
  if (process.env.RESEND_API_KEY) return 'resend'
  return null
}

export function courrielsActifs(): boolean {
  return fournisseur() !== null
}

/** Envoie un ou plusieurs courriels. Renvoie le nombre envoyés. */
export async function envoyerCourriels(courriels: Courriel[]): Promise<Resultat> {
  const f = fournisseur()
  if (!f || courriels.length === 0) return { envoyes: 0, erreur: f ? undefined : 'non_configure' }
  return f === 'mailgun' ? envoyerMailgun(courriels) : envoyerResend(courriels)
}

/** Mailgun : un message par destinataire (5 envois simultanés au maximum). */
async function envoyerMailgun(courriels: Courriel[]): Promise<Resultat> {
  const domaine = process.env.MAILGUN_DOMAIN!
  const hote = process.env.MAILGUN_REGION?.toLowerCase() === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net'
  const auth = 'Basic ' + Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64')
  let envoyes = 0
  let erreur: string | undefined
  for (let i = 0; i < courriels.length; i += 5) {
    await Promise.all(courriels.slice(i, i + 5).map(async c => {
      const corps = new URLSearchParams({ from: process.env.COURRIEL_EXPEDITEUR!, to: c.a, subject: c.sujet, html: c.html, text: c.texte })
      try {
        const res = await fetch(`${hote}/v3/${encodeURIComponent(domaine)}/messages`, {
          method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' }, body: corps,
        })
        if (res.ok) { envoyes++; return }
        const detail = await res.text().catch(() => '')
        console.error('[Courriels] Mailgun a refusé l’envoi', res.status, detail)
        erreur = `Envoi refusé (${res.status})`
      } catch (e) {
        console.error('[Courriels] Erreur réseau', e)
        erreur = 'Erreur réseau'
      }
    }))
    // Clé ou domaine invalide : inutile d'insister pour les suivants
    if (erreur && envoyes === 0 && /\((401|403|404)\)/.test(erreur)) break
  }
  return { envoyes, erreur }
}

/** Resend : par lots de 100. */
async function envoyerResend(courriels: Courriel[]): Promise<Resultat> {
  let envoyes = 0
  for (let i = 0; i < courriels.length; i += 100) {
    const lot = courriels.slice(i, i + 100).map(c => ({
      from: process.env.COURRIEL_EXPEDITEUR, to: [c.a], subject: c.sujet, html: c.html, text: c.texte,
    }))
    try {
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(lot),
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        console.error('[Courriels] Envoi refusé', res.status, detail)
        return { envoyes, erreur: `Envoi refusé (${res.status})` }
      }
      envoyes += lot.length
    } catch (e) {
      console.error('[Courriels] Erreur réseau', e)
      return { envoyes, erreur: 'Erreur réseau' }
    }
  }
  return { envoyes }
}

// ---------------------------------------------------------------------------
// Gabarit

const echapper = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

/** Gabarit sobre, compatible avec les clients de courriel (tableaux + styles en ligne). */
export function gabarit({ origine, clinique, titre, paragraphes, bouton, piedDePage }: {
  origine: string
  clinique: string | null
  titre: string
  paragraphes: string[]
  bouton?: { libelle: string; lien: string }
  piedDePage?: string
}): { html: string; texte: string } {
  const logos = cliniquesDe(clinique ?? 'LES_DEUX')
    .map(c => `<img src="${origine}${CLINIQUE_INFO[c].logo}" alt="${echapper(CLINIQUE_INFO[c].nom)}" height="44" style="height:44px;margin:0 8px;border:0">`)
    .join('')
  const corps = paragraphes.map(p => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#374151">${echapper(p)}</p>`).join('')
  const btn = bouton
    ? `<p style="margin:24px 0"><a href="${bouton.lien}" style="background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px;display:inline-block;font-size:15px">${echapper(bouton.libelle)}</a></p>
       <p style="margin:0 0 14px;font-size:12px;color:#9ca3af">Si le bouton ne fonctionne pas, copiez ce lien : <br><span style="word-break:break-all">${echapper(bouton.lien)}</span></p>`
    : ''
  const html = `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td align="center" style="padding:24px 24px 8px">${logos}</td></tr>
<tr><td style="padding:16px 32px 8px"><h1 style="margin:0 0 16px;font-size:20px;color:#111827">${echapper(titre)}</h1>${corps}${btn}</td></tr>
<tr><td style="padding:16px 32px 24px;border-top:1px solid #f3f4f6;font-size:12px;color:#9ca3af">${echapper(piedDePage ?? 'WS Formation — portail de formation des employés. Ce courriel est envoyé automatiquement, merci de ne pas y répondre.')}</td></tr>
</table></td></tr></table></body></html>`
  const texte = [titre, '', ...paragraphes, ...(bouton ? ['', `${bouton.libelle} : ${bouton.lien}`] : [])].join('\n')
  return { html, texte }
}

/** Adresse publique du site (pour les liens et les logos). */
export function origineDepuis(request: Request): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  const h = request.headers
  const hote = h.get('x-forwarded-host') ?? h.get('host') ?? 'ws-formation.vercel.app'
  const proto = h.get('x-forwarded-proto') ?? 'https'
  return `${proto}://${hote}`
}
