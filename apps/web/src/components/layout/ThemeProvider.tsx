import { createContext, useContext, useState, type ReactNode } from 'react'

type Theme = 'light' | 'dark'

const ThemeContext = createContext<{
  theme: Theme
  setTheme: (theme: Theme) => void
}>({ theme: 'light', setTheme: () => {} })

export function ThemeProvider({
  children,
  theme: initialTheme,
}: {
  children: ReactNode
  theme: Theme
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme)

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    document.cookie = `theme=${newTheme}; path=/; max-age=31536000; SameSite=Lax`
    document.documentElement.className = newTheme
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
