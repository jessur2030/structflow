// StructFlow in-page JSON viewer.
// Runs on every page; if the document is raw JSON, it replaces the plain
// text with a pretty, collapsible, searchable tree. Vanilla DOM only (no React)
// so it stays lightweight and isolated from page scripts.
//
// IMPORTANT: This file must stay self-contained (no cross-module imports), so
// Vite emits it as a single classic script that Chrome can inject directly.

interface SyntaxColors {
  bg: string
  fg: string
  gutter: string
  key: string
  string: string
  number: string
  boolean: string
  null: string
  comment: string
  keyword: string
  func: string
  attr: string
  punctuation: string
  match: string
}
interface SyntaxTheme {
  id: string
  base: "dark" | "light"
  colors: SyntaxColors
}

// Inlined palettes (kept in sync with src/lib/syntax-themes.ts).
const SYNTAX_THEMES: SyntaxTheme[] = [
  { id: "vscode-dark", base: "dark", colors: { bg: "#1e1e1e", fg: "#d4d4d4", gutter: "#858585", key: "#9cdcfe", string: "#ce9178", number: "#b5cea8", boolean: "#569cd6", null: "#569cd6", comment: "#6a9955", keyword: "#c586c0", func: "#dcdcaa", attr: "#9cdcfe", punctuation: "#808080", match: "#613214" } },
  { id: "vscode-light", base: "light", colors: { bg: "#ffffff", fg: "#1f1f1f", gutter: "#999999", key: "#0451a5", string: "#a31515", number: "#098658", boolean: "#0000ff", null: "#0000ff", comment: "#008000", keyword: "#af00db", func: "#795e26", attr: "#0451a5", punctuation: "#7a7a7a", match: "#ffe9a8" } },
  { id: "github-dark", base: "dark", colors: { bg: "#0d1117", fg: "#e6edf3", gutter: "#6e7681", key: "#79c0ff", string: "#a5d6ff", number: "#79c0ff", boolean: "#79c0ff", null: "#ff7b72", comment: "#8b949e", keyword: "#ff7b72", func: "#d2a8ff", attr: "#7ee787", punctuation: "#8b949e", match: "#3b2e0a" } },
  { id: "github-light", base: "light", colors: { bg: "#ffffff", fg: "#1f2328", gutter: "#8c959f", key: "#0550ae", string: "#0a3069", number: "#0550ae", boolean: "#0550ae", null: "#cf222e", comment: "#6e7781", keyword: "#cf222e", func: "#8250df", attr: "#116329", punctuation: "#6e7781", match: "#fff8c5" } },
  { id: "monokai", base: "dark", colors: { bg: "#272822", fg: "#f8f8f2", gutter: "#90908a", key: "#a6e22e", string: "#e6db74", number: "#ae81ff", boolean: "#ae81ff", null: "#ae81ff", comment: "#75715e", keyword: "#f92672", func: "#a6e22e", attr: "#66d9ef", punctuation: "#f8f8f2", match: "#49483e" } },
  { id: "dracula", base: "dark", colors: { bg: "#282a36", fg: "#f8f8f2", gutter: "#6272a4", key: "#8be9fd", string: "#f1fa8c", number: "#bd93f9", boolean: "#bd93f9", null: "#bd93f9", comment: "#6272a4", keyword: "#ff79c6", func: "#50fa7b", attr: "#50fa7b", punctuation: "#f8f8f2", match: "#44475a" } },
  { id: "nord", base: "dark", colors: { bg: "#2e3440", fg: "#d8dee9", gutter: "#616e88", key: "#8fbcbb", string: "#a3be8c", number: "#b48ead", boolean: "#81a1c1", null: "#81a1c1", comment: "#616e88", keyword: "#81a1c1", func: "#88c0d0", attr: "#8fbcbb", punctuation: "#eceff4", match: "#434c5e" } },
  { id: "solarized-light", base: "light", colors: { bg: "#fdf6e3", fg: "#586e75", gutter: "#93a1a1", key: "#268bd2", string: "#2aa198", number: "#d33682", boolean: "#6c71c4", null: "#6c71c4", comment: "#93a1a1", keyword: "#859900", func: "#b58900", attr: "#268bd2", punctuation: "#657b83", match: "#eee8d5" } },
]

function getSyntaxTheme(id: string): SyntaxTheme {
  return SYNTAX_THEMES.find((t) => t.id === id) ?? SYNTAX_THEMES[0]
}

const SYNTAX_KEY = "structflow_syntax_theme"
const THEME_KEY = "structflow_theme"
const ENABLED_KEY = "structflow_inpage_enabled"

