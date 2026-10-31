import type { RunState } from '@dicetro/engine';

// Save layer (design §11.1): swap these two functions for Capacitor Preferences in the app build.
const KEY = 'dicetro.run';
const SCHEMA = 1; // bump whenever RunState's shape changes; older saves are then ignored

export function loadRun(): RunState | null {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return saved?.schema === SCHEMA && Array.isArray(saved.run?.dice) ? saved.run : null;
  } catch {
    return null; // storage blocked or corrupt: start fresh
  }
}

/** Pass null to clear the save (run over). */
export function saveRun(run: RunState | null) {
  try {
    if (run) localStorage.setItem(KEY, JSON.stringify({ schema: SCHEMA, run }));
    else localStorage.removeItem(KEY);
  } catch {
    // private mode or quota: the game still works, it just won't resume
  }
}
