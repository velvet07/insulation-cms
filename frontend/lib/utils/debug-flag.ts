export type DebugFlag = 'api' | 'strapi' | 'companies' | 'projects';

export function isDebugEnabled(flag: DebugFlag): boolean {
  if (typeof window === 'undefined') return false;

  // Global on/off
  if (localStorage.getItem('debug') === '1') return true;

  // Specific flags
  if (localStorage.getItem(`debug_${flag}`) === '1') return true;

  return false;
}

export function debugLog(flag: DebugFlag, ...args: unknown[]) {
  if (!isDebugEnabled(flag)) return;
  // console.debug is easier to filter in DevTools and won't look like an error
  console.debug(`[${flag}]`, ...args);
}

