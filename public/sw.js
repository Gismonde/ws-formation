/* WS Formation — mode hors ligne (tablettes).
 * - Pages de formation et de leçon : réseau d'abord, copie gardée pour la consultation hors ligne.
 * - Fichiers de l'application (_next/static) : gardés en cache.
 * - Images et documents des leçons (stockage Supabase) : gardés en cache.
 * - « Rendre disponible hors ligne » : préchargement d'une formation complète.
 * Les données sont effacées à la déconnexion (Clear-Site-Data) et au changement d'utilisateur.
 */
const VERSION = 'v1'
const PAGES = 'ws-pages-' + VERSION
const STATIQUE = 'ws-statique-' + VERSION
const MEDIAS = 'ws-medias-' + VERSION
const HORS_LIGNE = '/hors-ligne'

self.addEventListener('install', e => {
  e.waitUntil(caches.open(PAGES).then(c => c.add(new Request(HORS_LIGNE, { credentials: 'same-origin' }))).catch(() => {}))
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const garder = [PAGES, STATIQUE, MEDIAS]
    for (const k of await caches.keys()) if (k.startsWith('ws-') && !garder.includes(k)) await caches.delete(k)
    await self.clients.claim()
  })())
})

const pageGardee = p => p === '/dashboard' || p.startsWith('/dashboard/') || p.startsWith('/formations/') || p === HORS_LIGNE
const estMedia = u => /\.supabase\.co$/.test(u.hostname) && u.pathname.startsWith('/storage/v1/object/')
// Les adresses signées changent : la clé du cache est l'adresse sans le jeton
const cleMedia = u => u.origin + u.pathname

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // Fichiers de l'application : cache d'abord
  if (url.origin === self.location.origin && url.pathname.startsWith('/_next/static/')) {
    e.respondWith(caches.open(STATIQUE).then(async c => {
      const deja = await c.match(req)
      if (deja) return deja
      const r = await fetch(req)
      if (r.ok) c.put(req, r.clone())
      return r
    }))
    return
  }

  // Images et documents des leçons (pas les vidéos : trop lourdes, lues par morceaux)
  if (estMedia(url) && !req.headers.has('range')) {
    e.respondWith(caches.open(MEDIAS).then(async c => {
      try {
        const r = await fetch(req)
        if (r.ok || r.type === 'opaque') c.put(cleMedia(url), r.clone())
        return r
      } catch (err) {
        const deja = await c.match(cleMedia(url))
        if (deja) return deja
        throw err
      }
    }))
    return
  }

  // Pages : réseau d'abord, copie hors ligne ensuite
  if (req.mode === 'navigate' && url.origin === self.location.origin && pageGardee(url.pathname)) {
    e.respondWith((async () => {
      const c = await caches.open(PAGES)
      try {
        const r = await fetch(req)
        if (r.ok && !r.redirected) c.put(url.pathname, r.clone())
        return r
      } catch {
        return (await c.match(url.pathname)) || (await c.match(HORS_LIGNE)) || Response.error()
      }
    })())
  }
})

async function precharger(urls, port) {
  const pages = await caches.open(PAGES)
  const medias = await caches.open(MEDIAS)
  let fait = 0
  for (const u of urls) {
    try {
      const r = await fetch(u, { credentials: 'same-origin' })
      if (r.ok && !r.redirected) {
        const html = await r.clone().text()
        await pages.put(new URL(u, self.location.origin).pathname, r)
        // Images et documents de la page
        const liens = Array.from(new Set((html.match(/https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/[^"'\s)\\]+/g) || []).map(x => x.replace(/&amp;/g, '&'))))
        for (const m of liens) {
          if (/\.(mp4|mov|webm|m4v)(\?|$)/i.test(m)) continue
          try {
            const rm = await fetch(m, { mode: 'no-cors' })
            await medias.put(cleMedia(new URL(m)), rm)
          } catch { /* média indisponible */ }
        }
      }
    } catch { /* page indisponible */ }
    fait++
    port && port.postMessage({ type: 'progression', fait, total: urls.length })
  }
  port && port.postMessage({ type: 'termine', fait, total: urls.length })
}

self.addEventListener('message', e => {
  const d = e.data || {}
  if (d.type === 'precharger' && Array.isArray(d.urls)) e.waitUntil(precharger(d.urls.slice(0, 200), e.ports[0]))
  if (d.type === 'vider') e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('ws-')).map(k => caches.delete(k)))))
  if (d.type === 'utilisateur' && typeof d.id === 'string') {
    // Tablette partagée : un autre utilisateur ne retrouve pas les pages du précédent
    e.waitUntil((async () => {
      const c = await caches.open('ws-session')
      const avant = await c.match('/__utilisateur')
      const ancien = avant ? await avant.text() : null
      if (ancien && ancien !== d.id) {
        await caches.delete(PAGES)
        await caches.delete(MEDIAS)
      }
      await c.put('/__utilisateur', new Response(d.id))
    })())
  }
})
