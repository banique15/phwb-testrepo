import { test, expect } from '@playwright/test'

/**
 * E2E: Dev fix simulation – edit issue test and Initiate dev fix.
 * Requires dev server (bun run dev) and, for full flow, voiceaiagentv5 running with Temporal.
 * In CI or without auth: may redirect to /login; then we only assert the simulation page structure.
 */
test.describe('Dev fix simulation', () => {
	async function gotoBugDetailWithSeededBug(page: import('@playwright/test').Page): Promise<number | null> {
		await page.goto('/auth/test-login?email=it@singforhope.org', { waitUntil: 'networkidle' })
		if (page.url().includes('/login')) return null
		const seed = await page.request.post('/api/bugs/seed-test')
		if (!seed.ok()) return null
		const payload = await seed.json()
		const bugId = payload?.bug?.id
		if (typeof bugId !== 'number') return null
		await page.goto(`/bugs/${bugId}`, { waitUntil: 'networkidle' })
		return bugId
	}

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

	test('bug detail shows cross-layer evidence from dev logs', async ({ page }) => {
		const bugId = await gotoBugDetailWithSeededBug(page)
		if (bugId == null) {
			test.skip()
			return
		}

		await page.route(`**/api/bugs/${bugId}/dev-logs`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([
					{
						id: 1,
						step: 'analyze_and_code',
						message: '🧾 Implementation contract: type=bug_fix | layers=UI,API/Backend,DB | migration_required=yes',
						level: 'info',
						created_at: '2026-03-16T00:00:00.000Z',
						workflow_id: 'wf-test'
					},
					{
						id: 2,
						step: 'verify_fix',
						message: 'ℹ️ Verify mode: `edited_only` (enforce_completeness=on, enforce_schema_refs=on)',
						level: 'info',
						created_at: '2026-03-16T00:00:02.000Z',
						workflow_id: 'wf-test'
					},
					{
						id: 3,
						step: 'workflow_state',
						message:
							'🔖 Workflow state → `staging_ready_db_pending`. Staging preview is ready: https://preview.example.com. DB migration apply/confirmation is still required.',
						level: 'info',
						created_at: '2026-03-16T00:00:04.000Z',
						workflow_id: 'wf-test'
					}
				])
			})
		})

		await page.reload({ waitUntil: 'networkidle' })
		await expect(page.getByText('Evidence')).toBeVisible()
		await expect(page.getByText('UI', { exact: true })).toBeVisible()
		await expect(page.getByText('API/Backend', { exact: true })).toBeVisible()
		await expect(page.getByText('DB', { exact: true })).toBeVisible()
		await expect(page.getByText('Verify mode:', { exact: true })).toBeVisible()
		await expect(page.getByText('edited_only', { exact: true })).toBeVisible()
		await expect(page.getByText('Migration status:', { exact: true })).toBeVisible()
		await expect(page.getByText('pending_apply')).toBeVisible()
		await expect(page.getByRole('link', { name: /preview\.example\.com/i })).toBeVisible()
	})

	test('db-changing state keeps migration details after refresh', async ({ page }) => {
		const bugId = await gotoBugDetailWithSeededBug(page)
		if (bugId == null) {
			test.skip()
			return
		}

		await page.route(`**/api/bugs/${bugId}/dev-logs`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([
					{
						id: 1,
						step: 'workflow_state',
						message:
							'🔖 Workflow state → `staging_ready_db_pending`. Staging preview is ready: https://preview.example.com. DB migration apply/confirmation is still required.',
						level: 'info',
						created_at: '2026-03-16T00:00:04.000Z',
						workflow_id: 'wf-db'
					}
				])
			})
		})
		await page.route('**/api/dev/fix/migrations/preview', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					bug_id: bugId,
					workflow_id: 'wf-db',
					db_changes_detected: true,
					requires_db_confirmation: true,
					branch_name: 'dev-agent/bug-fix/test',
					migration_files: ['migrations/099_test_add_flag.sql'],
					summaries: [
						{
							file: 'migrations/099_test_add_flag.sql',
							summary: {
								operations: ['alter_add_column'],
								touched_tables: ['phwb_artists'],
								risk_tags: ['ddl']
							}
						}
					],
					warnings: []
				})
			})
		})

		await page.reload({ waitUntil: 'networkidle' })
		await expect(page.getByText('DB changes detected')).toBeVisible()
		await expect(page.getByText('migrations/099_test_add_flag.sql', { exact: true }).first()).toBeVisible()
		await expect(page.getByRole('button', { name: /refresh/i })).toBeVisible()
		await page.reload({ waitUntil: 'networkidle' })
		await expect(page.getByText('DB changes detected')).toBeVisible()
		await expect(page.getByText('migrations/099_test_add_flag.sql', { exact: true }).first()).toBeVisible()
	})
})
