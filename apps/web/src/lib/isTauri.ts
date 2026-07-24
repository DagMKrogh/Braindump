/**
 * Returns true when running inside a Tauri desktop app.
 * Uses the presence of the __TAURI_INTERNALS__ object that Tauri injects.
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}
