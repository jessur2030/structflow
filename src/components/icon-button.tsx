import { cn } from "@/lib/utils"
import { useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react"
import { FloatingTooltip } from "./tooltip"

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  active?: boolean
  children: ReactNode
}

export function IconButton({ label, active, className, children, ...props }: IconButtonProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={label}
        {...props}
        onPointerEnter={(event) => {
          props.onPointerEnter?.(event)
          setShowTooltip(true)
        }}
        onPointerLeave={(event) => {
          props.onPointerLeave?.(event)
          setShowTooltip(false)
        }}
        onFocus={(event) => {
          props.onFocus?.(event)
          setShowTooltip(true)
        }}
        onBlur={(event) => {
          props.onBlur?.(event)
          setShowTooltip(false)
        }}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors",
          "hover:bg-secondary hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:pointer-events-none disabled:opacity-40",
          active && "bg-secondary text-foreground",
          className,
        )}
      >
        {children}
      </button>
      <FloatingTooltip anchorRef={ref} label={label} open={showTooltip && !props.disabled} />
    </>
  )
}
