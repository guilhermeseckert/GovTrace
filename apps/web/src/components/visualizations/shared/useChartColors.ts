import { useCallback } from 'react'

/**
 * Returns a function that reads a live CSS variable from :root at call time.
 * Using getComputedStyle ensures D3 color values adapt to dark/light mode.
 * Always call getColor() inside the render/useEffect cycle — not at module level.
 */
export function useChartColors() {
  const getColor = useCallback((cssVar: string): string => {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue(cssVar)
      .trim()
    // CSS vars in this project are raw HSL values (e.g. "213 54% 23%")
    return raw.startsWith('hsl') ? raw : `hsl(${raw})`
  }, [])

  return {
    getColor,
    nodeColors: {
      politician: () => getColor('--primary'),
      person: () => getColor('--muted-foreground'),
      organization: () => getColor('--accent-foreground'),
      company: () => getColor('--destructive'),
      department: () => getColor('--ring'),
    },
  }
}
