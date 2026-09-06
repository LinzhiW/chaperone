// Where the backend lives. Single source of truth — it used to be the literal
// string 'http://localhost:3005' repeated in 35 places across three files, which
// made the app impossible to package: a bundled desktop build has to pick a free
// port at startup rather than assume 3005 is available.
//
// Resolution order:
//   1. window.__CHAPERONE__.apiBase — injected by the Electron preload script,
//      which knows the port the embedded server actually bound to.
//   2. VITE_API_BASE — build/dev override, e.g. pointing a local UI at a remote box.
//   3. http://localhost:3005 — the plain `npm run dev` default.

declare global {
  interface Window {
    __CHAPERONE__?: {
      apiBase?: string;
      /** Native OS folder picker. Returns an absolute path, or null if cancelled. */
      pickFolder?: (opts?: { title?: string; defaultPath?: string }) => Promise<string | null>;
    };
  }
}

const injected = typeof window !== 'undefined' ? window.__CHAPERONE__?.apiBase : undefined;

export const API_BASE: string =
  injected || import.meta.env.VITE_API_BASE || 'http://localhost:3005';

/** Build a backend URL: api('/api/provider') -> 'http://localhost:3005/api/provider' */
export const api = (path: string): string =>
  `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;

/** True when running inside the packaged desktop shell. */
export const isDesktop = (): boolean =>
  typeof window !== 'undefined' && !!window.__CHAPERONE__;

/** True when a real OS folder picker is available (desktop only). */
export const canPickFolder = (): boolean =>
  typeof window !== 'undefined' && typeof window.__CHAPERONE__?.pickFolder === 'function';

/**
 * Ask the OS for a folder. Desktop only — a web page cannot learn a real path,
 * which is why the browser build falls back to asking the user to type one.
 * Returns null if cancelled or unavailable.
 */
export const pickFolder = async (opts?: { title?: string; defaultPath?: string }): Promise<string | null> => {
  const fn = typeof window !== 'undefined' ? window.__CHAPERONE__?.pickFolder : undefined;
  if (!fn) return null;
  try {
    return await fn(opts);
  } catch {
    return null;
  }
};
