import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'

// Must match `base` in vite.config.ts, minus the trailing slash.
const BASENAME = '/workout'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={BASENAME}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
