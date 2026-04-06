import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeftRight, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getAutocomplete } from '@/server-fns/search'
import { en } from '@/i18n/en'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EntitySelection = {
  id: string
  name: string
  entityType: string
}

export type PathFinderProps = {
  onSearch: (sourceId: string, targetId: string) => void
  loading: boolean
}

// ---------------------------------------------------------------------------
// EntityPicker — single entity autocomplete field
// ---------------------------------------------------------------------------

type EntityPickerProps = {
  label: string
  fieldKey: 'source' | 'target'
  value: EntitySelection | null
  onChange: (value: EntitySelection | null) => void
}

function EntityPicker({ label, fieldKey, value, onChange }: EntityPickerProps) {
  const [query, setQuery] = useState(value?.name ?? '')
  const [debouncedQuery, setDebouncedQuery] = useState(value?.name ?? '')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [isOpen, setIsOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync display name when value changes externally (e.g. swap)
  useEffect(() => {
    setQuery(value?.name ?? '')
  }, [value])

  // 200ms debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200)
    return () => clearTimeout(timer)
  }, [query])

  const { data: suggestions, isFetching } = useQuery({
    queryKey: ['autocomplete', fieldKey, debouncedQuery],
    queryFn: () => getAutocomplete({ data: { query: debouncedQuery } }),
    staleTime: 60_000,
    enabled: debouncedQuery.length >= 2 && !value,
  })

  const showDropdown = isOpen && (suggestions?.length ?? 0) > 0 && query.length >= 2 && !value

  const handleSelect = (suggestion: { id: string; canonicalName: string; entityType: string }) => {
    onChange({ id: suggestion.id, name: suggestion.canonicalName, entityType: suggestion.entityType })
    setQuery(suggestion.canonicalName)
    setIsOpen(false)
    setActiveIndex(-1)
  }

  const handleClear = () => {
    onChange(null)
    setQuery('')
    setDebouncedQuery('')
    setIsOpen(false)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const labelId = `entity-picker-label-${fieldKey}`
  const listboxId = `entity-picker-listbox-${fieldKey}`

  return (
    <div className="flex flex-col gap-1">
      <label id={labelId} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div
        className="relative"
        role="combobox"
        aria-expanded={showDropdown}
        aria-haspopup="listbox"
        aria-labelledby={labelId}
      >
        <Input
          ref={inputRef}
          value={query}
          readOnly={!!value}
          onChange={(e) => {
            if (value) return
            setQuery(e.target.value)
            setIsOpen(true)
            setActiveIndex(-1)
          }}
          onFocus={() => { if (!value) setIsOpen(true) }}
          onBlur={() => setTimeout(() => setIsOpen(false), 150)}
          placeholder={`Search for an entity\u2026`}
          className={`h-11 pr-10 ${value ? 'bg-muted/50 cursor-default' : ''}`}
          aria-autocomplete="list"
          aria-controls={showDropdown ? listboxId : undefined}
          aria-activedescendant={showDropdown && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
          onKeyDown={(e) => {
            if (value) return
            const len = suggestions?.length ?? 0
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActiveIndex((i) => Math.min(i + 1, len - 1))
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActiveIndex((i) => Math.max(i - 1, -1))
            }
            if (e.key === 'Enter') {
              e.preventDefault()
              if (activeIndex >= 0 && suggestions?.[activeIndex]) {
                handleSelect(suggestions[activeIndex])
              }
            }
            if (e.key === 'Escape') {
              setIsOpen(false)
              setActiveIndex(-1)
            }
          }}
        />
        {(query || value) && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={`Clear ${label} selection`}
          >
            {isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </button>
        )}

        {showDropdown && (
          <ul
            id={listboxId}
            role="listbox"
            aria-label={`${label} suggestions`}
            className="absolute top-full left-0 right-0 z-50 mt-1 max-h-72 overflow-auto rounded-md border bg-popover shadow-lg"
          >
            {suggestions?.map((s, i) => (
              <li
                key={s.id}
                id={`${listboxId}-option-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                className={`flex min-h-[44px] cursor-pointer items-center justify-between px-4 py-2 text-sm hover:bg-secondary ${i === activeIndex ? 'bg-secondary' : ''}`}
                onMouseDown={() => handleSelect(s)}
              >
                <span>{s.canonicalName}</span>
                <span className="ml-2 text-xs text-muted-foreground capitalize">{s.entityType}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {value && (
        <p className="text-xs text-muted-foreground capitalize">{value.entityType}</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PathFinder — two-entity picker with swap and submit
// ---------------------------------------------------------------------------

export function PathFinder({ onSearch, loading }: PathFinderProps) {
  const [source, setSource] = useState<EntitySelection | null>(null)
  const [target, setTarget] = useState<EntitySelection | null>(null)

  const handleSwap = () => {
    setSource(target)
    setTarget(source)
  }

  const handleSubmit = () => {
    if (!source || !target) return
    onSearch(source.id, target.id)
  }

  const canSearch = !!source && !!target && !loading

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4">
        {/* Entity picker row */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <EntityPicker
            label={en.pathfinding.sourceLabel}
            fieldKey="source"
            value={source}
            onChange={setSource}
          />

          {/* Swap button — centered vertically on desktop, hidden on mobile */}
          <div className="flex items-end justify-center pb-0.5">
            <button
              type="button"
              onClick={handleSwap}
              disabled={!source && !target}
              className="flex h-11 w-11 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={en.pathfinding.swapEntities}
            >
              <ArrowLeftRight className="h-4 w-4" />
            </button>
          </div>

          <EntityPicker
            label={en.pathfinding.targetLabel}
            fieldKey="target"
            value={target}
            onChange={setTarget}
          />
        </div>

        {/* Find button */}
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!canSearch}
          className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {en.pathfinding.searching}
            </>
          ) : (
            en.pathfinding.findButton
          )}
        </Button>
      </div>
    </div>
  )
}
