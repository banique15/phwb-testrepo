import { test, expect } from '@playwright/test'

/**
 * E2E: Dev fix simulation – edit issue test and Initiate dev fix.
 * Requires dev server (bun run dev) and, for full flow, voiceaiagentv5 running with Temporal.
 * In CI or without auth: may redirect to /login; then we only assert the simulation page structure.
 */
test.describe('Dev fix simulation', () => {
	test('simulation page has edit form and Initiate dev fix button', async ({ page }) => {
		// Establish session in dev via test-login (no-op or redirect in prod)
		await page.goto('/auth/test-login?email=it@singforhope.org', { waitUntil: 'networkidle' })
		// After test-login we may be on / or /login; go to simulation
		await page.goto('/bugs/dev-fix-simulation', { waitUntil: 'networkidle' })

		// If we were redirected to login, we're still testing that the app doesn't crash
		const isLogin = page.url().includes('/login')
		if (isLogin) {
			// No session: just ensure we didn't get a 500
			await expect(page.locator('body')).toBeVisible()
			return
		}

		await expect(page.getByRole('heading', { name: /dev fix.*edit issue test simulation/i })).toBeVisible()
		await expect(page.getByPlaceholder('Bug ID (e.g. 1)')).toBeVisible()
		await expect(page.getByRole('button', { name: /load bug/i })).toBeVisible()
		await expect(page.getByRole('button', { name: /initiate dev fix/i })).toBeVisible()
	})

	test('can fill form and trigger Initiate dev fix – request completes', async ({ page }) => {
		await page.goto('/auth/test-login?email=it@singforhope.org', { waitUntil: 'networkidle' })
		await page.goto('/bugs/dev-fix-simulation', { waitUntil: 'networkidle' })

		if (page.url().includes('/login')) {
			test.skip()
			return
		}

		await page.getByPlaceholder('Bug ID (e.g. 1)').fill('1')
		await page.getByRole('button', { name: /load bug/i }).click()
		await page.waitForTimeout(800)

		await page.getByLabel('Title').fill('E2E test bug: button styling')
		await page.getByLabel('Description').fill('E2E test description for dev fix.')

		const initiateBtn = page.getByRole('button', { name: /initiate dev fix/i })
		// Skip if backend URL not set (button disabled) – set PUBLIC_VOICE_AGENT_URL in .env for full test
		if (!(await initiateBtn.isEnabled())) {
			test.skip()
			return
		}
		await initiateBtn.scrollIntoViewIfNeeded()
		await initiateBtn.click()
		// Wait for request to finish (button enabled again). Backend may be down → timeout or fast fail; flow must not hang.
		await expect(initiateBtn).toBeEnabled({ timeout: 25000 })
		// Full E2E (error/success/info alert) requires voiceaiagentv5 running; here we only assert the trigger completes.
	})
})
