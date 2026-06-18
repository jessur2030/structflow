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
    chrome.sidePanel.open({ windowId: tab.windowId }).catch((err) =>
      console.warn("StructFlow side panel open failed:", err),
    )
    chrome.storage.local.set({ structflow_incoming: info.selectionText ?? "" })
  }
})

chrome.commands?.onCommand.addListener((command, tab) => {
  if (command !== "open-structflow-side-panel" || tab?.windowId == null) return
  chrome.sidePanel.open({ windowId: tab.windowId }).catch((err) =>
    console.warn("StructFlow side panel command failed:", err),
  )
})
