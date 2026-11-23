import type { PluralizationRule } from 'vue-i18n'
import { createI18n } from 'vue-i18n'
import langEN from './lang/en.json'
import langPT from './lang/pt-BR.json'

import { loadDayJsLocale } from '@/i18n/useDayjsLanguageSync.ts'
import dayjs from 'dayjs'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(localizedFormat)
dayjs.extend(relativeTime)

export const SUPPORTED_LOCALES = {
	'en': 'English',
	'de-DE': 'Deutsch',
	'de-swiss': 'Schwizertütsch',
	'ru-RU': 'Русский',
	'fr-FR': 'Français',
	'vi-VN': 'Tiếng Việt',
	'it-IT': 'Italiano',
	'cs-CZ': 'Čeština',
	'pl-PL': 'Polski',
	'nl-NL': 'Nederlands',
	'pt-PT': 'Português',
	'zh-CN': '简体中文',
	'zh-TW': '繁體中文',
	'no-NO': 'Norsk Bokmål',
	'es-ES': 'Español',
	'da-DK': 'Dansk',
	'ja-JP': '日本語',
	'hu-HU': 'Magyar',
	'ar-SA': 'اَلْعَرَبِيَّةُ',
	'fa-IR': 'فارسی',
	'sl-SI': 'Slovenščina',
	'pt-BR': 'Português Brasileiro',
	'hr-HR': 'Hrvatski',
	'uk-UA': 'Українська',
	'lt-LT': 'Lietuvių Kalba',
	'bg-BG': 'Български',
	'ko-KR': '한국어',
	'tr-TR': 'Türkçe',
	'fi-FI': 'Suomi',
	'he-IL': 'עִבְרִית',
	'sv-SE': 'Svenska',
	'el-GR': 'Ελληνικά',
	// IMPORTANT: Also add new languages to useDayjsLanguageSync
	// IMPORTANT: Also add new languages to pkg/i18n/i18n.go
} as const

export type SupportedLocale = keyof typeof SUPPORTED_LOCALES

export const DEFAULT_LANGUAGE: SupportedLocale = 'pt-BR'

export type ISOLanguage = string

const RTL_LANGUAGES = ['ar-SA', 'he-IL', 'fa-IR'] as const

export function isRTLLanguage(locale: SupportedLocale): boolean {
	return RTL_LANGUAGES.includes(locale as typeof RTL_LANGUAGES[number])
}

// we load all messages async
export const i18n = createI18n({
	locale: DEFAULT_LANGUAGE,
	// Portuguese remains the default; source messages prevent untranslated keys
	// from reaching the interface while a translation is incomplete.
	fallbackLocale: [DEFAULT_LANGUAGE, 'en'],
	legacy: false,
	pluralRules: {
		'ru-RU': (choice: number, choicesLength: number, orgRule?: PluralizationRule) => {
			if (choicesLength !== 3) {
				return orgRule ? orgRule(choice, choicesLength) : 0
			}
			const n = Math.abs(choice) % 100
			if (n > 10 && n < 20) {
				return 2
			}
			if (n % 10 === 1) {
				return 0
			}
			if (n % 10 >= 2 && n % 10 <= 4) {
				return 1
			}
			return 2
		},
	},
	messages: {
		en: langEN,
		[DEFAULT_LANGUAGE]: langPT,
	} as Record<SupportedLocale, typeof langEN>,
})

let languageChange = 0

export async function setLanguage(lang: SupportedLocale): Promise<SupportedLocale | undefined> {
	if (!Object.hasOwn(SUPPORTED_LOCALES, lang)) {
		console.warn('Unsupported interface language; keeping the current language.')
		return
	}
	const change = ++languageChange

	// If the language hasn't been loaded yet
	if (!i18n.global.availableLocales.includes(lang)) {
		try {
			const messages = await import(`./lang/${lang}.json`)
			i18n.global.setLocaleMessage(lang, messages.default)
		} catch {
			console.warn(`Could not load interface language ${lang}; keeping the current language.`)
			return
		}
	}
	
	try {
		await loadDayJsLocale(lang)
	} catch {
		// A missing date-formatting chunk must not prevent the interface from starting.
		console.warn(`Could not load date formatting for ${lang}.`)
	}
	if (change !== languageChange) {
		return
	}

	i18n.global.locale.value = lang
	document.documentElement.lang = lang
	document.documentElement.dir = isRTLLanguage(lang) ? 'rtl' : 'ltr'
	return lang
}

export function getBrowserLanguage(): SupportedLocale {
	return DEFAULT_LANGUAGE
}
