vi.mock('@/client/generated', () => ({userShow: httpGetMock}))
import {describe, it, expect, beforeEach, vi} from 'vitest'
import {setActivePinia, createPinia} from 'pinia'

import {useAuthStore} from './auth'
import {shouldDropEvent} from '@/helpers/sentryFilters'
import {getErrorText} from '@/message'
import {i18n} from '@/i18n'

const {httpGetMock, routerPushMock, getTokenMock} = vi.hoisted(() => ({
	httpGetMock: vi.fn(),
	routerPushMock: vi.fn(),
	getTokenMock: vi.fn(),
}))

vi.mock('@/helpers/auth', () => ({
	refreshToken: vi.fn(),
	getToken: getTokenMock,
	saveToken: vi.fn(),
	removeToken: () => getTokenMock.mockReturnValue(null),
}))

vi.mock('@/router', () => ({
	default: {push: routerPushMock},
}))

vi.mock('@/client/queryClient', async () => {
	const {QueryClient} = await import('@tanstack/vue-query')
	const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}})
	return {queryClient}
})

vi.mock('@/composables/useWebSocket', () => ({
	useWebSocket: () => ({
		disconnect: vi.fn(),
		connect: vi.fn(),
		closeStaleConnection: vi.fn(),
	}),
}))

vi.mock('@/helpers/redirectToProvider', () => ({
	getRedirectUrlFromCurrentFrontendPath: vi.fn(),
	redirectToProvider: vi.fn(),
	redirectToProviderOnLogout: vi.fn(),
}))

async function refreshError(): Promise<unknown> {
	try {
		await useAuthStore().refreshUserInfo()
	} catch (e) {
		return e
	}
	throw new Error('refreshUserInfo did not throw')
}

describe('auth store refreshUserInfo failures', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		httpGetMock.mockReset()
		routerPushMock.mockReset()
		getTokenMock.mockReset().mockReturnValue('token')
		vi.spyOn(console, 'error').mockImplementation(() => {})
	})

	it('throws an error sentry drops on a network error', async () => {
		httpGetMock.mockRejectedValue(new TypeError('Failed to fetch'))

		expect(shouldDropEvent(await refreshError())).toBe(true)
	})

	it('throws an error sentry reports and shows a translated message on a 5xx', async () => {
		httpGetMock.mockRejectedValue({status: 500, detail: 'Internal server error'})

		const e = await refreshError()

		expect(shouldDropEvent(e)).toBe(false)
		expect(getErrorText(e)).toBe(i18n.global.t('error.server'))
	})

	it.each([401, 403])('logs out on a %i', async status => {
		const store = useAuthStore()
		store.setAuthenticated(true)
		httpGetMock.mockRejectedValue({status, detail: 'invalid token'})

		await expect(store.refreshUserInfo()).resolves.toBeUndefined()

		expect(store.authenticated).toBe(false)
		expect(routerPushMock).toHaveBeenCalledWith({name: 'user.login'})
	})

	it.each([
		[404, 1005],
		[412, 1020],
		[412, 1040],
	])('logs out on a %i with code %i', async (status, code) => {
		const store = useAuthStore()
		store.setAuthenticated(true)
		httpGetMock.mockRejectedValue({status, code, detail: 'account unavailable'})

		await expect(store.refreshUserInfo()).resolves.toBeUndefined()

		expect(store.authenticated).toBe(false)
		expect(routerPushMock).toHaveBeenCalledWith({name: 'user.login'})
	})

	it.each([
		[404, undefined, 'error.notFound'],
		[412, 1017, 'error.1017'],
		[429, undefined, 'error.rateLimited'],
		[503, undefined, 'error.unavailable'],
	] as const)('keeps the session and throws on a %i with code %s', async (status, code, messageKey) => {
		const store = useAuthStore()
		store.setAuthenticated(true)
		httpGetMock.mockRejectedValue({status, code, detail: 'rejected'})

		const e = await refreshError()

		expect(getErrorText(e)).toBe(i18n.global.t(messageKey))
		expect(store.authenticated).toBe(true)
		expect(routerPushMock).not.toHaveBeenCalled()
	})
})
