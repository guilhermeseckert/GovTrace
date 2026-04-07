import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ArrowRight,
  ExternalLink,
  FileText,
  Gavel,
  Gift,
  Globe,
  Heart,
  MessageSquare,
  Scale,
  Users,
  Vote,
  Info,
  BookOpen,
  Building2,
  TrendingUp,
} from 'lucide-react'

export const Route = createFileRoute('/about')({
  head: () => ({
    meta: [{ title: 'About | GovTrace' }],
  }),
  component: AboutPage,
})

const DATA_SOURCES = [
  {
    name: 'Elections Canada — Political Donations',
    description:
      'Contribution records for federal parties, candidates, and riding associations. Includes donor names, amounts, and dates.',
    url: 'https://www.elections.ca/content.aspx?section=fin&dir=oth&document=index&lang=e',
    Icon: Vote,
    iconColor: 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
  },
  {
    name: 'ProActive Disclosure — Federal Contracts',
    description:
      'Government contracts awarded to vendors. Includes company names, dollar values, departments, and descriptions of work.',
    url: 'https://open.canada.ca/data/en/dataset/d8f85d91-7dec-4fd1-8055-483b77225d8b',
    Icon: FileText,
    iconColor: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
  },
  {
    name: 'ProActive Disclosure — Grants & Contributions',
    description:
      'Grants and contributions awarded by federal departments. Shows recipient organizations, amounts, and program names.',
    url: 'https://open.canada.ca/data/en/dataset/432527ab-7aac-45b5-81d6-7b1a6f51e59b',
    Icon: Gift,
    iconColor: 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
  },
  {
    name: 'Office of the Commissioner of Lobbying — Registrations',
    description:
      'Registered lobbyists and their clients. Shows who is lobbying the federal government, on behalf of which organizations, and on what subjects.',
    url: 'https://lobbycanada.gc.ca/app/secure/ocl/lrs/do/guest',
    Icon: Users,
    iconColor: 'bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400',
  },
  {
    name: 'Office of the Commissioner of Lobbying — Communications',
    description:
      'Records of communication between registered lobbyists and designated public office holders.',
    url: 'https://lobbycanada.gc.ca/app/secure/ocl/lrs/do/guest',
    Icon: MessageSquare,
    iconColor: 'bg-teal-100 text-teal-600 dark:bg-teal-950 dark:text-teal-400',
  },
  {
    name: 'IATI — International Aid (Global Affairs Canada)',
    description:
      'Overseas development aid projects funded by Global Affairs Canada. Shows implementing organizations, recipient countries, budgets, and disbursements.',
    url: 'https://open.canada.ca/data/en/dataset/2f7e22f0-88f6-430c-9723-547043f898ad',
    Icon: Heart,
    iconColor: 'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400',
  },
  {
    name: 'ourcommons.ca — Parliamentary Voting Records',
    description:
      'House of Commons division voting records covering every recorded vote since the 38th Parliament (2004). Shows how each MP voted on every bill and motion.',
    url: 'https://www.ourcommons.ca/members/en/votes',
    Icon: Gavel,
    iconColor: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  },
  {
    name: 'Public Accounts of Canada — Expenditures',
    description:
      'Annual federal government expenditures by department and program, from the Receiver General for Canada.',
    url: 'https://www.tpsgc-pwgsc.gc.ca/recgen/cpc-pac/index-eng.html',
    Icon: TrendingUp,
    iconColor: 'bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400',
  },
  {
    name: 'Governor General — Governor in Council Appointments',
    description:
      'Federal appointments to boards, commissions, and Crown corporations made by the Governor in Council.',
    url: 'https://www.appointments.gc.ca/slctnPrss.asp?menu=2&lang=eng',
    Icon: Building2,
    iconColor: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400',
  },
  {
    name: 'Office of the Conflict of Interest and Ethics Commissioner',
    description:
      'Disclosed travel and hospitality expenses for federal ministers, ministerial staff, and senior public servants.',
    url: 'https://ciec-ccie.parl.gc.ca/en',
    Icon: Scale,
    iconColor: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  },
  {
    name: 'Privy Council Office — Ministerial Travel',
    description:
      'Proactive disclosure of travel expenses by ministers and their exempt staff.',
    url: 'https://www.canada.ca/en/privy-council/services/ministerial-expenses.html',
    Icon: Globe,
    iconColor: 'bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400',
  },
  {
    name: 'Gazette Regulations Database',
    description:
      'Federal regulations published in the Canada Gazette, cross-referenced with lobbying activity to surface who lobbied for what regulatory change.',
    url: 'https://www.gazette.gc.ca/rp-pr/p2/index-eng.html',
    Icon: BookOpen,
    iconColor: 'bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-950 dark:text-fuchsia-400',
  },
  {
    name: 'Statistics Canada — National Debt & Fiscal Data',
    description:
      'Federal government fiscal aggregates including revenues, expenditures, and accumulated deficit.',
    url: 'https://www150.statcan.gc.ca/n1/en/subjects/government_finances',
    Icon: TrendingUp,
    iconColor: 'bg-lime-100 text-lime-600 dark:bg-lime-950 dark:text-lime-400',
  },
  {
    name: 'ourcommons.ca — Parliamentary Bills',
    description:
      'Status and text of all bills introduced in the House of Commons, including sponsoring MPs and reading results.',
    url: 'https://www.parl.ca/legisinfo/en/bills',
    Icon: FileText,
    iconColor: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400',
  },
  {
    name: 'Parliament — MP & Senator Profiles',
    description:
      'Biographical and contact information for all current and former Members of Parliament and Senators.',
    url: 'https://www.ourcommons.ca/members/en',
    Icon: Users,
    iconColor: 'bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400',
  },
] as const

