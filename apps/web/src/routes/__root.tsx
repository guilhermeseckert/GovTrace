import { createRootRoute, HeadContent, Link, Outlet, Scripts, useMatches } from '@tanstack/react-router'
import { Sun, Moon, MapPin, Search, ExternalLink, BookOpen, Heart, BarChart2, GitBranch, Flag, ScrollText, Newspaper, Home, Menu, X, Info } from 'lucide-react'
import { useState } from 'react'
import { ThemeProvider, useTheme } from '@/components/layout/ThemeProvider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SkipToContent } from '@/components/layout/SkipToContent'
import { getThemeFn } from '@/server-fns/theme'
import { warmupDb } from '@/server-fns/warmup'
import '../app.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'GovTrace — Follow the money in Canadian government' },
      { name: 'description', content: 'Search any politician, company, or person and instantly see their donations, contracts, lobbying, grants, international aid, and parliamentary votes across 7 public federal datasets.' },
    ],
    links: [
      { rel: 'icon', href: '/favicon.ico' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,300..700;1,9..40,300..700&family=JetBrains+Mono:wght@400;500&display=swap' },
    ],
  }),
  loader: async () => {
    // Warm up DB pool on the first request — pays TCP handshake cost early
    // so subsequent data queries feel fast. Fire-and-forget; errors are silent.
    warmupDb().catch(() => {})
    return getThemeFn()
  },
  component: RootComponent,
})

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <button
      type="button"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}

function NavLink({ to, children, onClose }: { to: string; children: React.ReactNode; onClose?: () => void }) {
  const matches = useMatches()
  // For "/" (home), only active when it's the LAST match (exact). For others, any match works.
  const isActive = to === '/'
    ? matches[matches.length - 1]?.fullPath === '/'
    : matches.some((m) => m.fullPath === to)

  return (
    <Link
      to={to}
      onClick={onClose}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
      }`}
    >
      {children}
    </Link>
  )
}

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: <Home className="h-3.5 w-3.5" /> },
  { to: '/dashboard', label: 'Dashboard', icon: <BarChart2 className="h-3.5 w-3.5" /> },
  { to: '/how-it-works', label: 'How it works', icon: <BookOpen className="h-3.5 w-3.5" /> },
  { to: '/find-path', label: 'Find Path', icon: <GitBranch className="h-3.5 w-3.5" /> },
  { to: '/patterns', label: 'Patterns', icon: <Flag className="h-3.5 w-3.5" /> },
  { to: '/regulations', label: 'Regulations', icon: <ScrollText className="h-3.5 w-3.5" /> },
  { to: '/news', label: 'News', icon: <Newspaper className="h-3.5 w-3.5" /> },
  { to: '/search', label: 'Search', icon: <Search className="h-3.5 w-3.5" /> },
  { to: '/about', label: 'About', icon: <Info className="h-3.5 w-3.5" /> },
] as const

function SiteHeader() {
  const [isOpen, setIsOpen] = useState(false)
  const closeMenu = () => setIsOpen(false)

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      {/* Top bar */}
      <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80" onClick={closeMenu}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-sm">
            <MapPin className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-serif text-lg font-normal tracking-tight">GovTrace</span>
            <span className="text-xs font-medium text-muted-foreground">.ca</span>
          </div>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to}>
              {item.icon}
              {item.label}
            </NavLink>
          ))}
          <ThemeToggle />
        </div>

        {/* Mobile controls */}
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-expanded={isOpen}
            aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile slide-down menu */}
      {isOpen && (
        <div className="border-t bg-background/95 px-4 pb-4 pt-2 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} onClose={closeMenu}>
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </header>
  )
}

function SiteFooter() {
  return (
    <footer className="mt-auto border-t bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-primary">
                <MapPin className="h-3 w-3 text-primary-foreground" />
              </div>
              <span className="font-serif text-sm text-foreground">GovTrace.ca</span>
            </div>
            <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
              Open-source civic transparency for Canada. Follow the money across
              donations, contracts, lobbying, and grants.
            </p>
          </div>
          <div className="flex flex-col gap-2 text-xs text-muted-foreground">
            <p>All data under Open Government Licence — Canada</p>
            <p>Connections shown do not imply wrongdoing</p>
            <div className="flex flex-col gap-1.5 pt-1">
              <Link
                to="/how-it-works"
                className="flex w-fit items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                How it works
              </Link>
              <Link
                to="/about"
                className="flex w-fit items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                About
              </Link>
              <Link
                to="/privacy"
                className="flex w-fit items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                Privacy
              </Link>
              <a
                href="https://github.com/guilhermeseckert/GovTrace"
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-fit items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open source on GitHub
              </a>
              <a
                href="https://buymeacoffee.com/guilhermeeckert"
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-fit items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Heart className="h-3.5 w-3.5" />
                Support GovTrace
              </a>
            </div>
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
          <TooltipProvider>
            <SiteHeader />
            <div className="flex-1">
              <Outlet />
            </div>
            <SiteFooter />
          </TooltipProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}
