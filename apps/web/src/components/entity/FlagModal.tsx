import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { submitFlag } from '@/server-fns/flag'
import { en } from '@/i18n/en'

type FlagModalProps = {
  entityId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FlagModal({ entityId, open, onOpenChange }: FlagModalProps) {
  const [description, setDescription] = useState('')
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClose = () => {
    onOpenChange(false)
    // Reset state after close animation completes
    setTimeout(() => {
      setDescription('')
      setEmail('')
      setSubmitted(false)
      setError(null)
    }, 300)
  }

  const handleSubmit = async () => {
    if (description.trim().length < 10) {
      setError('Please describe the error in at least 10 characters.')
      return
    }
    setError(null)
    setIsSubmitting(true)
    try {
      await submitFlag({
        data: {
          entityId,
          description: description.trim(),
          reporterEmail: email.trim() || undefined,
        },
      })
      setSubmitted(true)
    } catch {
      setError(en.common.error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{en.flag.title}</DialogTitle>
          {!submitted && (
            <DialogDescription>{en.flag.body}</DialogDescription>
          )}
        </DialogHeader>

        {submitted ? (
          <div className="py-4">
            <p className="text-sm">{en.flag.confirmation}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="flag-description" className="text-sm font-medium">
                Describe the error{' '}
                <span aria-hidden="true" className="text-destructive">
                  *
                </span>
              </label>
              <Textarea
                id="flag-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={en.flag.textareaPlaceholder}
                rows={4}
                required
                aria-required="true"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="flag-email" className="text-sm font-medium">
                Your email{' '}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <Input
                id="flag-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={en.flag.emailPlaceholder}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {submitted ? (
            <Button onClick={handleClose}>{en.flag.cancel}</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={handleClose}>
                {en.flag.cancel}
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Submitting\u2026' : en.flag.submit}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
