import {describe, expect, it} from 'vitest'
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import en from './lang/en.json'
import pt from './lang/pt-BR.json'

function flatten(value: Record<string, unknown>, prefix = ''): Record<string, string> {
	return Object.fromEntries(Object.entries(value).flatMap(([key, entry]) => {
		const path = prefix ? `${prefix}.${key}` : key
		return entry && typeof entry === 'object'
			? Object.entries(flatten(entry as Record<string, unknown>, path))
			: [[path, String(entry)]]
	}))
}

describe('Brazilian Portuguese coverage', () => {
	it('covers every interface string without losing interpolation parameters', () => {
		const translated = flatten(pt)
		for (const [key, original] of Object.entries(flatten(en))) {
			expect(translated[key], `Tradução ausente: ${key}`).toBeTruthy()
			const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort()
			expect(placeholders(translated[key]), key).toEqual(placeholders(original))
		}
	})

	it('covers notification strings without losing Go formatting arguments', () => {
		const read = (locale: string) => JSON.parse(readFileSync(resolve(process.cwd(), `../pkg/i18n/lang/${locale}.json`), 'utf8'))
		const translated = flatten(read('pt-BR'))
		for (const [key, original] of Object.entries(flatten(read('en')))) {
			expect(translated[key], `Notificação sem tradução: ${key}`).toBeTruthy()
			const placeholders = (text: string) => text.match(/%\[\d+\][a-z]/g)?.sort() ?? []
			expect(placeholders(translated[key]), key).toEqual(placeholders(original))
		}
	})
})
