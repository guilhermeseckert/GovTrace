export const en = {
  search: {
    placeholder: 'Search politicians, companies, or people\u2026',
    cta: 'Search the database',
    emptyHeading: 'No matching entities found',
    emptyBody: 'Try a different spelling or a shorter name. Entity names may vary across government datasets.',
    emptyHint: "Searching for a company? Try searching without 'Inc.' or 'Ltd.'",
    autocompleteEmpty: 'No matches found \u2014 try a shorter name',
  },
  profile: {
    loading: 'Loading profile\u2026',
    flagButton: 'Flag an error',
    summaryExplanation: 'How do we write this summary?',
    disclaimer: 'Connections shown do not imply wrongdoing.',
    connections_disclaimer: 'Connections shown do not imply wrongdoing.',
  },
  badge: {
    high: 'High confidence',
    medium: 'AI-verified',
    low: 'Unverified',
    explanation: 'How is this calculated?',
  },
  flag: {
    title: 'Flag an error',
    body: 'Help us improve GovTrace. If you believe this entity match is incorrect, let us know.',
    textareaPlaceholder: 'e.g., This profile merges two different people with similar names',
    emailPlaceholder: 'your@email.com \u2014 for follow-up only',
    submit: 'Submit flag',
    cancel: 'Never mind',
    confirmation: 'Thanks \u2014 your flag has been recorded. We review all submissions.',
  },
  table: {
    empty: 'No {dataset} records found for this entity.',
    rowsPerPage: 'Rows per page',
    of: 'of',
  },
  common: {
    error: 'Unable to load data. Try refreshing the page. If this keeps happening, the government data source may be temporarily unavailable.',
    skipToContent: 'Skip to content',
  },
  landing: {
    tagline: 'Follow the money. Connect the dots. Hold power accountable.',
    statsLoading: 'Loading statistics\u2026',
  },
} as const

export type TranslationKey = typeof en
