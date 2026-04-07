import { createFileRoute } from '@tanstack/react-router'
import { ExternalLink, Shield } from 'lucide-react'

export const Route = createFileRoute('/privacy')({
  head: () => ({
    meta: [{ title: 'Privacy Policy | GovTrace' }],
  }),
  component: PrivacyPage,
})

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 font-serif text-2xl">{title}</h2>
      {children}
    </section>
  )
}

function PrivacyPage() {
  return (
    <main id="main-content">
      {/* Hero */}
      <div className="border-b bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-serif text-3xl">Privacy Policy</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">Last updated April 2026</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-4 py-12 text-base leading-relaxed text-muted-foreground">
        <Section title="The short version">
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <ul className="space-y-3 text-sm">
              <li className="flex gap-3">
                <span className="mt-0.5 text-lg leading-none">&#10003;</span>
                <span>GovTrace displays only <strong className="text-foreground">public government data</strong> published by the Government of Canada.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 text-lg leading-none">&#10003;</span>
                <span>We do not collect personal information about visitors.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 text-lg leading-none">&#10003;</span>
                <span>No cookies, no tracking, no analytics.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 text-lg leading-none">&#10003;</span>
                <span>No user accounts.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 text-lg leading-none">&#10003;</span>
                <span>The source code is fully open — anyone can audit it.</span>
              </li>
            </ul>
          </div>
        </Section>

        <Section title="What data GovTrace displays">
          <p className="mb-3">
            GovTrace displays information drawn entirely from public datasets published by the
            Government of Canada and its agencies. All data is provided under the{' '}
            <a
              href="https://open.canada.ca/en/open-government-licence-canada"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-foreground underline underline-offset-4 hover:text-primary"
            >
              Open Government Licence &mdash; Canada
              <ExternalLink className="ml-0.5 h-3 w-3" />
            </a>
            {' '}or is otherwise publicly accessible on official government websites.
          </p>
          <p>
            The names, amounts, and relationships shown in GovTrace are the same ones already
            published on Elections Canada, open.canada.ca, lobbycanada.gc.ca, ourcommons.ca, and
            other government sources. GovTrace does not add, infer, or editorialize on that data.
            See the{' '}
            <a
              href="/about"
              className="text-foreground underline underline-offset-4 hover:text-primary"
            >
              About page
            </a>
            {' '}for the full list of sources.
          </p>
        </Section>

        <Section title="What data GovTrace does NOT collect">
          <p className="mb-3">
            GovTrace does not collect, store, or process any personal information about the
            people who <em>visit</em> this website.
          </p>
          <ul className="space-y-2 text-sm">
            <li className="flex gap-2">
              <span className="font-medium text-foreground">No accounts</span> — there is no login,
              no registration, and no user database.
            </li>
            <li className="flex gap-2">
              <span className="font-medium text-foreground">No cookies</span> — GovTrace does not
              set any first-party or third-party cookies. Your theme preference is stored in your
              browser&rsquo;s local storage and never sent to any server.
            </li>
            <li className="flex gap-2">
              <span className="font-medium text-foreground">No analytics</span> — we do not use
              Google Analytics, Mixpanel, or any similar tracking service.
            </li>
            <li className="flex gap-2">
              <span className="font-medium text-foreground">No advertising</span> — there are no
              ads and no advertising networks with access to visitor data.
            </li>
            <li className="flex gap-2">
              <span className="font-medium text-foreground">No personal data sent to AI</span> —
              AI (Claude by Anthropic) is used only to match entity names across government datasets
              and to generate plain-language summaries of public statistics. No visitor data is
              ever sent to the AI.
            </li>
          </ul>
        </Section>

        <Section title="Server logs">
          <p>
            Like any web server, GovTrace&rsquo;s hosting infrastructure may retain standard
            HTTP access logs (IP address, request path, timestamp, response code) for a limited
            period for security and debugging purposes. These logs are not shared with third
            parties and are not used for any form of user tracking or profiling.
          </p>
        </Section>

        <Section title="Third-party services">
          <p>
            GovTrace loads fonts from Google Fonts. Google&rsquo;s own{' '}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-foreground underline underline-offset-4 hover:text-primary"
            >
              privacy policy
              <ExternalLink className="ml-0.5 h-3 w-3" />
            </a>
            {' '}applies to those requests. No other third-party scripts are loaded on this site.
          </p>
        </Section>

        <Section title="Open source">
          <p>
            GovTrace is fully open source under the MIT licence. You can inspect the complete
            source code — including database schema, ingestion pipeline, and the web application —
            on{' '}
            <a
              href="https://github.com/guilhermeseckert/GovTrace"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-foreground underline underline-offset-4 hover:text-primary"
            >
              GitHub
              <ExternalLink className="ml-0.5 h-3 w-3" />
            </a>
            . If you believe something in this policy is inaccurate or that the code does not
            reflect what is stated here, please open an issue.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about this privacy policy or about GovTrace in general can be directed to{' '}
            <a
              href="https://github.com/guilhermeseckert/GovTrace/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-foreground underline underline-offset-4 hover:text-primary"
            >
              GitHub Issues
              <ExternalLink className="ml-0.5 h-3 w-3" />
            </a>
            .
          </p>
        </Section>
      </div>
    </main>
  )
}
