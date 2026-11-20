import {describe, it, expect, vi} from 'vitest'
import {mount, flushPromises} from '@vue/test-utils'
import {createI18n} from 'vue-i18n'
import Register from './Register.vue'
import Password from '@/components/input/Password.vue'
import en from '@/i18n/lang/en.json'

const {register} = vi.hoisted(() => ({register: vi.fn()}))
vi.mock('@/stores/auth', () => ({useAuthStore: () => ({register, authenticated: false, isLoading: false})}))
vi.mock('@/stores/config', () => ({useConfigStore: () => ({auth: {local: {registration_enabled: true}}})}))
vi.mock('@/router', () => ({default: {push: vi.fn(), replace: vi.fn()}}))
vi.mock('@/client/inviteLink', () => ({hasInviteLink: () => false, onInviteLinkChange: () => () => {}, checkInviteLink: vi.fn()}))
vi.mock('@/composables/useRedirectToLastVisited', () => ({useRedirectToLastVisited: () => ({redirectIfSaved: vi.fn()})}))

describe('registration autofill', () => {
	it('submits separate username and email plus the visible code without input events', async () => {
		register.mockResolvedValue(undefined)
		const wrapper = mount(Register, {global: {
			plugins: [createI18n({legacy: false, locale: 'en', messages: {en}})],
			stubs: {Password: true, XButton: true, RouterLink: true},
			directives: {focus: {}},
		}})
		for (const [id, value] of Object.entries({
			'company-name': ' Hirayama ', username: ' kauann ', email: ' kauann@example.com ', 'signup-code': ' test-invitation ',
		})) {
			(wrapper.get(`#${id}`).element as HTMLInputElement).value = value
		}
		wrapper.findComponent(Password).vm.$emit('update:modelValue', 'example-password-123')
		expect(wrapper.get('#signup-code').attributes('type')).toBe('text')
		await wrapper.get('form').trigger('submit')
		await flushPromises()
		expect(register).toHaveBeenCalledWith({company_name: 'Hirayama', username: 'kauann', email: 'kauann@example.com', password: 'example-password-123'}, null, false, 'test-invitation')
		wrapper.unmount()
	})
})
