import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { locales } from '#/paraglide/runtime'

/**
 * Guards on the message catalogues themselves.
 *
 * Paraglide is silent about a missing translation: a message present in
 * `fr.json` but not in `en.json` compiles, and simply serves French to an
 * English screen. Nothing in the type system notices, because the message
 * function exists either way. These tests are what notices.
 */

const MESSAGES_DIR = new URL('../../messages/', import.meta.url)
const SOURCE_DIR = new URL('../', import.meta.url)

type Catalogue = Record<string, unknown>

function readCatalogue(locale: string): Catalogue {
  const raw = readFileSync(new URL(`${locale}.json`, MESSAGES_DIR), 'utf8')
  const { $schema: _schema, ...messages } = JSON.parse(raw) as Catalogue

  return messages
}

/**
 * The placeholders a message expects, whatever its shape.
 *
 * A plain message is a string; one with plurals is an array of variants, and
 * the placeholders live inside each branch. `\{` is an escaped brace, not a
 * placeholder.
 */
function placeholders(message: unknown): Set<string> {
  const found = new Set<string>()

  const walk = (value: unknown): void => {
    if (typeof value === 'string') {
      for (const match of value.matchAll(/(?<!\\)\{([a-zA-Z0-9_]+)\}/g)) {
        found.add(match[1]!)
      }

      return
    }

    if (Array.isArray(value)) {
      value.forEach(walk)

      return
    }

    if (value !== null && typeof value === 'object') {
      Object.values(value).forEach(walk)
    }
  }

  walk(message)

  return found
}

/** Every `.ts`/`.tsx` file under `src`, minus the generated Paraglide output. */
function sourceFiles(directory: URL): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'paraglide' || entry.name === 'routeTree.gen.ts') {
      return []
    }

    const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory)

    if (entry.isDirectory()) {
      return sourceFiles(child)
    }

    return /\.tsx?$/.test(entry.name) ? [readFileSync(child, 'utf8')] : []
  })
}

const catalogues = Object.fromEntries(locales.map((locale) => [locale, readCatalogue(locale)]))
const base = catalogues[locales[0]]!

describe('message catalogues', () => {
  it('declares a file for every configured locale', () => {
    // `locales` is generated from project.inlang/settings.json: a language
    // added there without a catalogue would otherwise fail at compile time
    // with no indication of which file is missing.
    expect(Object.keys(catalogues).sort()).toEqual([...locales].sort())
  })

  it.each(locales.slice(1))('translates exactly the same messages in %s', (locale) => {
    expect(Object.keys(catalogues[locale]!).sort()).toEqual(Object.keys(base).sort())
  })

  it.each(locales.slice(1))('keeps the same placeholders in %s', (locale) => {
    const drift = Object.keys(base)
      .map((key) => ({
        key,
        expected: [...placeholders(base[key])].sort(),
        actual: [...placeholders(catalogues[locale]![key])].sort(),
      }))
      .filter(({ expected, actual }) => expected.join() !== actual.join())

    // A translation that drops `{dish}` or renames it loses the value at
    // runtime rather than failing, so the whole list is reported at once.
    expect(drift).toEqual([])
  })

  it('has no message that nothing calls', () => {
    const sources = sourceFiles(SOURCE_DIR).join('\n')
    const orphans = Object.keys(base).filter(
      (key) => !new RegExp(`\\bm\\.${key}\\b`).test(sources)
    )

    expect(orphans).toEqual([])
  })
})
