import {test, expect} from '../../support/fixtures'
import {UserFactory} from '../../factories/user'
import {apiRootUrl} from '../../support/apiUrl'

test.use({
		currentUser: async ({}, use) => {
		const [user] = await UserFactory.create(1, {language: 'pt-BR'})
		await use(user)
	},
})

const unresolvedKey = /\b(?:project|user|navigation|task|menu|filters|misc|notifications)\.[a-zA-Z]\w*(?:\.\w+)+\b/

for (const width of [390, 1280]) {
	test(`Portuguese board creates and preserves a new column at ${width}px`, async ({authenticatedPage: page, apiContext, userToken}) => {
		await page.setViewportSize({width, height: 844})
		const root = apiRootUrl(process.env.API_URL || 'http://127.0.0.1:3456')
		const headers = {Authorization: `Bearer ${userToken}`}
		const create = await apiContext.post(`${root}/api/v2/projects`, {headers, data: {title: 'Atendimento em português'}})
		expect(create.status()).toBe(201)
		const project = await create.json()
		const detail = await apiContext.get(`${root}/api/v2/projects/${project.id}`, {headers})
		const board = (await detail.json()).views.find((view: {view_kind: string}) => view.view_kind === 'kanban')
		expect(board).toBeTruthy()
		await page.goto(`/projects/${project.id}/${board.id}`)
		const add = page.locator('.bucket.new-bucket .button')
		await expect(add).toHaveText('Novo')
		await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
		expect(await page.locator('body').innerText()).not.toMatch(unresolvedKey)
		await add.click()
		await page.locator('.bucket.new-bucket input.input').fill('Revisão')
		await page.locator('.bucket.new-bucket input.input').press('Enter')
		await expect(page.locator('.bucket .title').filter({hasText: 'Revisão'})).toBeVisible()
		await expect.poll(async () => {
			const response = await apiContext.get(`${root}/api/v2/projects/${project.id}/views/${board.id}/buckets`, {headers})
			return (await response.json()).items.some((bucket: {title: string}) => bucket.title === 'Revisão')
		}).toBe(true)
		await page.reload()
		await expect(page.locator('.bucket .title').filter({hasText: 'Revisão'})).toBeVisible()
		const layout = await page.evaluate(() => ({viewport: window.innerWidth, body: document.body.scrollWidth}))
		expect(layout.body).toBeLessThanOrEqual(layout.viewport + 1)
		expect(await page.locator('body').innerText()).not.toMatch(unresolvedKey)
		await page.screenshot({path: `test-results/apito-kanban-${width}.png`, fullPage: true, animations: 'disabled'})
	})
}

test('Mobile project grid and navigation stay inside the viewport', async ({authenticatedPage: page, apiContext, userToken}) => {
	await page.setViewportSize({width: 320, height: 720})
	const root = apiRootUrl(process.env.API_URL || 'http://127.0.0.1:3456')
	await apiContext.post(`${root}/api/v2/projects`, {
		headers: {Authorization: `Bearer ${userToken}`},
		data: {title: 'Projeto com um nome longo para conferir o celular'},
	})
	await page.goto('/projects')
	await expect(page.locator('.project-card').first()).toBeVisible()
	await page.screenshot({path: 'test-results/apito-projetos-320.png', fullPage: true, animations: 'disabled'})
	const layout = await page.evaluate(() => ({viewport: innerWidth, body: document.body.scrollWidth}))
	expect(layout.body).toBeLessThanOrEqual(layout.viewport + 1)
	await page.locator('button.menu-show-button:visible').click()
	await expect(page.locator('.menu-container')).toHaveClass(/is-active/)
	const bounds = await page.locator('.menu-container').boundingBox()
	expect(bounds).not.toBeNull()
	expect(bounds!.width).toBeLessThanOrEqual(320)
	expect(await page.locator('body').innerText()).not.toMatch(unresolvedKey)
})
