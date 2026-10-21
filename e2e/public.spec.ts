// Parcours sans connexion : pages publiques, redirections et API protégées.
import { test, expect } from '@playwright/test'

test.describe('Connexion', () => {
  test('la page de connexion s’affiche', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /Se connecter|Sign in|Log in/ })).toBeVisible()
  })

  test('un message d’erreur s’affiche après un échec', async ({ page }) => {
    await page.goto('/login?error=1')
    await expect(page.getByText(/incorrect/i)).toBeVisible()
  })

  test('la page passe en anglais', async ({ page }) => {
    await page.goto('/login')
    const en = page.getByRole('button', { name: 'EN', exact: true })
    test.skip(!(await en.count()), 'Pas de bascule de langue sur cette page')
    await en.first().click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByText('Password', { exact: false }).first()).toBeVisible()
  })
})

test.describe('Pages protégées sans connexion', () => {
  for (const chemin of ['/admin', '/admin/employes', '/admin/formations', '/admin/formations/creer', '/dashboard/accueil', '/dashboard/securite']) {
    test(`${chemin} renvoie vers la connexion`, async ({ page }) => {
      await page.goto(chemin)
      await expect(page).toHaveURL(/\/login/)
    })
  }
})

test.describe('API protégées sans connexion', () => {
  test('recherche globale refusée', async ({ request }) => {
    const r = await request.get('/api/admin/recherche?q=test')
    expect(r.status()).toBe(403)
  })
  test('import d’employés refusé', async ({ request }) => {
    const r = await request.post('/api/admin/employes/importer', { multipart: { action: 'apercu', fichier: { name: 'a.csv', mimeType: 'text/csv', buffer: Buffer.from('Prénom;Nom;Courriel\nA;B;a@b.c') } } })
    expect(r.status()).toBe(403)
  })
  test('création d’employé refusée', async ({ request }) => {
    const r = await request.post('/api/admin/create-employee', { data: { prenom: 'A', nom: 'B', email: 'a@b.c' } })
    expect([401, 403]).toContain(r.status())
  })
  test('réinitialisation 2FA refusée', async ({ request }) => {
    const r = await request.delete('/api/admin/employes/00000000-0000-0000-0000-000000000000/deux-facteurs')
    expect(r.status()).toBe(403)
  })
})

test('la page de vérification 2FA s’affiche', async ({ page }) => {
  await page.goto('/mfa-verify')
  await expect(page.getByPlaceholder('000000')).toBeVisible()
})

test('la politique de confidentialité est publique', async ({ page }) => {
  const r = await page.goto('/confidentialite')
  expect(r?.status()).toBeLessThan(400)
  await expect(page).not.toHaveURL(/\/login/)
})
