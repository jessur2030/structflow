// Edit these with your real URLs. Set a value to an empty string to hide that link.
export interface SupportLink {
  id: string
  label: string
  description: string
  /** lucide-react icon name handled in the component */
  icon: "github" | "coffee" | "heart" | "star"
  url: string
}

export const SUPPORT_LINKS: SupportLink[] = [
  {
    id: "github",
    label: "Star on GitHub",
    description: "Follow development and star the repo",
    icon: "github",
    url: "https://github.com/jessur2030/structflow",
  },
  {
    id: "coffee",
    label: "Buy me a coffee",
    description: "Fuel late-night feature work",
    icon: "coffee",
    url: "https://buymeacoffee.com/jessusrdevn",
  },
]