interface Settings {
  syntaxTheme: SyntaxTheme
  appDark: boolean
  enabled: boolean
}

function readSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    const fallback: Settings = {
      syntaxTheme: getSyntaxTheme("vscode-dark"),
      appDark: true,
      enabled: true,
    }
    try {
      if (!chrome?.storage?.local) {
        resolve(fallback)
        return
      }
      chrome.storage.local.get([SYNTAX_KEY, THEME_KEY, ENABLED_KEY], (res) => {
        const rawSyn = res?.[SYNTAX_KEY]
        const rawTheme = res?.[THEME_KEY]
        const rawEnabled = res?.[ENABLED_KEY]
        const synId = typeof rawSyn === "string" ? rawSyn : "vscode-dark"
        const themeMode =
          rawTheme === "dark" || rawTheme === "light" || rawTheme === "system"
            ? rawTheme
            : "system"
        const appDark =
          themeMode === "dark"
            ? true
            : themeMode === "light"
              ? false
              : window.matchMedia("(prefers-color-scheme: dark)").matches
        resolve({
          syntaxTheme: getSyntaxTheme(synId),
          appDark,
          enabled: rawEnabled !== false,
        })
      })
    } catch {
      resolve(fallback)
    }
  })
}

/** Detect whether the current document is a raw JSON payload. */
function detectJson(): { raw: string; data: unknown } | null {
  const body = document.body
  if (!body) return null

  // Primary signal: the response was served as JSON. Browsers render these
  // inside a <pre> (sometimes alongside a "Pretty-print" checkbox), so the
  // raw text is the first <pre>'s textContent.
  const ct = (document.contentType || "").toLowerCase()
  const isJsonType =
    ct.includes("application/json") ||
    ct.includes("+json") ||
    ct.endsWith("/json")

  const pre = body.querySelector("pre")
  let candidateText = ""
  if (isJsonType && pre) {
    candidateText = pre.textContent ?? ""
  } else if (pre && body.children.length === 1 && body.firstElementChild === pre) {
    // Fallback: a page that is just a single <pre> block.
    candidateText = pre.textContent ?? ""
  } else if (body.children.length === 0) {
    candidateText = body.textContent ?? ""
  }

  const trimmed = candidateText.trim()
  if (!trimmed) return null
  // Quick structural gate before attempting a parse.
  const first = trimmed[0]
  const last = trimmed[trimmed.length - 1]
  const looksStructural =
    (first === "{" && last === "}") || (first === "[" && last === "]")
  if (!looksStructural || trimmed.length > 8_000_000) return null

  try {
    const data = JSON.parse(trimmed)
    if (data === null || typeof data !== "object") return null
    return { raw: trimmed, data }
  } catch {
    return null
  }
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text != null) node.textContent = text
  return node
}

