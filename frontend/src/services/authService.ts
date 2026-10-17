const API_URL = import.meta.env.VITE_API_URL || 'https://api.pollypress.pyutasane.com';

const STORAGE_KEY = 'pollypress.passcode';

/** Thrown when the API rejects the stored passcode (missing, wrong or changed). */
export class UnauthorizedError extends Error {
  constructor() {
    super('Your passcode is no longer valid. Please enter it again.');
    this.name = 'UnauthorizedError';
  }
}

// Storage can be unavailable (private browsing, blocked site data), so every
// access is guarded and the app falls back to asking again
export function getPasscode(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function savePasscode(passcode: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, passcode);
  } catch {
    // Not persisted; the user will be asked again next visit
  }
}

export function clearPasscode(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear
  }
}

export function authHeaders(passcode = getPasscode()): Record<string, string> {
  return passcode ? { Authorization: `Passcode ${passcode}` } : {};
}

export function isUnauthorized(response: Response): boolean {
  return response.status === 401 || response.status === 403;
}

/**
 * Checks a passcode with the API and remembers it in this browser if valid.
 */
export async function unlock(passcode: string): Promise<boolean> {
  const response = await fetch(`${API_URL}/auth/check`, { headers: authHeaders(passcode) });

  if (isUnauthorized(response)) {
    return false;
  }
  if (!response.ok) {
    throw new Error('Could not reach PollyPress. Please try again.');
  }

  savePasscode(passcode);
  return true;
}
