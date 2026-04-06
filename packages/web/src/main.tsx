import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/globals.css'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { UserAuthProvider } from '@/contexts/UserAuthContext'
import { getInitialTheme, applyTheme } from '@/utils/theme.util'
import { SnackbarProvider } from '@/contexts/SnackbarContext'
import App from '@/App'

// Ensure theme is set before React renders (synchronous init)
const initTheme = () => {
  const theme = getInitialTheme()
  applyTheme(theme)
}
initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <UserAuthProvider>
        <SnackbarProvider position="bottom-center" defaultDuration={4000}>
          <App />
        </SnackbarProvider>
      </UserAuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
