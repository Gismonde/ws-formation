import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getUserRobuste } from './robustesse'

export async function createClient() {
  const cookieStore = await cookies()
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {}
        },
      },
    }
  )
  // Une panne passagère d'authentification lève une erreur au lieu de faire croire à une déconnexion
  const getUser = client.auth.getUser.bind(client.auth)
  client.auth.getUser = ((jwt?: string) => getUserRobuste(() => getUser(jwt))()) as typeof client.auth.getUser
  return client
}
