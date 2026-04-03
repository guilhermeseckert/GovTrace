import { createRootRoute, HeadContent, Link, Outlet, Scripts, ScrollRestoration } from '@tanstack/react-router'
import { Sun, Moon, MapPin } from 'lucide-react'
import { ThemeProvider, useTheme } from '@/components/layout/ThemeProvider'
import { SkipToContent } from '@/components/layout/SkipToContent'
import { getThemeFn } from '@/server-fns/theme'
import '../app.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'GovTrace — Follow the money in Canadian government' },
    ],
    links: [{ rel: 'icon', href: '/favicon.ico' }],
  }),
  loader: () => getThemeFn(),
  component: RootComponent,
})

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <button
      type="button"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-primary">
            <MapPin className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-serif text-lg font-normal tracking-tight">GovTrace</span>
            <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">.ca</span>
          </div>
        </Link>

        <div className="flex items-center gap-1">
          <Link
            to="/"
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            Search
          </Link>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  )
}

function SiteFooter() {
  return (
    <footer className="mt-auto border-t">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col items-center gap-4 text-center text-xs text-muted-foreground sm:flex-row sm:justify-between sm:text-left">
          <div>
            <span className="font-serif text-sm text-foreground">GovTrace</span>
            <span className="ml-1.5">— Open-source civic transparency for Canada</span>
          </div>
          <div className="flex gap-4">
            <span>All data under Open Government Licence – Canada</span>
            <span>·</span>
            <span>Connections shown do not imply wrongdoing</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

function RootComponent() {
  const theme = Route.useLoaderData()
  return (
    <html lang="en" className={theme} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="flex min-h-screen flex-col">
        <SkipToContent />
        <ThemeProvider theme={theme}>
          <SiteHeader />
          <div className="flex-1">
            <Outlet />
          </div>
          <SiteFooter />
        </ThemeProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}
