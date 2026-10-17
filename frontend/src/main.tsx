import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Dev-only design preview (?preview=<screen>); excluded from production builds
const previewName = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('preview') : null
const Preview = import.meta.env.DEV
  ? lazy(() => import('./preview/Preview').then((m) => ({ default: m.Preview })))
  : null

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {Preview && previewName !== null ? (
      <Suspense>
        <Preview name={previewName} />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)
