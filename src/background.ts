// StructFlow service worker (MV3 background).
// Opens the side panel when the toolbar icon is clicked.

chrome.runtime.onInstalled.addListener(() => {
  // Allow the action button to toggle the side panel open.
  chrome.sidePanel
    ?.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.log("[v0] setPanelBehavior failed:", err))

  // Context menu: send selected text straight into StructFlow.
  chrome.contextMenus.create({
    id: "structflow-format-selection",
    title: "Format selection in StructFlow",
    contexts: ["selection"],
  })
})

chrome.contextMenus?.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "structflow-format-selection" && tab?.windowId != null) {
    chrome.sidePanel.open({ windowId: tab.windowId }).catch((err) =>
      console.log("[v0] sidePanel.open failed:", err),
    )
    // Stash the selection so the panel can pick it up on load.
    chrome.storage.local.set({ structflow_incoming: info.selectionText ?? "" })
  }
})