function buildCss(s: Settings): string {
  const c = s.syntaxTheme.colors
  return `
  .sf-root { position: fixed; inset: 0; z-index: 2147483647; display: flex; flex-direction: column;
    background: ${c.bg}; color: ${c.fg};
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Cascadia Code", monospace;
    font-size: 13px; line-height: 1.6; }
  .sf-bar { display: flex; align-items: center; gap: 8px; padding: 8px 12px;
    border-bottom: 1px solid ${withAlpha(c.gutter, 0.3)};
    background: ${s.appDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)"};
    font-family: ui-sans-serif, system-ui, sans-serif; }
  .sf-badge { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; font-size: 12px; }
  .sf-dot { width: 16px; height: 16px; border-radius: 4px;
    display: inline-flex; align-items: center; justify-content: center; overflow: hidden;
    box-shadow: 0 0 0 1px ${withAlpha(c.gutter, 0.35)}; }
  .sf-dot img { width: 100%; height: 100%; display: block; }
  .sf-search { flex: 1; min-width: 80px; max-width: 320px; display: flex; align-items: center; gap: 6px;
    background: ${withAlpha(c.gutter, 0.12)}; border: 1px solid ${withAlpha(c.gutter, 0.3)};
    border-radius: 6px; padding: 4px 8px; }
  .sf-search input { flex: 1; background: transparent; border: none; outline: none; color: ${c.fg};
    font-family: inherit; font-size: 12px; }
  .sf-btns { display: flex; gap: 4px; margin-left: auto; }
  .sf-btn { cursor: pointer; border: 1px solid ${withAlpha(c.gutter, 0.3)}; background: transparent;
    color: ${c.fg}; border-radius: 6px; padding: 4px 10px; font-size: 12px; font-family: inherit;
    font-family: ui-sans-serif, system-ui, sans-serif; }
  .sf-btn:hover { background: ${withAlpha(c.gutter, 0.15)}; }
  .sf-btn.active { background: ${c.keyword}; color: ${c.bg}; border-color: ${c.keyword}; }
  .sf-body { flex: 1; overflow: auto; padding: 10px 12px; }
  .sf-raw { white-space: pre; tab-size: 2; margin: 0; padding: 10px 12px; flex: 1; overflow: auto; }
  .sf-fmt { white-space: pre; tab-size: 2; margin: 0; padding: 10px 12px; flex: 1; overflow: auto; }
  .sf-select { cursor: pointer; border: 1px solid ${withAlpha(c.gutter, 0.3)}; background: transparent;
    color: ${c.fg}; border-radius: 6px; padding: 4px 8px; font-size: 12px;
    font-family: ui-sans-serif, system-ui, sans-serif; max-width: 150px; }
  .sf-row { display: flex; align-items: flex-start; border-radius: 4px; padding-left: var(--sf-indent); }
  .sf-row:hover { background: ${withAlpha(c.gutter, 0.12)}; }
  .sf-tw { width: 14px; flex: 0 0 14px; cursor: pointer; user-select: none; color: ${c.punctuation};
    text-align: center; transition: transform .12s; }
  .sf-tw.open { transform: rotate(90deg); }
  .sf-content { min-width: 0; word-break: break-word; cursor: default; }
  .sf-clickable { cursor: pointer; }
  .sf-key { color: ${c.key}; }
  .sf-str { color: ${c.string}; }
  .sf-num { color: ${c.number}; }
  .sf-bool { color: ${c.boolean}; }
  .sf-null { color: ${c.null}; }
  .sf-punc { color: ${c.punctuation}; }
  .sf-count { color: ${withAlpha(c.gutter, 0.9)}; }
  .sf-match { background: ${c.match}; border-radius: 3px; padding: 0 2px; }
  .sf-children { }
  .sf-copy { margin-left: auto; opacity: 0; cursor: pointer; border: none; background: transparent;
    color: ${c.punctuation}; font-size: 11px; padding: 0 6px; font-family: ui-sans-serif, system-ui, sans-serif; }
  .sf-row:hover .sf-copy { opacity: 1; }
  .sf-copy:hover { color: ${c.fg}; }
  `
}

function injectStyles(s: Settings) {
  const style = el("style")
  style.id = "sf-styles"
  style.textContent = buildCss(s)
  ;(document.head ?? document.documentElement).appendChild(style)
}

function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "")
  if (h.length !== 6) return hex
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

let currentSearch = ""

function buildNode(
  keyName: string | null,
  value: unknown,
  depth: number,
  isLast: boolean,
): HTMLElement {
  const isObject = value !== null && typeof value === "object"
  const isArray = Array.isArray(value)
  const wrapper = el("div")

  const row = el("div", "sf-row")
  row.style.setProperty("--sf-indent", `${depth * 14 + 4}px`)

  const twist = el("span", "sf-tw")
  row.appendChild(twist)

  const content = el("span", "sf-content")
  row.appendChild(content)

  // Key label
  if (keyName !== null) {
    const k = el("span", "sf-key")
    k.textContent = isArray || !Number.isNaN(Number(keyName)) ? keyName : `"${keyName}"`
    content.appendChild(k)
    content.appendChild(document.createTextNode(": "))
  }

  const copyBtn = el("button", "sf-copy", "copy")
  copyBtn.addEventListener("click", (e) => {
    e.stopPropagation()
    const text = isObject ? JSON.stringify(value, null, 2) : String(value)
    navigator.clipboard?.writeText(text)
    copyBtn.textContent = "copied"
    setTimeout(() => (copyBtn.textContent = "copy"), 1000)
  })

  if (!isObject) {
    twist.style.visibility = "hidden"
    content.appendChild(renderLiteral(value))
    if (!isLast) content.appendChild(punc(","))
    row.appendChild(copyBtn)
    wrapper.appendChild(row)
    tagSearch(row, keyName, value)
    return wrapper
  }

  const entries = Object.entries(value as Record<string, unknown>)
  const openBrace = isArray ? "[" : "{"
  const closeBrace = isArray ? "]" : "}"

  content.classList.add("sf-clickable")
  content.appendChild(punc(openBrace))
  const summary = el("span", "sf-count")
  summary.textContent = ` ${entries.length} ${entries.length === 1 ? "item" : "items"} `
  const closeInline = punc(closeBrace)
  content.appendChild(summary)
  content.appendChild(closeInline)
  row.appendChild(copyBtn)
  wrapper.appendChild(row)

  const childContainer = el("div", "sf-children")
  for (let i = 0; i < entries.length; i++) {
    childContainer.appendChild(buildNode(entries[i][0], entries[i][1], depth + 1, i === entries.length - 1))
  }
  const closeRow = el("div", "sf-row")
  closeRow.style.setProperty("--sf-indent", `${depth * 14 + 4 + 14}px`)
  const closeContent = el("span", "sf-punc", closeBrace + (!isLast && depth > 0 ? "," : ""))
  closeRow.appendChild(el("span", "sf-tw"))
  closeRow.appendChild(closeContent)
  childContainer.appendChild(closeRow)
  wrapper.appendChild(childContainer)

  let open = depth < 2
  const setOpen = (next: boolean) => {
    open = next
    twist.classList.toggle("open", open)
    childContainer.style.display = open ? "" : "none"
    summary.style.display = open ? "none" : ""
    closeInline.style.display = open ? "none" : ""
  }
  twist.textContent = "\u25B6"
  setOpen(open)
  const toggle = () => setOpen(!open)
  twist.addEventListener("click", (e) => {
    e.stopPropagation()
    toggle()
  })
  content.addEventListener("click", toggle)

  return wrapper
}

