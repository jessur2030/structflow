chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    ?.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.warn("StructFlow side panel behavior failed:", err))

  chrome.contextMenus.create({
    id: "structflow-format-selection",
    title: "Format selection in StructFlow",
    contexts: ["selection"],
  })
})

chrome.contextMenus?.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "structflow-format-selection" && tab?.windowId != null) {
    openStructFlowPanel(tab.windowId)
    chrome.storage.local.set({ structflow_incoming: info.selectionText ?? "" })
  }
})

chrome.commands?.onCommand.addListener((command, tab) => {
  if (command !== "open-structflow-side-panel" || tab?.windowId == null) return
  openStructFlowPanel(tab.windowId)
})

function openStructFlowPanel(windowId: number) {
  if (chrome.sidePanel?.open) {
    chrome.sidePanel.open({ windowId }).catch((err) =>
      console.warn("StructFlow side panel open failed:", err),
    )
    return
  }

  const browserApi = (globalThis as typeof globalThis & {
    browser?: { sidebarAction?: { open?: () => Promise<void> } }
  }).browser

  browserApi?.sidebarAction?.open?.().catch((err) =>
    console.warn("StructFlow sidebar open failed:", err),
  )
}
