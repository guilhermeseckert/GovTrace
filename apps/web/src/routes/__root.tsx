import { createRootRoute, HeadContent, Outlet, Scripts, ScrollRestoration } from '@tanstack/react-router'
import { ThemeProvider } from '@/components/layout/ThemeProvider'
import { SkipToContent } from '@/components/layout/SkipToContent'
import { getThemeFn } from '@/server-fns/theme'
import '../app.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'GovTrace \u2014 Trace the flow of money and influence in Canadian government' },
    ],
    links: [{ rel: 'icon', href: '/favicon.ico' }],
  }),
  loader: () => getThemeFn(),
  component: RootComponent,
})

function RootComponent() {
  const theme = Route.useLoaderData()
  return (
    <html lang="en" className={theme} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <SkipToContent />
        <ThemeProvider theme={theme}>
          <Outlet />
        </ThemeProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}
