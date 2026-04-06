/**
 * Theme Management Utilities
 *
 * Utilities for managing theme state, validating theme values,
 * and detecting system theme preferences.
 */

/**
 * Valid theme values
 */
export type Theme = 'light' | 'dark'

/**
 * Theme storage key in localStorage
 */
export const THEME_STORAGE_KEY = 'theme'

/**
 * Validate that a value is a valid theme
 *
 * @param value - Value to validate
 * @returns True if value is 'light' or 'dark'
 *
 * @example
 * isValidTheme('dark') // Returns true
 * isValidTheme('blue') // Returns false
 * isValidTheme(null) // Returns false
 */
export function isValidTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark'
}

/**
 * Get system theme preference from browser
 *
 * @returns 'dark' if system prefers dark mode, 'light' otherwise
 *
 * @example
 * getSystemTheme() // Returns 'dark' or 'light'
 */
export function getSystemTheme(): Theme {
  try {
    const prefersDark = window.matchMedia(
      '(prefers-color-scheme: dark)',
    ).matches
    return prefersDark ? 'dark' : 'light'
  } catch (error) {
    console.error('Failed to detect system theme:', error)
    return 'light' // Default fallback
  }
}

/**
 * Get initial theme from localStorage or system preference
 *
 * Priority:
 * 1. Valid theme from localStorage
 * 2. System theme preference (also saves to localStorage)
 * 3. 'light' as final fallback
 *
 * @returns Initial theme to use
 */
export function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)

    // If valid theme exists in storage, use it
    if (stored && isValidTheme(stored)) {
      return stored
    }

    // If invalid value exists, remove it
    if (stored) {
      console.warn('⚠️ Invalid theme value detected in localStorage:', stored)
      localStorage.removeItem(THEME_STORAGE_KEY)
    }

    // No theme set - detect system preference and save it
    const systemTheme = getSystemTheme()
    saveTheme(systemTheme)
    return systemTheme
  } catch (error) {
    console.error('Failed to read theme from localStorage:', error)
    return 'light'
  }
}

/**
 * Save theme to localStorage
 *
 * @param theme - Theme to save
 * @returns True if saved successfully
 */
export function saveTheme(theme: Theme): boolean {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
    return true
  } catch (error) {
    console.error('Failed to save theme to localStorage:', error)
    return false
  }
}

/**
 * Apply theme to document element using dual-class strategy
 *
 * Adds appropriate class (.light or .dark) to override system
 * preference media query. Both classes are managed to ensure
 * clean state and proper CSS specificity override.
 *
 * @param theme - Theme to apply
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement

  if (theme === 'dark') {
    root.classList.remove('light')
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

/**
 * Toggle theme between light and dark
 *
 * @param currentTheme - Current theme
 * @returns New theme
 */
export function toggleTheme(currentTheme: Theme): Theme {
  return currentTheme === 'light' ? 'dark' : 'light'
}
