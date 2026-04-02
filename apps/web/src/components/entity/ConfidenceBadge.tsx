import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { en } from '@/i18n/en'

type ConfidenceBadgeProps = {
  confidenceScore: number | null
  matchMethod: string | null
  aiReasoning: string | null
}

function getState(score: number | null): 'high' | 'medium' | 'low' {
  if (score === null || score < 0.6) return 'low'
  if (score >= 0.85) return 'high'
  return 'medium'
}

const STATE_CONFIG = {
  high: {
    bg: 'bg-[#16a34a]',
    label: en.badge.high,
    Icon: ShieldCheck,
  },
  medium: {
    bg: 'bg-[#d97706]',
    label: en.badge.medium,
    Icon: Shield,
  },
  low: {
    bg: 'bg-[#dc2626]',
    label: en.badge.low,
    Icon: ShieldAlert,
  },
} as const

export function ConfidenceBadge({ confidenceScore, matchMethod, aiReasoning }: ConfidenceBadgeProps) {
  const state = getState(confidenceScore)
  const { bg, label, Icon } = STATE_CONFIG[state]

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-sm text-white transition-opacity hover:opacity-90 ${bg}`}
          aria-label={`Confidence: ${label}. Click for details.`}
        >
          <Icon className="h-4 w-4" />
          <span>{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-2 p-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold">Match Confidence</p>
          {confidenceScore !== null && (
            <p className="text-sm text-muted-foreground">
              Score: <span className="font-medium text-foreground">{confidenceScore.toFixed(2)}</span>
            </p>
          )}
          {matchMethod && (
            <p className="text-sm text-muted-foreground">
              Method:{' '}
              <span className="font-medium capitalize text-foreground">
                {matchMethod.replace(/_/g, ' ')}
              </span>
            </p>
          )}
        </div>
        {aiReasoning && (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              AI Reasoning
            </p>
            <p className="text-sm">{aiReasoning}</p>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          <a href="#" className="underline">
            {en.badge.explanation}
          </a>
        </p>
      </PopoverContent>
    </Popover>
  )
}