function punc(text: string): HTMLElement {
  return el("span", "sf-punc", text)
}

function renderLiteral(value: unknown): HTMLElement {
  if (typeof value === "string") return el("span", "sf-str", `"${value}"`)
  if (typeof value === "number") return el("span", "sf-num", String(value))
  if (typeof value === "boolean") return el("span", "sf-bool", String(value))
  if (value === null) return el("span", "sf-null", "null")
  return el("span", "sf-str", String(value))
}

function tagSearch(row: HTMLElement, keyName: string | null, value: unknown) {
  row.dataset.text = `${keyName ?? ""} ${String(value)}`.toLowerCase()
}

function applySearch(root: HTMLElement) {
  const q = currentSearch.trim().toLowerCase()
  const rows = root.querySelectorAll<HTMLElement>(".sf-row")
  rows.forEach((r) => {
    // Clear previous highlight
    r.querySelectorAll(".sf-match").forEach((m) => m.classList.remove("sf-match"))
  })
  if (!q) return
  rows.forEach((r) => {
    if (r.dataset.text && r.dataset.text.includes(q)) {
      r.querySelectorAll(".sf-key, .sf-str, .sf-num, .sf-bool, .sf-null").forEach((node) => {
        if (node.textContent && node.textContent.toLowerCase().includes(q)) {
          node.classList.add("sf-match")
        }
      })
    }
  })
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/** Pretty-print JSON into a syntax-highlighted HTML string using theme classes. */
function highlightJson(data: unknown): string {
  const json = JSON.stringify(data, null, 2)
  return json.replace(
    /("(?:\\.|[^"\\])*"(\s*:)?|\b(?:true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      if (/^"/.test(match)) {
        const k = match.match(/^("(?:[^"\\]|\\.)*")(\s*):$/)
        if (k) {
          return `<span class="sf-key">${escapeHtml(k[1])}</span><span class="sf-punc">${k[2]}:</span>`
        }
        return `<span class="sf-str">${escapeHtml(match)}</span>`
      }
      if (/^(?:true|false)$/.test(match)) return `<span class="sf-bool">${match}</span>`
      if (match === "null") return `<span class="sf-null">${match}</span>`
      return `<span class="sf-num">${match}</span>`
    },
  )
}

