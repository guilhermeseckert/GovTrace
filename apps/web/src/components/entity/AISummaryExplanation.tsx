import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type AISummaryExplanationProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AISummaryExplanation({ open, onOpenChange }: AISummaryExplanationProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>How GovTrace writes summaries</DialogTitle>
          <DialogDescription>
            AI-generated summaries from public government data
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <p>
            Summaries are written by Claude (Anthropic&rsquo;s AI), using only the counts and
            categories of government records available in GovTrace&rsquo;s database.
          </p>
          <p>
            The AI is given only statistical information &mdash; total numbers of donations,
            contracts, grants, and lobbying activities &mdash; and asked to write a plain-language
            description that a non-expert could understand.
          </p>
          <p>
            <strong>What summaries do not contain:</strong> editorial judgments, allegations of
            wrongdoing, speculation about intent, or any information not directly from government
            records.
          </p>
          <p className="italic text-muted-foreground">
            Connections shown in GovTrace do not imply wrongdoing. All data is sourced from public
            government datasets under the Open Government Licence &ndash; Canada.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
