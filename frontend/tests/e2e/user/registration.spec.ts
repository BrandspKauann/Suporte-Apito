import {randomBytes} from 'node:crypto'
import {test, expect} from '../../support/fixtures'
import {UserFactory} from '../../factories/user'
import {setupApiUrl} from '../../support/authenticateUser'
import {apiRootUrl} from '../../support/apiUrl'

test.describe('Registration', () => {
	test.beforeEach(async ({page}) => {
		await setupApiUrl(page)
		await UserFactory.create(1, {
			username: 'test',
			email: 'existing@example.com',
		})
		await page.goto('/')
		await page.evaluate(() => localStorage.removeItem('token'))
	})

	test('Should work without issues', async ({page}) => {
		const fixture = {
			password: '12345678',
			email: 'testuser@example.com',
		}

		// Install clock before navigation so app observes mocked time for greeting
		await page.clock.install({time: new Date(1625656161057)}) // 13:00
		await page.goto('/register')
		await page.locator('#username').fill('testuser')
		await page.locator('#company-name').fill('Test Company')
		await page.locator('#email').fill(fixture.email)
		await page.locator('#password').fill(fixture.password)
		await page.locator('#signup-code').fill(process.env.APITO_TEST_SIGNUP_CODE || 'test-invitation')
		const registered = page.waitForResponse(response => response.url().endsWith('/api/v2/register') && response.request().method() === 'POST')
		await page.locator('#register-submit').click()
		const created = await (await registered).json()
		await expect(page).toHaveURL('/')
		await expect(page.locator('main h1')).toContainText(created.name || created.username)
	})

	test('Should show a confirmation notice when the email needs to be verified', async ({browser, baseURL, request}) => {
		const publicUrl = new URL('/', baseURL).href
		const apiUrl = apiRootUrl(process.env.MAILER_API_URL || 'http://127.0.0.1:3457')
		const mailpitUrl = process.env.MAILPIT_URL || 'http://127.0.0.1:8025'
		const username = `unconfirmed-${randomBytes(8).toString('hex')}`
		const email = `${username}@example.com`
		const context = await browser.newContext({baseURL: publicUrl})
		try {
			await context.addInitScript(url => {
				localStorage.setItem('API_URL', url)
				window.API_URL = url
			}, apiUrl)
			const page = await context.newPage()
			await page.goto('/register')
			await page.locator('#company-name').fill('Mail Company')
			await page.locator('#username').fill(username)
			await page.locator('#email').fill(email)
			await page.locator('#password').fill('12345678')
			await page.locator('#signup-code').fill(process.env.APITO_TEST_SIGNUP_CODE || 'test-invitation')
			const registered = page.waitForResponse(response => response.url().endsWith('/api/v2/register') && response.request().method() === 'POST')
			const loginUrl = `${apiUrl}/api/v2/login`
			const login = page.waitForResponse(response => response.url() === loginUrl && response.request().method() === 'POST')
			await page.locator('#register-submit').click()
			const created = await (await registered).json()
			expect((await login).status()).toBe(412)
			await expect(page.locator('div.message.success')).toContainText('check your inbox')
			await expect(page.locator('div.message.danger')).not.toBeVisible()
			await expect(page).toHaveURL(/\/register/)

			let messageId = ''
			await expect.poll(async () => {
				const response = await request.get(new URL('/api/v1/search', mailpitUrl).href, {params: {query: `to:${email}`}})
				expect(response.status()).toBe(200)
				const result: {messages: {ID: string}[]} = await response.json()
				messageId = result.messages[0]?.ID ?? ''
				return messageId
			}, {timeout: 15000, message: 'Confirmation email arrives in Mailpit'}).toBeTruthy()
			const response = await request.get(new URL(`/api/v1/message/${messageId}`, mailpitUrl).href)
			expect(response.status()).toBe(200)
			const mail: {Text: string, To: {Address: string}[]} = await response.json()
			expect(mail.To).toContainEqual(expect.objectContaining({Address: email}))
			const confirmationUrl = mail.Text.match(/https?:\/\/[^\s<>]+#userEmailConfirm=[a-zA-Z0-9]+/)?.[0]
			expect(confirmationUrl).toBeDefined()
			await page.goto(confirmationUrl!)
			await expect(page.locator('div.message.success')).toContainText('You successfully confirmed your email')
			await page.locator('#company-name').fill('Mail Company')
			await page.locator('#username').fill(email)
			await page.locator('#password').fill('12345678')
			await page.getByRole('button', {name: 'Login', exact: true}).click()
			await expect(page).toHaveURL(publicUrl)
			await expect(page.locator('main h1')).toContainText(created.name || created.username)
		} finally {
			await context.close()
		}
	})

	test('Should fail', async ({page}) => {
		const fixture = {
			password: '12345678',
			email: 'existing@example.com',
		}

		await page.goto('/register')
		await page.locator('#company-name').fill('Duplicate Company')
		await page.locator('#username').fill('duplicateuser')
		await page.locator('#email').fill(fixture.email)
		await page.locator('#password').fill(fixture.password)
		await page.locator('#signup-code').fill(process.env.APITO_TEST_SIGNUP_CODE || 'test-invitation')
		await page.locator('#register-submit').click()
		await expect(page.locator('div.message.danger')).toContainText('A user with this email address already exists.')
	})
})
