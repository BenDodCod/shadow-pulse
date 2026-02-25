import { test, expect } from '@playwright/test'

test.describe('Shadow Pulse Game', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('page loads successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/Shadow Pulse/)
  })

  test('game canvas is rendered', async ({ page }) => {
    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible()
  })

  test('canvas has correct dimensions', async ({ page }) => {
    const canvas = page.locator('canvas')
    const box = await canvas.boundingBox()
    expect(box).toBeTruthy()
    // Game should have reasonable dimensions
    expect(box!.width).toBeGreaterThan(800)
    expect(box!.height).toBeGreaterThan(400)
  })

  test('game responds to keyboard input', async ({ page }) => {
    const canvas = page.locator('canvas')
    await canvas.click() // Focus the game

    // Press movement keys
    await page.keyboard.press('w')
    await page.keyboard.press('a')
    await page.keyboard.press('s')
    await page.keyboard.press('d')

    // Press attack keys
    await page.keyboard.press('j')
    await page.keyboard.press('k')

    // Game should still be running (canvas visible)
    await expect(canvas).toBeVisible()
  })

  test('game can be started', async ({ page }) => {
    const canvas = page.locator('canvas')

    // Click to start game if there's a start screen
    await canvas.click()

    // Wait a bit for game to initialize
    await page.waitForTimeout(500)

    // Canvas should still be visible
    await expect(canvas).toBeVisible()
  })
})
