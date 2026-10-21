// Tests de bout en bout (Playwright). Lancement : npm run e2e
// Par défaut : build de production local avec des clés factices (aucune donnée réelle n'est lue).
// E2E_URL=https://… pour viser un déploiement ; E2E_EMAIL / E2E_MOT_DE_PASSE activent les parcours connectés.
import { defineConfig, devices } from '@playwright/test'

const url = process.env.E2E_URL ?? 'http://localhost:3100'

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: { baseURL: url, trace: 'retain-on-failure', locale: 'fr-CA' },
  projects: [
    { name: 'ordinateur', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env.E2E_URL ? undefined : {
    command: 'npx next start -p 3100',
    url,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://exemple.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'cle-factice',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'cle-factice',
    },
  },
})
