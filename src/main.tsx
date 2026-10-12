import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import '@fontsource/cormorant-garamond/latin-400.css'
import '@fontsource/cormorant-garamond/latin-400-italic.css'
import '@fontsource/cormorant-garamond/latin-600.css'
import '@fontsource/lora/latin-400.css'
import '@fontsource/lora/latin-600.css'
import './ds/styles.css'
import './styles.css'
import App from './App'

// Lets :active styles fire on iOS Safari.
document.addEventListener('touchstart', () => {}, { passive: true })

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