function AboutPage() {
  return (
    <main id="main-content">
      {/* Hero */}
      <section className="bg-background">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
            <Info className="h-7 w-7 text-primary" />
          </div>
          <h1 className="font-serif text-4xl">About GovTrace</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Government data is scattered across dozens of sites. GovTrace connects the dots.
          </p>
        </div>
      </section>

      {/* Who built this */}
      <section className="bg-muted/30">
        <div className="mx-auto max-w-3xl px-4 py-14">
          <h2 className="mb-6 font-serif text-3xl">Who built this</h2>
          <p className="mb-4 text-base leading-relaxed text-muted-foreground">
            GovTrace is an open-source civic transparency project by{' '}
            <a
              href="https://github.com/guilhermeseckert"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
            >
              Guilherme Eckert
            </a>
            . It is free to use, free to audit, and free to contribute to.
          </p>
          <p className="text-base leading-relaxed text-muted-foreground">
            The goal is simple: anyone — a journalist, a researcher, a curious citizen — should be
            able to type a name and instantly understand how that person or organization connects to
            the flow of public money and political influence in Canada.
          </p>
        </div>
      </section>

      {/* Why */}
      <section className="bg-background">
        <div className="mx-auto max-w-3xl px-4 py-14">
          <h2 className="mb-6 font-serif text-3xl">Why it exists</h2>
          <p className="mb-4 text-base leading-relaxed text-muted-foreground">
            Canada publishes excellent open data — Elections Canada, the Lobbying Registry,
            federal contracts, international aid — but each dataset lives on a different government
            website, in a different format, with different search tools.
          </p>
          <p className="mb-4 text-base leading-relaxed text-muted-foreground">
            Connecting them by hand takes a journalist hours of work. GovTrace does it in
            milliseconds using AI-assisted entity matching to recognize that &ldquo;CGI Inc.&rdquo;
            in contracts and &ldquo;CGI Group&rdquo; in lobbying records are the same organization.
          </p>
          <p className="text-base leading-relaxed text-muted-foreground">
            No editorializing. No accusations. Just the public record, organized so anyone can
            read it.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-muted/30">
        <div className="mx-auto max-w-3xl px-4 py-14">
          <h2 className="mb-6 font-serif text-3xl">How it works</h2>
          <div className="space-y-5">
            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-serif text-primary-foreground">
                1
              </div>
              <div>
                <p className="font-medium text-foreground">Ingest</p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                  A background pipeline fetches and normalizes public datasets on a weekly or
                  quarterly schedule, depending on how often the source updates.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-serif text-primary-foreground">
                2
              </div>
              <div>
                <p className="font-medium text-foreground">AI entity matching</p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                  Claude (Anthropic&rsquo;s AI) compares names across datasets to resolve the same
                  person or organization appearing under slightly different spellings. Every match
                  shows a confidence score and the AI&rsquo;s reasoning so you can judge it
                  yourself.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-serif text-primary-foreground">
                3
              </div>
              <div>
                <p className="font-medium text-foreground">Fuzzy search</p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                  PostgreSQL&rsquo;s{' '}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">pg_trgm</code>{' '}
                  extension powers tolerant full-text search — typos and partial names still
                  find the right entity.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-serif text-primary-foreground">
                4
              </div>
              <div>
                <p className="font-medium text-foreground">Cross-referencing</p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                  Once you search a name, GovTrace shows all their records across every dataset
                  on a single page — donations, contracts, grants, lobbying meetings, votes,
                  and more — each linking back to the original government source.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Data sources */}
      <section className="bg-background">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <h2 className="mb-4 text-center font-serif text-3xl">Data Sources</h2>
          <p className="mx-auto mb-10 max-w-2xl text-center text-sm text-muted-foreground">
            All 15 datasets are published by the Government of Canada under the{' '}
            <a
              href="https://open.canada.ca/en/open-government-licence-canada"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Open Government Licence &mdash; Canada
            </a>
            {' '}or are publicly accessible on official government websites.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DATA_SOURCES.map((source) => (
              <div
                key={source.name}
                className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${source.iconColor}`}
                  >
                    <source.Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-serif text-base leading-snug">{source.name}</h3>
                </div>
                <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
                  {source.description}
                </p>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-fit items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
                >
                  View original source
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open source */}
      <section className="bg-muted/30">
        <div className="mx-auto max-w-3xl px-4 py-14">
          <h2 className="mb-6 font-serif text-3xl">Open source</h2>
          <p className="mb-4 text-base leading-relaxed text-muted-foreground">
            GovTrace is MIT-licensed and open source. The full source code — ingestion pipeline,
            database schema, entity matching logic, and web app — is on GitHub.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://github.com/guilhermeseckert/GovTrace"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <ExternalLink className="h-4 w-4" />
              View on GitHub
            </a>
            <a
              href="https://github.com/guilhermeseckert/GovTrace/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <ExternalLink className="h-4 w-4" />
              Report an issue
            </a>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="bg-background">
        <div className="mx-auto max-w-3xl px-4 py-14">
          <h2 className="mb-6 font-serif text-3xl">Contact</h2>
          <p className="mb-4 text-base leading-relaxed text-muted-foreground">
            Have a question about the data, found an error, or want to suggest a new data source?
            Open an issue on GitHub — it&rsquo;s the best way to reach the project.
          </p>
          <a
            href="https://github.com/guilhermeseckert/GovTrace/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Open a GitHub issue
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-14 text-center">
          <p className="text-lg text-muted-foreground">Ready to start exploring?</p>
          <Link
            to="/search"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Search a name
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  )
}
