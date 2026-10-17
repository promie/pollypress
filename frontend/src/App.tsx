import { useCallback, useState, type ReactNode } from 'react'
import { Converter } from './components/Converter'
import { PasscodeGate } from './components/PasscodeGate'
import { LockIcon, WaveIcon } from './components/icons'
import { clearPasscode, getPasscode } from './services/authService'

export const Layout = ({ children, onLock }: { children: ReactNode; onLock?: () => void }) => (
  <div className="relative min-h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
    {/* Soft background glow */}
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute -top-40 left-1/2 h-[32rem] w-[48rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-indigo-300/40 via-violet-300/30 to-sky-200/30 blur-3xl dark:from-indigo-600/20 dark:via-violet-600/15 dark:to-sky-500/10" />
    </div>

    <main className="relative mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 py-10 sm:py-16">
      <header className="mb-8 text-center sm:mb-10">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/30">
          <WaveIcon className="h-7 w-7" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-white">PollyPress</h1>
        <p className="mt-3 text-lg text-slate-600 dark:text-slate-400">
          Turn PDFs and text files into natural-sounding audio.
        </p>
      </header>

      {children}

      {onLock && (
        <button
          type="button"
          onClick={onLock}
          className="mx-auto mt-6 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-200/60 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <LockIcon className="h-4 w-4" />
          Lock on this device
        </button>
      )}

      <footer className="mt-auto pt-10 text-center text-xs text-slate-400 dark:text-slate-500">
        Powered by Amazon Polly · Neural voice “Joanna” · Files are deleted automatically
      </footer>
    </main>
  </div>
)

function App() {
  const [unlocked, setUnlocked] = useState(() => getPasscode() !== null)
  const [gateMessage, setGateMessage] = useState<string | null>(null)

  const lock = useCallback((message: string | null = null) => {
    clearPasscode()
    setGateMessage(message)
    setUnlocked(false)
  }, [])

  // A saved passcode stops working if the owner changes it
  const handleUnauthorized = useCallback(
    () => lock('The passcode has changed. Please enter the new one.'),
    [lock]
  )

  if (!unlocked) {
    return (
      <Layout>
        <PasscodeGate initialMessage={gateMessage} onUnlocked={() => setUnlocked(true)} />
      </Layout>
    )
  }

  return (
    <Layout onLock={() => lock()}>
      <Converter onUnauthorized={handleUnauthorized} />
    </Layout>
  )
}

export default App
