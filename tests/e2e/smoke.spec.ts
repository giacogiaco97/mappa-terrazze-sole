import { test, expect } from '@playwright/test';

// Skippa l'onboarding al primo visit settando il flag in localStorage
// PRIMA del page load (initScript).
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    try { window.localStorage.setItem('onboarding-seen-v1', '1'); } catch { /* ignore */ }
  });
});

test.describe('App boot + feature smoke', () => {
  test('home carica e mostra TimeSlider + BottomSheet con count', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.time-slider__now')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.bottom-sheet__label')).toContainText(/terrazas al sol/, { timeout: 15_000 });
  });

  test('slider orario aggiorna stati senza reload', async ({ page }) => {
    await page.goto('/');
    // Aspetta che i dati siano caricati (count > 0)
    await expect(page.locator('.bottom-sheet__label')).toContainText(/[1-9]\d* terrazas al sol/, { timeout: 20_000 });
    const labelBefore = await page.locator('.bottom-sheet__label').textContent();
    const slider = page.locator('input[type=range]');
    await slider.fill('360');
    await expect(async () => {
      const labelAfter = await page.locator('.bottom-sheet__label').textContent();
      expect(labelAfter).not.toBe(labelBefore);
    }).toPass({ timeout: 5000 });
  });

  test('ricerca filtra la lista', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.bottom-sheet__label')).toContainText(/[1-9]\d* terrazas al sol/, { timeout: 20_000 });
    await page.locator('.bottom-sheet__handle').click();
    await expect(page.locator('.filters__search')).toBeVisible({ timeout: 5_000 });
    await page.locator('.filters__search').fill('starbucks');
    await expect(async () => {
      const count = await page.locator('.filters__count').textContent();
      const n = parseInt(count ?? '999', 10);
      expect(n).toBeLessThan(50);
    }).toPass({ timeout: 5000 });
  });

  test('deep-link ?id= apre direttamente la card', async ({ page }) => {
    await page.goto('/?id=T-100');
    await expect(page.locator('.card')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.card__title')).not.toBeEmpty();
  });

  test('modal crediti: Escape lo chiude', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.credits-btn')).toBeVisible({ timeout: 10_000 });
    await page.locator('.credits-btn').click();
    await expect(page.locator('.credits-modal')).toBeVisible({ timeout: 3000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('.credits-modal')).toBeHidden({ timeout: 3000 });
  });

  test('dark mode toggle persiste su localStorage', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.credits-btn')).toBeVisible({ timeout: 10_000 });
    await page.locator('.credits-btn').click();
    await page.locator('.theme-toggle').click(); // auto → light
    await page.locator('.theme-toggle').click(); // light → dark
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});
