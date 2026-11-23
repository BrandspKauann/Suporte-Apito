import {QueryClient, VueQueryPlugin} from '@tanstack/vue-query'
import {beforeEach, describe, it, expect, vi} from 'vitest'
import {mount, flushPromises} from '@vue/test-utils'
import PasswordReset from './PasswordReset.vue'
import Password from '@/components/input/Password.vue'
import {i18n} from '@/i18n'

const {resetPassword, mockRoute} = vi.hoisted(() => ({
	resetPassword: vi.fn(),
	mockRoute: {query: {} as Record<string, string>, hash: ''},
}))

vi.mock('@/client/generated', () => ({authPasswordReset: resetPassword}))

vi.mock('vue-router', () => ({
	useRoute: () => mockRoute,
}))

function mountPasswordReset(errors: unknown[] = [], realPassword = false) {
	return mount(PasswordReset, {
		global: {
			plugins: [i18n, [VueQueryPlugin, {queryClient: new QueryClient()}]],
			stubs: {XButton: true, Password: !realPassword, Icon: true, RouterLink: true},
			directives: {tooltip: {}},
			config: {
				errorHandler(err) {
					errors.push(err)
				},
			},
		},
	})
}

describe('PasswordReset', () => {
	beforeEach(() => {
		resetPassword.mockReset()
		mockRoute.query = {userPasswordReset: 'token'}
		mockRoute.hash = ''
	})

	it('reads the token from the fragment', async () => {
		resetPassword.mockResolvedValue({data: {message: 'ok'}})
		mockRoute.query = {}
		mockRoute.hash = '#userPasswordReset=fragment-token'

		const wrapper = mountPasswordReset()
		wrapper.findComponent(Password).vm.$emit('update:modelValue', 'new-password')
		await wrapper.find('form').trigger('submit')
		await flushPromises()

		expect(resetPassword).toHaveBeenCalledWith({body: {new_password: 'new-password', token: 'fragment-token'}})
	})

	it('shows the error when the request fails without a response', async () => {
		resetPassword.mockRejectedValue(new TypeError('Failed to fetch'))
		const errors: unknown[] = []

		const wrapper = mountPasswordReset(errors)

		wrapper.findComponent(Password).vm.$emit('update:modelValue', 'new-password')
		await wrapper.find('form').trigger('submit')
		await flushPromises()

		expect(errors).toEqual([])
		expect(resetPassword).toHaveBeenCalledWith({body: {new_password: 'new-password', token: 'token'}})
		expect(wrapper.text()).toContain(i18n.global.t('error.network'))
		expect(wrapper.text()).not.toContain('Failed to fetch')
	})
})

it('preserves the entered password when toggling visibility', async () => {
	const wrapper = mountPasswordReset([], true)
	const input = wrapper.get('input[name="password"]')
	await input.setValue('example-password-123')
	const toggle = wrapper.get('button.password-field-type-toggle')
	await toggle.trigger('click')
	expect(input.attributes('type')).toBe('text')
	expect((input.element as HTMLInputElement).value).toBe('example-password-123')
	await toggle.trigger('click')
	expect(input.attributes('type')).toBe('password')
	expect((input.element as HTMLInputElement).value).toBe('example-password-123')
	wrapper.unmount()
})
