import {DEFAULT_LANGUAGE, i18n} from '@/i18n'
import {notify} from '@kyvg/vue3-notification'

function errorRecord(value: unknown): Record<string, unknown> {
	return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function nonEmptyText(value: unknown): value is string {
	return typeof value === 'string' && value.trim() !== ''
}

function hasTranslation(key: string): boolean {
	return [i18n.global.locale.value, DEFAULT_LANGUAGE, 'en'].some(locale => i18n.global.te(key, locale))
}

function containsPrivateOrTechnicalDetail(message: string): boolean {
	return /<!doctype|<\/?[a-z][^>]*>/i.test(message)
		|| /\b(?:authorization\s*:|bearer\s+\S+|(?:password|passwd|secret|token|(?:access|refresh)[_-]?token|api[_-]?key)\s*[:=])/i.test(message)
		|| /\b(?:https?|postgres(?:ql)?|mysql|redis):\/\/[^\s/@]+:[^\s/@]+@/i.test(message)
		|| /[?&](?:access_token|refresh_token|token|api_?key|password|secret)=/i.test(message)
		|| /\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/.test(message)
		|| /\b(?:SQLSTATE|syntax error at|goroutine \d+)\b|\b(?:pq|panic):/i.test(message)
		|| /(?:^|\n)\s*at\s+\S+.*\([^\n]+:\d+:\d+\)/.test(message)
		|| /^(?:(?:Type|Reference|Syntax|Range|Eval|URI|Aggregate)Error\b|Cannot read properties of (?:undefined|null)\b)/.test(message)
}

function statusMessage(status: unknown): string | undefined {
	if (typeof status !== 'number') return
	const keys: Partial<Record<number, string>> = {
		401: 'unauthorized',
		403: 'forbidden',
		404: 'notFound',
		429: 'rateLimited',
		502: 'unavailable',
		503: 'unavailable',
		504: 'unavailable',
	}
	const key = keys[status] ?? (status >= 500 && status <= 599 ? 'server' : undefined)
	return key ? i18n.global.t(`error.${key}`) : undefined
}

export function getErrorText(reason: unknown): string {
	// Success notifications also use this helper and can intentionally omit their body.
	if (reason === null || reason === undefined || (typeof reason === 'string' && reason.trim() === '')) return ''

	const original = errorRecord(reason)
	// The dev rejection handler passes the event rather than its reason.
	const data = errorRecord(original.reason ?? reason)
	const cause = errorRecord(data.cause ?? original.cause)

	for (const problem of [data, cause]) {
		if (typeof problem.code !== 'number' || !problem.code) continue
		const path = `error.${String(problem.code).padStart(4, '0')}`
		if (hasTranslation(path)) {
			const params = errorRecord(problem.i18n_params)
			if (Object.values(params).some(value => typeof value === 'string' && containsPrivateOrTechnicalDetail(value))) {
				return i18n.global.t('error.generic')
			}
			const safeParams = Object.fromEntries(Object.entries(params).map(([key, value]) => [
				key,
				['string', 'number', 'boolean'].includes(typeof value) ? value : '',
			]))
			return i18n.global.t(path, safeParams)
		}
	}

	// v2 problem responses carry detail instead of message.
	const messages = [cause.detail, cause.message, data.message, data.detail, original.message, original.reason, reason]
		.filter(nonEmptyText)
		.map(message => message.trim())
	const message = messages[0] ?? ''
	const providerCode = [...messages, data.code, cause.code].find(value => typeof value === 'string' && /\bFUNCTION_INVOCATION_(FAILED|TIMEOUT)\b/.test(value))
	if (typeof providerCode === 'string') {
		const key = providerCode.includes('FUNCTION_INVOCATION_TIMEOUT') ? 'timeout' : 'failed'
		const reference = messages.join(' ').match(/\b[a-z]{3}\d::[a-zA-Z0-9:-]{1,160}\b/)?.[0]
		return i18n.global.t(`deploymentError.${key}`) + (reference ? ` ${i18n.global.t('deploymentError.reference', {reference})}` : '')
	}
	const httpMessage = statusMessage(data.status ?? cause.status)
	if (httpMessage) return httpMessage

	if (/^\s*(?:A server error has occurred|Server error occurred)\.?\s*$/i.test(message)) {
		return i18n.global.t('deploymentError.failed')
	}
	if (/^(?:Failed to fetch|NetworkError(?: when attempting to fetch resource\.?)?|Network request failed|Load failed|fetch failed)$/i.test(message)) {
		return i18n.global.t('error.network')
	}
	if (/^Internal server error\.?$/i.test(message)) return i18n.global.t('error.server')
	if (/^(?:Bad gateway|Service unavailable|Gateway timeout)\.?$/i.test(message)) return i18n.global.t('error.unavailable')
	if (hasTranslation(message)) return i18n.global.t(message)
	if (!message || containsPrivateOrTechnicalDetail(message)
		|| /^[A-Z][A-Z\d]*(?:_[A-Z\d]+)+$/.test(message)
		|| /^[a-z][\w-]*(?:\.[\w-]+)+$/.test(message)
		|| /^HTTP\s+\d{3}$/i.test(message)) {
		return i18n.global.t('error.generic')
	}
	return message
}

export function translatedError(key: string): Error {
	return new Error(i18n.global.t(key))
}

export interface Action {
	title: string,
	callback: () => void,
}

export type ToastOptions = {
	takeFocus?: boolean,
}

export type ToastData = {
	actions: Action[],
	takeFocus: boolean,
}

// Long enough to reach the action; Notification.vue pauses it while the toast is hovered or focused
export const ACTION_TOAST_DURATION = 10_000

function toast(type: 'error' | 'success', title: string, e: unknown, actions: Action[], options: ToastOptions & {duration?: number} = {}) {
	const data: ToastData = {
		actions,
		takeFocus: options.takeFocus ?? false,
	}
	notify({
		type,
		title,
		text: getErrorText(e) || (type === 'error' ? i18n.global.t('error.generic') : ''),
		// Duplicates merge on title and text, which would drop this toast's own actions.
		ignoreDuplicates: actions.length === 0,
		// Notification.vue runs the pausable timer instead
		duration: actions.length > 0 ? -1 : options.duration,
		data,
	})
}

export function error(e: unknown, actions: Action[] = []) {
	// The 3s library default is too short to notice and read an error.
	toast('error', i18n.global.t('error.error'), e, actions, {duration: 10_000})
}

export function success(e: unknown, actions: Action[] = [], options: ToastOptions = {}) {
	toast('success', i18n.global.t('error.success'), e, actions, options)
}
