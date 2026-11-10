// Progress lives in localStorage only. Every access is guarded: private
// windows and blocked storage must not break the game.

const KEY = 'anatomia:v1'

export type Progress = {
  best: Record<string, number> // unit slug → best accuracy %
  missed: Record<string, number> // item id → times missed and not yet cleared
  size: number // preferred round size, 0 = all
  lang: 'es' | 'en'
}

const EMPTY: Progress = { best: {}, missed: {}, size: 15, lang: 'es' }

export function loadProgress(): Progress {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return { ...EMPTY }
    const p = JSON.parse(raw)
    return {
      best: p.best ?? {},
      missed: p.missed ?? {},
      size: typeof p.size === 'number' ? p.size : 15,
      lang: p.lang === 'en' ? 'en' : 'es',
    }
  } catch {
    return { ...EMPTY }
  }
}

export function saveProgress(p: Progress) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* storage unavailable: play on without saving */
  }
}
