import { useState, type FormEvent } from 'react';
import { unlock } from '../services/authService';
import { AlertIcon, LockIcon, Spinner } from './icons';
import { primaryButton } from './ConverterView';

type PasscodeGateProps = {
  onUnlocked: () => void;
  // Shown when the user was sent back here because a saved passcode stopped working
  initialMessage?: string | null;
  // Preview only: start in the checking state
  initialChecking?: boolean;
};

export const PasscodeGate = ({ onUnlocked, initialMessage = null, initialChecking = false }: PasscodeGateProps) => {
  const [passcode, setPasscode] = useState('');
  const [checking, setChecking] = useState(initialChecking);
  const [error, setError] = useState<string | null>(initialMessage);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!passcode.trim() || checking) return;

    setChecking(true);
    setError(null);
    try {
      if (await unlock(passcode.trim())) {
        onUnlocked();
      } else {
        setError("That passcode isn't right. Please check it and try again.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="rounded-3xl bg-white p-6 shadow-xl shadow-slate-900/5 ring-1 ring-slate-900/5 sm:p-8 dark:bg-slate-900 dark:shadow-black/40 dark:ring-white/10">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
          <LockIcon className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Enter your passcode</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          PollyPress is private. Ask the owner for the passcode.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="sr-only">Passcode</span>
          <input
            type="password"
            autoComplete="current-password"
            autoFocus
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Passcode"
            aria-invalid={error ? true : undefined}
            className={`block w-full rounded-xl border-0 bg-slate-50 px-4 py-3.5 text-base text-slate-900 ring-1 transition placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 dark:bg-slate-800/60 dark:text-white dark:focus:bg-slate-800 ${
              error
                ? 'ring-rose-300 focus:ring-rose-500 dark:ring-rose-500/50'
                : 'ring-slate-200 focus:ring-indigo-500 dark:ring-slate-700'
            }`}
          />
        </label>

        {error && (
          <p role="alert" className="flex items-start gap-2 text-sm text-rose-600 dark:text-rose-400">
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        <button type="submit" disabled={checking || !passcode.trim()} className={primaryButton}>
          {checking ? (
            <>
              <Spinner className="h-4 w-4" />
              Checking…
            </>
          ) : (
            'Unlock'
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
        You'll stay unlocked on this device until you lock it.
      </p>
    </div>
  );
};
