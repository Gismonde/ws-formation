// Déclenche l'envoi des courriels d'information programmés dont l'heure est passée, après la réponse
// (au plus une vérification par minute et par instance du serveur). La tâche quotidienne sert de filet.
import { after } from 'next/server'
import { serviceClient } from '@/lib/permissions'
import { envoyerCourrielsDus } from '@/lib/courriels-information'

let derniere = 0

export function verifierCourrielsDus() {
  const maintenant = Date.now()
  if (maintenant - derniere < 60_000) return
  derniere = maintenant
  const origine = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://educplateform.wssurgical.com').replace(/\/$/, '')
  try {
    after(async () => { await envoyerCourrielsDus(serviceClient(), origine).catch(e => console.error('[Courriels programmés]', e)) })
  } catch { /* hors requête */ }
}
