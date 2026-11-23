import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {DEFAULT_LANGUAGE, getBrowserLanguage, i18n, setLanguage, type SupportedLocale} from './index'
import {loadDayJsLocale} from './useDayjsLanguageSync'

vi.mock('@/i18n/useDayjsLanguageSync.ts', () => ({loadDayJsLocale: vi.fn().mockResolvedValue(undefined)}))

const initialLocale = i18n.global.locale.value
const portuguese = i18n.global.getLocaleMessage('pt-BR')
const english = i18n.global.getLocaleMessage('en')

describe('application language', () => {
	beforeEach(() => {
		i18n.global.locale.value = DEFAULT_LANGUAGE
		i18n.global.setLocaleMessage('pt-BR', {...portuguese, fallbackTest: {shared: 'Português'}})
		i18n.global.setLocaleMessage('en', {...english, fallbackTest: {shared: 'English', englishOnly: 'English fallback'}})
		i18n.global.setLocaleMessage('de-DE', {})
		vi.mocked(loadDayJsLocale).mockReset().mockResolvedValue(undefined)
	})

	afterEach(() => {
		i18n.global.locale.value = DEFAULT_LANGUAGE
		i18n.global.setLocaleMessage('pt-BR', portuguese)
		i18n.global.setLocaleMessage('en', english)
		vi.restoreAllMocks()
	})

	it('starts in Brazilian Portuguese regardless of the browser language', () => {
		expect(initialLocale).toBe('pt-BR')
		expect(getBrowserLanguage()).toBe('pt-BR')
	})

	it('uses English source text when the Portuguese key is missing', () => {
		expect(i18n.global.t('fallbackTest.englishOnly')).toBe('English fallback')
	})

	it('keeps Portuguese ahead of English when a selected language lacks a key', () => {
		i18n.global.locale.value = 'de-DE'
		expect(i18n.global.t('fallbackTest.shared')).toBe('Português')
		expect(i18n.global.t('fallbackTest.englishOnly')).toBe('English fallback')
	})

	it('preserves an explicitly selected language', async () => {
		await setLanguage('en')
		expect(i18n.global.locale.value).toBe('en')
		expect(i18n.global.t('fallbackTest.shared')).toBe('English')
		expect(document.documentElement.lang).toBe('en')
	})

	it('synchronizes the document even when the default language is already selected', async () => {
		document.documentElement.lang = 'en'
		document.documentElement.dir = 'rtl'
		await setLanguage('pt-BR')
		expect(document.documentElement.lang).toBe('pt-BR')
		expect(document.documentElement.dir).toBe('ltr')
		expect(loadDayJsLocale).toHaveBeenCalledWith('pt-BR')
	})

	it('does not replace the latest selection when a previous language finishes loading', async () => {
		let finishLoading!: () => void
		vi.mocked(loadDayJsLocale).mockImplementation(language => language === 'de-DE'
			? new Promise<void>(resolve => { finishLoading = resolve })
			: Promise.resolve())
		const previous = setLanguage('de-DE')
		await setLanguage('en')
		finishLoading()
		await previous
		expect(i18n.global.locale.value).toBe('en')
		expect(document.documentElement.lang).toBe('en')
	})

	it('keeps the current language when an unsupported stored value is supplied', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {})
		i18n.global.locale.value = 'en'
		await setLanguage('unsupported' as SupportedLocale)
		expect(i18n.global.locale.value).toBe('en')
	})

	it('still loads the interface when the date locale cannot be downloaded', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {})
		vi.mocked(loadDayJsLocale).mockRejectedValue(new Error('Failed to fetch dynamically imported module'))
		await expect(setLanguage('en')).resolves.toBe('en')
		expect(i18n.global.locale.value).toBe('en')
	})
})
