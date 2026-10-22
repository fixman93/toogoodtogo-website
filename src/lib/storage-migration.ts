/**
 * One-time move of browser storage from the old "zalogaj." prefix to "foodnesi."
 * (sign-in, chosen city/country, script, scanner settings) — nobody is signed out.
 * Imported first in main.tsx, before any module reads storage.
 */
const OLD = 'zalogaj.'
const NEW = 'foodnesi.'

for (const name of ['localStorage', 'sessionStorage'] as const) {
  try {
    const storage = window[name]
    for (const key of Object.keys(storage)) {
      if (!key.startsWith(OLD)) continue
      const next = NEW + key.slice(OLD.length)
      const value = storage.getItem(key)
      if (storage.getItem(next) === null && value !== null) storage.setItem(next, value)
      storage.removeItem(key)
    }
  } catch {
    // Storage blocked (private mode): nothing to move.
  }
}

export {}
