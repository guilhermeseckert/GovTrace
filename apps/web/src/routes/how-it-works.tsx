import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ArrowRight,
  CheckCircle,
  ExternalLink,
  FileText,
  Gift,
  MessageSquare,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Users,
  Vote,
  XCircle,
} from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

export const Route = createFileRoute('/how-it-works')({
  component: HowItWorksPage,
})

const DATA_SOURCES = [
  {
    name: 'Elections Canada',
    description:
      'Political donation records including donor names, amounts, recipients, and dates. Covers contributions to federal parties, candidates, and riding associations.',
    frequency: 'Updated weekly',
    url: 'https://www.elections.ca/content.aspx?section=fin&dir=oth&document=index&lang=e',
    Icon: Vote,
    iconColor: 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
  },
  {
    name: 'Federal Contracts',
    description:
      'Government contracts awarded to companies and organizations. Includes vendor names, contract values, departments, and descriptions of work.',
    frequency: 'Updated quarterly',
    url: 'https://open.canada.ca/data/en/dataset/d8f85d91-7dec-4fd1-8055-483b77225d8b',
    Icon: FileText,
    iconColor: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
  },
  {
    name: 'Federal Grants',
    description:
      'Grants and contributions awarded by federal departments. Shows recipient organizations, amounts, program names, and purposes.',
    frequency: 'Updated quarterly',
    url: 'https://open.canada.ca/data/en/dataset/432527ab-7aac-45b5-81d6-7b1a6f51e59b',
    Icon: Gift,
    iconColor: 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
  },
  {
    name: 'Lobbyist Registrations',
    description:
      'Registered lobbyists and their clients. Shows who is lobbying the federal government, on behalf of which organizations, and on what subjects.',
    frequency: 'Updated weekly',
    url: 'https://lobbycanada.gc.ca/app/secure/ocl/lrs/do/guest',
    Icon: Users,
    iconColor: 'bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400',
  },
  {
    name: 'Lobbyist Communications',
    description:
      'Records of communication between registered lobbyists and designated public office holders. Shows who met with whom and when.',
    frequency: 'Updated weekly',
    url: 'https://lobbycanada.gc.ca/app/secure/ocl/lrs/do/guest',
    Icon: MessageSquare,
    iconColor: 'bg-teal-100 text-teal-600 dark:bg-teal-950 dark:text-teal-400',
  },
] as const

const STEPS = [
  {
    number: 1,
    title: 'Search a Name',
    description:
      'Type any name into the search bar: a politician, company, or person. GovTrace searches across all government datasets instantly.',
  },
  {
    number: 2,
    title: 'See Their Connections',
    description:
      'View donations, contracts, grants, and lobbying activity all in one place. Every record links back to the original government source.',
  },
  {
    number: 3,
    title: 'Understand the Money Trail',
    description:
      'Interactive visualizations show you the flow: who donated to whom, which companies got contracts, and how lobbying connects to spending.',
  },
] as const

const AI_DOES = [
  'Match the same person or company across different datasets (e.g. finding "CGI Inc." in contracts and "CGI Group" in lobbying records)',
  'Write plain-language summaries from government statistics so anyone can understand the data',
] as const

const AI_DOES_NOT = [
  'Make accusations or allegations of wrongdoing',
  'Add editorial judgment or opinion',
  'Speculate about intent or motivation',
  'Use any information beyond public government records',
] as const

const CONFIDENCE_TIERS = [
  {
    label: 'High Confidence',
    range: '85%+ — Strong match across multiple datasets',
    bg: 'bg-[#16a34a]',
    Icon: ShieldCheck,
  },
  {
    label: 'Medium Confidence',
    range: '60-85% — Reviewed by AI with reasoning',
    bg: 'bg-[#d97706]',
    Icon: Shield,
  },
  {
    label: 'Low Confidence',
    range: 'Below 60% — Uncertain, flagged for review',
    bg: 'bg-[#dc2626]',
    Icon: ShieldAlert,
  },
] as const

const FAQ_ITEMS = [
  {
    question: 'Is this legal?',
    answer:
      'Yes. All data comes from public government datasets published under the Open Government Licence \u2014 Canada. Anyone can access these records. GovTrace just makes it easier to search and connect them.',
  },
  {
    question: 'Can I trust the AI?',
    answer:
      "The AI only uses public government data to match names and write summaries. It never makes accusations or judgments. Every AI decision shows a confidence score and reasoning, so you can see exactly why it made a match. If something looks wrong, you can flag it.",
  },
  {
    question: 'What does a connection mean?',
    answer:
      'A connection means two names appear in related government records \u2014 for example, a person donated to a politician, or a company received a contract. It does not mean anything improper happened. Many connections are routine and expected.',
  },
  {
    question: 'Where does the data come from?',
    answer:
      'Five public federal datasets: Elections Canada (political donations), open.canada.ca (contracts and grants), and lobbycanada.gc.ca (lobbying registrations and communications). Each record links to the original government source.',
  },
  {
    question: 'Who built this?',
    answer:
      'GovTrace is an open-source civic technology project. The code is available on GitHub. It was built to make public data more accessible to everyone \u2014 journalists, researchers, and curious citizens.',
  },
] as const

