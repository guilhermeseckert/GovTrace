import { createServerFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'

export const getThemeFn = createServerFn({ method: 'GET' }).handler(() => {
  const theme = getCookie('theme')
  return (theme === 'dark' ? 'dark' : 'light') as 'light' | 'dark'
})
