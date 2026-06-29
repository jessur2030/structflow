import { Heart, Coffee, Star, ExternalLink } from "lucide-react"
import { SUPPORT_LINKS, type SupportLink } from "@/lib/support-links"
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover"

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 016 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z" />
    </svg>
  )
}

const ICONS = {
  github: GithubIcon,
  coffee: Coffee,
  heart: Heart,
  star: Star,
} as const

export function SupportButton() {
  const links = SUPPORT_LINKS.filter((l) => l.url.trim().length > 0)
  if (links.length === 0) return null

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Support StructFlow"
          className="flex h-7 cursor-pointer items-center gap-1 rounded-md border border-border px-2 text-compact font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-[state=open]:bg-secondary data-[state=open]:text-foreground"
        >
          <Heart className="h-3.5 w-3.5 text-(--accent-heart,#e0245e)" />
          Support
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        <div className="px-3 py-2">
          <p className="text-compact font-semibold">Enjoying StructFlow?</p>
          <p className="text-label leading-snug text-muted-foreground">
            It&apos;s free and open source. Your support keeps it growing.
          </p>
        </div>
        <div className="h-px bg-border" />
        <div className="py-1">
          {links.map((link) => (
            <SupportRow key={link.id} link={link} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function SupportRow({ link }: { link: SupportLink }) {
  const Icon = ICONS[link.icon] ?? Heart
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2.5 px-3 py-2 hover:bg-secondary"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary text-foreground">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-compact font-medium">{link.label}</span>
        <span className="block truncate text-label leading-tight text-muted-foreground">{link.description}</span>
      </span>
      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
    </a>
  )
}
