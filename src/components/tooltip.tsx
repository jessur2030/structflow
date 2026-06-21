import { useLayoutEffect, useRef, useState, type RefObject } from "react"
import { createPortal } from "react-dom"

type TooltipSide = "top" | "bottom" | "left" | "right"

interface FloatingTooltipProps {
  anchorRef: RefObject<HTMLElement | null>
  label: string
  open: boolean
  preferredSide?: TooltipSide
}

const GAP = 8
const MARGIN = 8

export function FloatingTooltip({
  anchorRef,
  label,
  open,
  preferredSide = "top",
}: FloatingTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number; side: TooltipSide } | null>(null)

  useLayoutEffect(() => {
    setMounted(true)
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null)
      return
    }

    const update = () => {
      const anchor = anchorRef.current
      const tooltip = tooltipRef.current
      if (!anchor || !tooltip) return

      const anchorRect = anchor.getBoundingClientRect()
      const tooltipRect = tooltip.getBoundingClientRect()
      const side = chooseSide(preferredSide, anchorRect, tooltipRect)
      setPosition(placeTooltip(side, anchorRect, tooltipRect))
    }

    update()
    window.addEventListener("resize", update)
    window.addEventListener("scroll", update, true)
    return () => {
      window.removeEventListener("resize", update)
      window.removeEventListener("scroll", update, true)
    }
  }, [anchorRef, open, preferredSide, label])

  if (!mounted || !open) return null

  return createPortal(
    <div
      ref={tooltipRef}
      role="tooltip"
      className="pointer-events-none fixed z-[9999] max-w-[min(18rem,calc(100vw-16px))] rounded-md border border-border bg-popover px-2 py-1 text-[11px] font-medium leading-snug text-popover-foreground opacity-0 shadow-lg"
      style={{
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        opacity: position ? 1 : 0,
      }}
      data-side={position?.side}
    >
      {label}
    </div>,
    document.body,
  )
}

function chooseSide(
  preferredSide: TooltipSide,
  anchor: DOMRect,
  tooltip: DOMRect,
): TooltipSide {
  const space = {
    top: anchor.top,
    bottom: window.innerHeight - anchor.bottom,
    left: anchor.left,
    right: window.innerWidth - anchor.right,
  }

  const required = {
    top: tooltip.height + GAP + MARGIN,
    bottom: tooltip.height + GAP + MARGIN,
    left: tooltip.width + GAP + MARGIN,
    right: tooltip.width + GAP + MARGIN,
  }

  if (space[preferredSide] >= required[preferredSide]) return preferredSide

  const candidates: TooltipSide[] =
    preferredSide === "left" || preferredSide === "right"
      ? ["right", "left", "bottom", "top"]
      : ["top", "bottom", "right", "left"]

  return candidates
    .filter((side) => space[side] >= required[side])
    .sort((a, b) => space[b] - space[a])[0] ?? preferredSide
}

function placeTooltip(side: TooltipSide, anchor: DOMRect, tooltip: DOMRect) {
  let top = 0
  let left = 0

  if (side === "top") {
    top = anchor.top - tooltip.height - GAP
    left = anchor.left + anchor.width / 2 - tooltip.width / 2
  } else if (side === "bottom") {
    top = anchor.bottom + GAP
    left = anchor.left + anchor.width / 2 - tooltip.width / 2
  } else if (side === "left") {
    top = anchor.top + anchor.height / 2 - tooltip.height / 2
    left = anchor.left - tooltip.width - GAP
  } else {
    top = anchor.top + anchor.height / 2 - tooltip.height / 2
    left = anchor.right + GAP
  }

  return {
    top: clamp(top, MARGIN, window.innerHeight - tooltip.height - MARGIN),
    left: clamp(left, MARGIN, window.innerWidth - tooltip.width - MARGIN),
    side,
  }
}

function clamp(value: number, min: number, max: number) {
  if (max < min) return min
  return Math.min(Math.max(value, min), max)
}
