import { Cog } from "lucide-react"
import { IconButton } from "./icon-button"

interface SettingsButtonProps {
  onOpen: () => void
}

/** Header gear that opens the in-panel Settings view. */
export function SettingsButton({ onOpen }: SettingsButtonProps) {
  return (
    <IconButton label="Settings" onClick={onOpen}>
      <Cog className="h-4 w-4" />
    </IconButton>
  )
}
