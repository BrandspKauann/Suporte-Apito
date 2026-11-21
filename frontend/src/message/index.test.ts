import {describe, it, expect, vi} from 'vitest'
import {notify} from '@kyvg/vue3-notification'

import {ApiError} from '@/client/problem'
import {i18n} from '@/i18n'
import {error, getErrorText, success} from './index'

vi.mock('@kyvg/vue3-notification', () => ({notify: vi.fn()}))

describe('success', () => {
	it('merges duplicate toasts without actions', () => {
		success({message: 'Saved'})
		expect(notify).toHaveBeenLastCalledWith(expect.objectContaining({ignoreDuplicates: true}))
	})

	it('never merges toasts with actions, so each keeps its own undo', () => {
		success({message: 'Deleted'}, [{
			title: 'Undo',
			callback: () => {},
		}])
		expect(notify).toHaveBeenLastCalledWith(expect.objectContaining({ignoreDuplicates: false}))
	})

	it('leaves closing a toast with actions to its pausable timer', () => {
		success({message: 'Deleted'}, [{
			title: 'Undo',
			callback: () => {},
		}])
		expect(notify).toHaveBeenLastCalledWith(expect.objectContaining({duration: -1}))
	})

	it('keeps the default duration for toasts without actions', () => {
		success({message: 'Saved'})
		expect(notify).toHaveBeenLastCalledWith(expect.objectContaining({duration: undefined}))
	})
})

describe('error', () => {
	it('merges duplicate toasts without actions', () => {
		error({message: 'Failed'})
		expect(notify).toHaveBeenLastCalledWith(expect.objectContaining({ignoreDuplicates: true}))
	})

	it('never merges toasts with actions, so each keeps its own action', () => {
		error({message: 'Failed'}, [{
			title: 'Retry',
			callback: () => {},
		}])
		expect(notify).toHaveBeenLastCalledWith(expect.objectContaining({ignoreDuplicates: false}))
	})
})

describe('getErrorText', () => {
	function portugueseError(reason: unknown) {
		const previous = i18n.global.locale.value
		i18n.global.locale.value = 'pt-BR'
		try {
			return getErrorText(reason)
		} finally {
			i18n.global.locale.value = previous
		}
	}

	it('translates the hosting failure and preserves only its reference', () => {
		const text = portugueseError('A server error has occurred FUNCTION_INVOCATION_FAILED gru1::tf7rf-1795291693450-7641975a3937')
		expect(text).toContain('Não foi possível executar a API no servidor')
		expect(text).toContain('Identificador da falha: gru1::tf7rf-1795291693450-7641975a3937')
		expect(text).not.toContain('A server error has occurred')
	})

	it('translates a timeout returned as problem detail', () => {
		expect(portugueseError({detail: 'FUNCTION_INVOCATION_TIMEOUT'})).toContain('O servidor demorou demais para responder')
	})

	it.each([null, undefined])('handles an empty rejection reason (%s)', reason => {
		expect(getErrorText(reason)).toBe('')
	})

	it('handles a string rejection reason', () => {
		expect(getErrorText('Request failed')).toBe('Request failed')
	})

	it('interpolates i18n_params into the translated error message', () => {
		const text = getErrorText({
			code: 14002,
			message: 'The permission frobnicate of group tasks is invalid.',
			i18n_params: {permission: 'frobnicate', group: 'tasks'},
		})

		expect(text).toContain('frobnicate')
		expect(text).toContain('tasks')
	})

	it('falls back to empty placeholders when i18n_params is missing, without crashing', () => {
		const text = getErrorText({
			code: 14002,
			message: 'The permission frobnicate of group tasks is invalid.',
		})

		expect(text).not.toContain('{permission}')
		expect(text).not.toContain('{group}')
		expect(text).not.toContain('undefined')
	})

	it('falls back to the message when there is no error code', () => {
		const text = getErrorText({
			message: 'Something went wrong',
		})

		expect(text).toBe('Something went wrong')
	})

	it('falls back to the message for an unknown error code', () => {
		const text = getErrorText({
			code: 99999,
			message: 'some backend message',
		})

		expect(text).toBe('some backend message')
	})

	it('appends the server message of a request error given as cause', () => {
		const text = getErrorText(Object.assign(new Error('Error while refreshing user info:'), {
			cause: {
				status: 500,
				message: 'Internal server error',
				detail: 'Internal server error',
			},
		}))

		expect(text).toBe('Error while refreshing user info: Internal server error')
	})

	it('reads a direct problem response', () => {
		const text = getErrorText({
			code: 99999,
			detail: 'direct problem detail',
		})

		expect(text).toBe('direct problem detail')
	})

	it('translates the code of an ApiError', () => {
		const text = getErrorText(new ApiError({status: 404, code: 1001, detail: 'The user does not exist.'}))

		expect(text).not.toBe('The user does not exist.')
		expect(text).not.toBe('error.1001')
	})

	it('reads the detail of an ApiError without a code', () => {
		expect(getErrorText(new ApiError({status: 502, detail: 'Bad Gateway'}))).toBe('Bad Gateway')
	})
})