function render(detected: { raw: string; data: unknown }, s: Settings) {
  // Preserve original document title.
  document.documentElement.style.height = "100%"
  document.body.innerHTML = ""
  document.body.style.margin = "0"

  injectStyles(s)

  const rootEl = el("div", "sf-root")

  // Top bar
  const bar = el("div", "sf-bar")
  const badge = el("span", "sf-badge")
  const dot = el("span", "sf-dot")
  const dotIcon = el("img")
  dotIcon.src = chrome.runtime.getURL("icons/icon-16.png")
  dotIcon.alt = "StructFlow"
  dotIcon.addEventListener("error", () => {
    dotIcon.remove()
    dot.textContent = "{}"
  })
  dot.appendChild(dotIcon)
  badge.appendChild(dot)
  badge.appendChild(document.createTextNode("StructFlow · JSON"))
  bar.appendChild(badge)

  const searchWrap = el("div", "sf-search")
  searchWrap.appendChild(el("span", undefined, "\u2315"))
  const searchInput = el("input")
  searchInput.placeholder = "Search keys and values…"
  searchWrap.appendChild(searchInput)
  bar.appendChild(searchWrap)

  // Editor/JSON theme picker (mirrors the side panel).
  const themeSelect = el("select", "sf-select")
  for (const t of SYNTAX_THEMES) {
    const opt = el("option")
    opt.value = t.id
    opt.textContent = themeLabel(t.id)
    if (t.id === s.syntaxTheme.id) opt.selected = true
    themeSelect.appendChild(opt)
  }
  themeSelect.title = "Editor & JSON theme"

  const btns = el("div", "sf-btns")
  const fmtBtn = el("button", "sf-btn active", "Formatted")
  const treeBtn = el("button", "sf-btn", "Tree")
  const rawBtn = el("button", "sf-btn", "Raw")
  const copyAllBtn = el("button", "sf-btn", "Copy")
  const expandBtn = el("button", "sf-btn", "Expand all")
  btns.appendChild(themeSelect)
  btns.appendChild(fmtBtn)
  btns.appendChild(treeBtn)
  btns.appendChild(rawBtn)
  btns.appendChild(expandBtn)
  btns.appendChild(copyAllBtn)
  bar.appendChild(btns)
  rootEl.appendChild(bar)

  // Formatted (pretty, syntax-highlighted) view — the default.
  const fmtPre = el("pre", "sf-fmt")
  fmtPre.innerHTML = highlightJson(detected.data)
  rootEl.appendChild(fmtPre)

  // Tree view
  const body = el("div", "sf-body")
  const tree = buildNode(null, detected.data, 0, true)
  body.appendChild(tree)
  body.style.display = "none"
  rootEl.appendChild(body)

  // Raw view
  const rawPre = el("pre", "sf-raw")
  rawPre.textContent = JSON.stringify(detected.data, null, 2)
  rawPre.style.display = "none"
  rootEl.appendChild(rawPre)

  document.body.appendChild(rootEl)

  // Interactions
  searchInput.addEventListener("input", () => {
    currentSearch = searchInput.value
    applySearch(body)
  })

  type Mode = "formatted" | "tree" | "raw"
  const setMode = (mode: Mode) => {
    fmtBtn.classList.toggle("active", mode === "formatted")
    treeBtn.classList.toggle("active", mode === "tree")
    rawBtn.classList.toggle("active", mode === "raw")
    fmtPre.style.display = mode === "formatted" ? "" : "none"
    body.style.display = mode === "tree" ? "" : "none"
    rawPre.style.display = mode === "raw" ? "" : "none"
    searchWrap.style.visibility = mode === "tree" ? "visible" : "hidden"
    expandBtn.style.display = mode === "tree" ? "" : "none"
  }
  fmtBtn.addEventListener("click", () => setMode("formatted"))
  treeBtn.addEventListener("click", () => setMode("tree"))
  rawBtn.addEventListener("click", () => setMode("raw"))
  setMode("formatted")

  // Live theme switch: update the existing <style> node and re-highlight.
  themeSelect.addEventListener("change", () => {
    s.syntaxTheme = getSyntaxTheme(themeSelect.value)
    const styleNode = document.getElementById("sf-styles")
    if (styleNode) styleNode.textContent = buildCss(s)
    fmtPre.innerHTML = highlightJson(detected.data)
    chrome?.storage?.local?.set?.({ [SYNTAX_KEY]: themeSelect.value })
  })

  let allOpen = false
  expandBtn.addEventListener("click", () => {
    allOpen = !allOpen
    expandBtn.textContent = allOpen ? "Collapse all" : "Expand all"
    body.querySelectorAll<HTMLElement>(".sf-tw").forEach((tw) => {
      if (tw.textContent !== "\u25B6") return
      const isOpen = tw.classList.contains("open")
      if (isOpen !== allOpen) tw.click()
    })
  })

  copyAllBtn.addEventListener("click", () => {
    navigator.clipboard?.writeText(JSON.stringify(detected.data, null, 2))
    copyAllBtn.textContent = "Copied"
    setTimeout(() => (copyAllBtn.textContent = "Copy"), 1000)
  })
}

function themeLabel(id: string): string {
  const map: Record<string, string> = {
    "vscode-dark": "VS Code Dark+",
    "vscode-light": "VS Code Light+",
    "github-dark": "GitHub Dark",
    "github-light": "GitHub Light",
    monokai: "Monokai",
    dracula: "Dracula",
    nord: "Nord",
    "solarized-light": "Solarized Light",
  }
  return map[id] ?? id
}

async function main() {
  const detected = detectJson()
  if (!detected) return
  const s = await readSettings()
  if (!s.enabled) return
  // Guard: only act on top frame.
  if (window.top !== window.self) return
  render(detected, s)
}

main()
