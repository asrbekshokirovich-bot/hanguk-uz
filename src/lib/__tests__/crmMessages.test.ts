import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import i18n from '@/lib/i18n';

/**
 * The messages of the student card, the payment dialogs and the contract and
 * receipt uploads (namespace crmMsg) used to be English text in the code.
 * Every key the code asks for has to exist in all four site languages, and
 * the Uzbek text must not be the English fallback.
 */
const SRC = join(__dirname, '..', '..');

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === '__tests__' || name === 'locales' || name === 'integrations') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sources(path, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) out.push(path);
  }
  return out;
}

const used = new Map<string, string>();
for (const file of sources(SRC)) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/['"]crmMsg\.([A-Za-z0-9_]+)['"],\s*\{[^}]*defaultValue:\s*'((?:[^'\\]|\\.)*)'/g)) {
    used.set(m[1], m[2].replace(/\\'/g, "'"));
  }
}

describe('crmMsg — the CRM messages that were English in the code', () => {
  it('the code uses them', () => {
    expect(used.size).toBeGreaterThan(40);
  });

  it.each(['uz', 'en', 'ru', 'ko'])('%s has every message the code asks for', (lng) => {
    const missing = [...used.keys()].filter((key) => !i18n.getResource(lng, 'translation', `crmMsg.${key}`));
    expect(missing).toEqual([]);
  });

  it('English matches the fallback written in the code', () => {
    const different = [...used].filter(([key, fallback]) => i18n.getResource('en', 'translation', `crmMsg.${key}`) !== fallback).map(([key]) => key);
    expect(different).toEqual([]);
  });

  it('Uzbek, Russian and Korean are translations, not the English text', () => {
    for (const lng of ['uz', 'ru', 'ko']) {
      const same = [...used].filter(([key, fallback]) => i18n.getResource(lng, 'translation', `crmMsg.${key}`) === fallback).map(([key]) => key);
      expect(same, lng).toEqual([]);
    }
  });

  it('placeholders survive translation', () => {
    for (const lng of ['uz', 'ru', 'ko']) {
      for (const [key, fallback] of used) {
        const want = (fallback.match(/\{\{\w+\}\}/g) ?? []).sort();
        const got = (String(i18n.getResource(lng, 'translation', `crmMsg.${key}`)).match(/\{\{\w+\}\}/g) ?? []).sort();
        expect(got, `${lng}: ${key}`).toEqual(want);
      }
    }
  });
});
