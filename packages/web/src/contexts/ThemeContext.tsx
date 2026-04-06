import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  isValidTheme,
  getInitialTheme,
  applyTheme,
  saveTheme,
  type Theme,
} from '@/utils/theme.util'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)

  // Apply theme to DOM whenever it changes
  useEffect(() => {
    applyTheme(theme)
    saveTheme(theme)
  }, [theme])

  /**
   * Set theme with validation
   */
  const setTheme = (newTheme: Theme) => {
    if (!isValidTheme(newTheme)) {
      console.error('⚠️ Invalid theme:', newTheme)
      return
    }
    setThemeState(newTheme)
  }

  const value: ThemeContextType = {
    theme,
    setTheme,
    isDark: theme === 'dark',
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
