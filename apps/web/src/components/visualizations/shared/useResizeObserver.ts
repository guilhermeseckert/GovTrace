import { useEffect, useState } from 'react'

type Dimensions = { width: number; height: number }

/**
 * Observes a container element's content box size using ResizeObserver.
 * Returns { width: 0, height: 0 } on server and before first measurement.
 * Cleans up the observer on unmount.
 */
export function useResizeObserver(
  ref: React.RefObject<HTMLElement | null>
): Dimensions {
  const [dimensions, setDimensions] = useState<Dimensions>({ width: 0, height: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })

    observer.observe(el)
    return () => { observer.disconnect() }
  }, [ref])

  return dimensions
}
