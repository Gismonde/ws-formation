// Parcours connectés (administrateur). Actifs seulement avec E2E_EMAIL et E2E_MOT_DE_PASSE
// (compte de test sans double authentification). Ces tests ne modifient aucune donnée.
import { test, expect, type Page } from '@playwright/test'

const email = process.env.E2E_EMAIL
const motDePasse = process.env.E2E_MOT_DE_PASSE
test.skip(!email || !motDePasse, 'E2E_EMAIL / E2E_MOT_DE_PASSE non fournis')

async function connexion(page: Page) {
  await page.goto('/login')
  await page.locator('input[name="email"]').fill(email!)
  await page.locator('input[name="password"]').fill(motDePasse!)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(u => !u.pathname.startsWith('/login'))
}

test.describe('Administration', () => {
  test.beforeEach(async ({ page }) => { await connexion(page) })

  test('tableau de bord et menu en 5 onglets', async ({ page, isMobile }) => {
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: /Tableau de bord|Dashboard/ })).toBeVisible()
    test.skip(isMobile, 'Menu replié dans le tiroir sur mobile')
    for (const g of [/Employés|Employees/, /Formations & politiques|Training & policies/, /Suivi & conformité|Tracking & compliance/]) {
      await expect(page.getByRole('button', { name: g })).toBeVisible()
    }
  })

  test('recherche globale', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Barre de recherche dans l’en-tête ordinateur')
    await page.goto('/admin')
    await page.keyboard.press('Control+k')
    await page.keyboard.type('form')
    await expect(page.getByRole('button', { name: /form/i }).first()).toBeVisible()
  })

  test('liste des formations', async ({ page }) => {
    await page.goto('/admin/formations')
    await expect(page).toHaveURL(/\/admin\/formations/)
    await expect(page.locator('main')).toContainText(/Formations|Training/)
  })

  test('page d’import des employés : vérification sans création', async ({ page }) => {
    await page.goto('/admin/employes/importer')
    await page.locator('input[type="file"]').setInputFiles({ name: 'test.csv', mimeType: 'text/csv', buffer: Buffer.from('Prénom;Nom;Courriel;Clinique\nTest;E2E;pas-un-courriel;CMC\n') })
    await page.getByRole('button', { name: /Vérifier le fichier|Check the file/ }).click()
    await expect(page.getByText(/Courriel invalide|Invalid email/)).toBeVisible()
  })

  test('une fenêtre de confirmation remplace confirm()', async ({ page }) => {
    let natif = false
    page.on('dialog', d => { natif = true; d.dismiss() })
    await page.goto('/admin/employes')
    const archiver = page.getByRole('button', { name: /Archiver|Archive/ }).first()
    test.skip(!(await archiver.count()), 'Aucun employé à archiver')
    await archiver.click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await page.getByRole('button', { name: /Annuler|Cancel/ }).click()
    expect(natif).toBe(false)
  })
})
