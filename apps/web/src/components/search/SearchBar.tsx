import { useEffect, useRef, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getAutocomplete } from '@/server-fns/search'
import { en } from '@/i18n/en'

type SearchBarProps = {
  initialValue?: string
  onSearch?: (query: string) => void
  autoFocus?: boolean
}

export function SearchBar({ initialValue = '', onSearch, autoFocus = false }: SearchBarProps) {
  const [query, setQuery] = useState(initialValue)
  const [debouncedQuery, setDebouncedQuery] = useState(initialValue)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [isOpen, setIsOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // 200ms debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200)
    return () => clearTimeout(timer)
  }, [query])

  const { data: suggestions, isFetching } = useQuery({
    queryKey: ['autocomplete', debouncedQuery],
    queryFn: () => getAutocomplete({ data: { query: debouncedQuery } }),
    staleTime: 60_000,
    enabled: debouncedQuery.length >= 2,
  })

  const showDropdown = isOpen && (suggestions?.length ?? 0) > 0 && query.length >= 2

  const handleSubmit = (q: string) => {
    if (!q.trim()) return
    setIsOpen(false)
    if (onSearch) {
      onSearch(q)
    } else {
      router.navigate({ to: '/search', search: { q } })
    }
  }

  const handleSelect = (canonicalName: string, id: string) => {
    setQuery(canonicalName)
    setIsOpen(false)
    router.navigate({ to: '/entity/$id', params: { id } })
  }

  return (
    <div
      className="relative w-full"
      role="combobox"
      aria-expanded={showDropdown}
      aria-haspopup="listbox"
    >
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setIsOpen(true)
              setActiveIndex(-1)
            }}
            onFocus={() => setIsOpen(true)}
            onBlur={() => setTimeout(() => setIsOpen(false), 150)}
            placeholder={en.search.placeholder}
            className="h-[52px] pr-10 text-base shadow-md focus:shadow-md"
            aria-autocomplete="list"
            aria-controls={showDropdown ? 'autocomplete-listbox' : undefined}
            aria-activedescendant={showDropdown && activeIndex >= 0 ? `autocomplete-option-${activeIndex}` : undefined}
            autoFocus={autoFocus}
            onKeyDown={(e) => {
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
                  const s = suggestions[activeIndex]
                  handleSelect(s.canonicalName, s.id)
                } else {
                  handleSubmit(query)
                }
              }
              if (e.key === 'Escape') {
                setIsOpen(false)
                setActiveIndex(-1)
              }
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              {isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
        <Button
          type="button"
          onClick={() => handleSubmit(query)}
          className="h-[52px] px-6 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Search className="mr-2 h-4 w-4" />
          {en.search.cta}
        </Button>
      </div>

      {showDropdown && (
        <ul
          id="autocomplete-listbox"
          role="listbox"
          aria-label="Search suggestions"
          className="absolute top-full left-0 right-0 z-50 mt-1 max-h-80 overflow-auto rounded-md border bg-popover shadow-lg"
        >
          {suggestions?.map((s, i) => (
            <li
              key={s.id}
              id={`autocomplete-option-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              className={`flex min-h-[44px] cursor-pointer items-center justify-between px-4 py-2 text-sm hover:bg-secondary ${i === activeIndex ? 'bg-secondary' : ''}`}
              onMouseDown={() => handleSelect(s.canonicalName, s.id)}
            >
              <span>{s.canonicalName}</span>
              <span className="ml-2 text-xs text-muted-foreground capitalize">{s.entityType}</span>
            </li>
          ))}
          {debouncedQuery.length >= 2 && (suggestions?.length ?? 0) === 0 && !isFetching && (
            <li className="flex min-h-[44px] items-center px-4 py-2 text-sm text-muted-foreground">
              {en.search.autocompleteEmpty}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
