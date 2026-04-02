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
    <aside className="w-full md:w-60 shrink-0 space-y-4">
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Entity Type</h2>
        <div className="space-y-2">
          {[
            { value: 'all', label: 'All types' },
            { value: 'politician', label: 'Politicians' },
            { value: 'company', label: 'Companies' },
            { value: 'person', label: 'People' },
          ].map((opt) => (
            <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-sm">
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

      <div className="space-y-2">
        <label htmlFor="province-select" className="text-sm font-semibold">
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

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Date Range</h2>
        <div className="space-y-1">
          <label htmlFor="date-from" className="text-xs text-muted-foreground">
            From
          </label>
          <input
            id="date-from"
            type="date"
            value={currentDateFrom ?? ''}
            onChange={(e) => onDateFromChange(e.target.value || undefined)}
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="date-to" className="text-xs text-muted-foreground">
            To
          </label>
          <input
            id="date-to"
            type="date"
            value={currentDateTo ?? ''}
            onChange={(e) => onDateToChange(e.target.value || undefined)}
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
    </aside>
  )
}
