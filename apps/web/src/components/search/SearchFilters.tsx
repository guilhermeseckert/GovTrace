import { format, parseISO } from 'date-fns'
import { CalendarIcon, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// Canadian provinces and territories — all 13
const PROVINCES = [
  { value: 'AB', label: 'Alberta' },
  { value: 'BC', label: 'British Columbia' },
  { value: 'MB', label: 'Manitoba' },
  { value: 'NB', label: 'New Brunswick' },
  { value: 'NL', label: 'Newfoundland and Labrador' },
  { value: 'NS', label: 'Nova Scotia' },
  { value: 'NT', label: 'Northwest Territories' },
  { value: 'NU', label: 'Nunavut' },
  { value: 'ON', label: 'Ontario' },
  { value: 'PE', label: 'Prince Edward Island' },
  { value: 'QC', label: 'Quebec' },
  { value: 'SK', label: 'Saskatchewan' },
  { value: 'YT', label: 'Yukon' },
]

type SearchFiltersProps = {
  currentType: string
  currentProvince: string | undefined
  currentDateFrom: string | undefined
  currentDateTo: string | undefined
  onTypeChange: (type: string) => void
  onProvinceChange: (province: string | undefined) => void
  onDateFromChange: (date: string | undefined) => void
  onDateToChange: (date: string | undefined) => void
}

function DatePicker({
  value,
  onChange,
  label,
}: {
  value: string | undefined
  onChange: (date: string | undefined) => void
  label: string
}) {
  const selected = value ? parseISO(value) : undefined

  return (
    <div className="flex items-center gap-2">
      <span className="w-10 shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`h-8 flex-1 cursor-pointer justify-start text-left text-xs font-normal ${
              !selected ? 'text-muted-foreground' : ''
            }`}
          >
            <CalendarIcon className="mr-1.5 h-3 w-3 text-muted-foreground" />
            {selected ? format(selected, 'MMM d, yyyy') : 'Any'}
            {selected && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onChange(undefined)
                }}
                className="ml-auto cursor-pointer rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                aria-label={`Clear ${label.toLowerCase()} date`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start" side="bottom">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(date) => {
              if (date) {
                const yyyy = date.getFullYear()
                const mm = String(date.getMonth() + 1).padStart(2, '0')
                const dd = String(date.getDate()).padStart(2, '0')
                onChange(`${yyyy}-${mm}-${dd}`)
              } else {
                onChange(undefined)
              }
            }}
            defaultMonth={selected}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function SearchFilters({
  currentType,
  currentProvince,
  currentDateFrom,
  currentDateTo,
  onTypeChange,
  onProvinceChange,
  onDateFromChange,
  onDateToChange,
}: SearchFiltersProps) {
  return (
    <aside className="w-full shrink-0 space-y-1 md:w-60">
      {/* Entity Type */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Entity Type</h2>
        <div className="space-y-1">
          {[
            { value: 'all', label: 'All types' },
            { value: 'politician', label: 'Politicians' },
            { value: 'company', label: 'Companies' },
            { value: 'person', label: 'People' },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                currentType === opt.value
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-foreground hover:bg-muted/50'
              }`}
            >
              <input
                type="radio"
                name="entity-type"
                value={opt.value}
                checked={currentType === opt.value}
                onChange={() => onTypeChange(opt.value)}
                className="h-4 w-4 accent-primary"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {/* Province */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <label htmlFor="province-select" className="mb-3 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Province
        </label>
        <Select
          value={currentProvince ?? 'all'}
          onValueChange={(v) => onProvinceChange(v === 'all' ? undefined : v)}
        >
          <SelectTrigger id="province-select" className="w-full">
            <SelectValue placeholder="All provinces" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All provinces</SelectItem>
            {PROVINCES.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date Range */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date Range</h2>
        <div className="space-y-2">
          <DatePicker
            value={currentDateFrom}
            onChange={onDateFromChange}
            label="From"
          />
          <DatePicker
            value={currentDateTo}
            onChange={onDateToChange}
            label="To"
          />
        </div>
      </div>
    </aside>
  )
}