function HowItWorksPage() {
  return (
    <main id="main-content">
      {/* Hero Section */}
      <section className="bg-background">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center">
          <h1 className="font-serif text-4xl">How GovTrace Works</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Search a name and instantly see how money and influence flow through
            Canadian federal government records.
          </p>
        </div>
      </section>

      {/* Data Sources Section */}
      <section className="bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <h2 className="mb-10 text-center font-serif text-3xl">
            Where the Data Comes From
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {DATA_SOURCES.map((source) => (
              <div
                key={source.name}
                className="rounded-xl border bg-card p-5 shadow-sm"
              >
                <div className="mb-3 flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${source.iconColor}`}
                  >
                    <source.Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-serif text-lg">{source.name}</h3>
                </div>
                <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
                  {source.description}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    {source.frequency}
                  </span>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
                  >
                    View source
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Step-by-Step Walkthrough Section */}
      <section className="bg-background">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <h2 className="mb-10 text-center font-serif text-3xl">
            How to Use GovTrace
          </h2>
          <div className="flex flex-col items-start gap-8 md:flex-row md:items-start md:gap-4">
            {STEPS.map((step, i) => (
              <div
                key={step.number}
                className="flex flex-1 flex-col items-center text-center"
              >
                <div className="relative flex items-center">
                  {i > 0 && (
                    <div className="absolute right-full mr-2 hidden h-px w-8 border-t-2 border-dashed border-muted-foreground/30 md:block" />
                  )}
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary font-serif text-xl text-primary-foreground">
                    {step.number}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="absolute left-full ml-2 hidden h-px w-8 border-t-2 border-dashed border-muted-foreground/30 md:block" />
                  )}
                </div>
                <h3 className="mt-4 font-serif text-xl">{step.title}</h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Transparency Section */}
      <section className="bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <h2 className="mb-10 text-center font-serif text-3xl">
            How AI Helps (and What It Doesn&rsquo;t Do)
          </h2>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* What AI Does */}
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <h3 className="mb-4 font-serif text-xl">What AI Does</h3>
              <ul className="space-y-3">
                {AI_DOES.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-relaxed">
                    <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* What AI Doesn't Do */}
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <h3 className="mb-4 font-serif text-xl">
                What AI Doesn&rsquo;t Do
              </h3>
              <ul className="space-y-3">
                {AI_DOES_NOT.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-relaxed">
                    <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500 dark:text-red-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Confidence Tiers */}
          <div className="mt-10">
            <h3 className="mb-4 text-center font-serif text-xl">
              Confidence Scores
            </h3>
            <p className="mx-auto mb-6 max-w-2xl text-center text-sm text-muted-foreground">
              Every AI match shows a confidence badge so you can see how certain
              the system is. Higher scores mean stronger evidence across multiple
              datasets.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              {CONFIDENCE_TIERS.map((tier) => (
                <div
                  key={tier.label}
                  className="flex items-center gap-2 rounded-lg border bg-card px-4 py-3 shadow-sm"
                >
                  <div
                    className={`flex items-center gap-1 rounded px-2 py-1 text-sm text-white ${tier.bg}`}
                  >
                    <tier.Icon className="h-4 w-4" />
                    <span>{tier.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {tier.range}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Caveat */}
          <p className="mt-8 text-center text-sm italic text-muted-foreground">
            Connections shown in GovTrace do not imply wrongdoing. All data is
            sourced from public government datasets under the Open Government
            Licence &ndash; Canada.
          </p>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-background">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <h2 className="mb-10 text-center font-serif text-3xl">
            Frequently Asked Questions
          </h2>
          <div className="mx-auto max-w-2xl">
            <Accordion>
              {FAQ_ITEMS.map((faq, i) => (
                <AccordionItem key={faq.question} value={`faq-${i}`}>
                  <AccordionTrigger className="text-base">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {faq.answer}
                    </p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center">
          <p className="text-lg text-muted-foreground">
            Ready to explore?
          </p>
          <Link
            to="/search"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try searching a name
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  )
}
