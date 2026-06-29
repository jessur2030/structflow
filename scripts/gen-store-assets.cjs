const { spawn } = require("node:child_process")
const { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } = require("node:fs")
const { join, resolve } = require("node:path")
const sharp = require("sharp")

const root = resolve(__dirname, "..")
const outDir = join(root, "store-assets")
const iconPath = join(root, "public/icons/icon-128.png")
const iconBase64 = existsSync(iconPath) ? readFileSync(iconPath).toString("base64") : ""
const baseUrl = "http://127.0.0.1:5187/"
const debugPort = 9337
const chromePaths = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
]

const defaults = {
  indent: "2",
  printWidth: 80,
  singleQuote: false,
  semi: true,
  trailingComma: "all",
  sortKeys: true,
  sqlUppercase: true,
}

const markdownSample = `# StructFlow launch notes

- Format Markdown, JSON, TypeScript, HTML, CSS, and SQL.
- Preview docs with syntax-highlighted code fences.
- Save useful snippets to a local library.

\`\`\`ts
const formatted = await formatCode("json", payload, options);
console.log(formatted.output);
\`\`\`

| Area | Status |
| --- | --- |
| Editor | Ready |
| Library | Ready |
| Store assets | In review |
`

const jsonSample = JSON.stringify(
  {
    user: {
      id: "usr_124",
      name: "Ada Lovelace",
      plan: "pro",
      usage: { requests: 1842, limit: 5000 },
      flags: ["snapshots", "library", "markdown-preview"],
    },
    response: { ok: true, latencyMs: 82 },
  },
  null,
  2,
)

const tsSample = `interface User {
  id: number
  name: string
  plan: "free" | "pro"
}

function greet(user: User): string {
  return \`Welcome back, \${user.name}!\`
}

const ada: User = { id: 124, name: "Ada", plan: "pro" }
console.log(greet(ada))
`

const jsSample = `const response = await fetch("/api/users");
const users = await response.json();

for (const user of users) {
  console.log(user.id, user.plan);
}
`

const screenshots = [
  {
    file: "screenshot-01-formatter-markdown.png",
    language: "markdown",
    input: markdownSample,
    setup: async (page) => {
      await page.clickLabel("Preview")
    },
  },
  {
    file: "screenshot-02-json-tree.png",
    language: "json",
    input: jsonSample,
    setup: async (page) => {
      await page.clickLabel("Tree view")
      await page.evaluate(`document.querySelector('input[placeholder="Search keys and values…"]')?.focus()`)
      await page.type("plan")
    },
  },
  {
    file: "screenshot-03-library.png",
    language: "markdown",
    input: markdownSample,
    seedLibrary: true,
    setup: async (page) => {
      await page.clickText("Library")
    },
  },
  {
    file: "screenshot-04-snapshot-modal.png",
    language: "javascript",
    input: jsSample,
    setup: async (page) => {
      // "Code snapshot" now lives in the "More actions" overflow menu.
      await page.clickLabel("More actions")
      await page.clickText("Code snapshot")
    },
  },
  {
    // The in-place CodeMirror editor (headline 1.4.0 change): TypeScript opens in
    // Edit mode with live syntax highlighting under the Aura Noir Modern theme.
    file: "screenshot-05-editor.png",
    language: "typescript",
    input: tsSample,
    setup: async () => {},
  },
]

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

async function main() {
  mkdirSync(outDir, { recursive: true })
  for (const file of readdirSync(outDir)) {
    if (file.endsWith(".png")) unlinkSync(join(outDir, file))
  }

  const chromePath = chromePaths.find(existsSync)
  if (!chromePath) throw new Error("No supported Chrome executable found.")

  const vite = spawn(process.execPath, [join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "5187"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
  })
  vite.on("error", (err) => {
    console.error("Failed to start Vite:", err)
  })
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1280,800",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=/tmp/structflow-store-assets-${Date.now()}`,
    "about:blank",
  ], {
    stdio: ["ignore", "pipe", "pipe"],
  })

  try {
    await waitForHttp(baseUrl)
    await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`)
    const page = await createPage()

    for (const item of screenshots) {
      await page.prepare(item.language, item.input, Boolean(item.seedLibrary))
      await item.setup(page)
      await page.wait(700)
      await page.screenshot(join(outDir, item.file))
    }

    const promoSource = join(outDir, screenshots[0].file)
    await writeSmallPromo()
    await writeMarqueePromo(promoSource)

    console.log(`Captured ${screenshots.length} real app screenshots and two promo tiles in store-assets/`)
  } finally {
    vite.kill()
    chrome.kill()
  }
}

async function writeSmallPromo() {
  const svg = await smallPromoSvg()
  await sharp({
    create: {
      width: 440,
      height: 280,
      channels: 4,
      background: "#0b1020",
    },
  })
    .composite([{ input: Buffer.from(svg) }])
    .flatten({ background: "#0b1020" })
    .png()
    .toFile(join(outDir, "promo-small-440x280.png"))
}

async function writeMarqueePromo(sourcePath) {
  const backdrop = await sharp(sourcePath)
    .extract({ left: 0, top: 72, width: 1280, height: 512 })
    .resize(1400, 560, { fit: "cover" })
    .blur(12)
    .modulate({ brightness: 0.62, saturation: 1.08 })
    .png()
    .toBuffer()

  const panel = await sharp(sourcePath)
    .extract({ left: 380, top: 0, width: 520, height: 800 })
    .resize({ height: 500 })
    .png()
    .toBuffer()

  await sharp({
    create: {
      width: 1400,
      height: 560,
      channels: 3,
      background: "#0b1020",
    },
  })
    .composite([
      { input: backdrop },
      { input: Buffer.from(marqueePromoSvg()) },
      { input: panel, left: 1000, top: 30 },
      { input: Buffer.from(marqueePanelFrameSvg()) },
    ])
    .flatten({ background: "#0b1020" })
    .png()
    .toFile(join(outDir, "promo-marquee-1400x560.png"))
}

function marqueePromoSvg() {
  const description = wrap(
    "A code & notes workspace with a built-in JSON viewer, code snapshots, and a local foldered library, in your browser side panel.",
    54,
  )
  const pills = ["20+ languages", "JSON viewer", "Tag & reuse", "Local-first"]

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1400" height="560" viewBox="0 0 1400 560">
      <defs>
        <linearGradient id="wash" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#08111f" stop-opacity="0.96"/>
          <stop offset="0.48" stop-color="#0b1020" stop-opacity="0.9"/>
          <stop offset="1" stop-color="#0b1020" stop-opacity="0.72"/>
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="160%" height="160%">
          <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#020617" flood-opacity="0.5"/>
        </filter>
      </defs>
      <style>
        text { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      </style>
      <rect width="1400" height="560" fill="url(#wash)"/>
      <circle cx="158" cy="450" r="180" fill="#4f9cff" opacity=".18"/>
      <circle cx="1228" cy="82" r="150" fill="#14b8a6" opacity=".15"/>
      <circle cx="760" cy="510" r="220" fill="#0ea5e9" opacity=".08"/>

      <g transform="translate(72 58)">
        ${brandMark(0, 0, 52)}
        <text x="70" y="22" fill="#f8fafc" font-size="30" font-weight="800">StructFlow</text>
        <text x="70" y="49" fill="#9fb0c8" font-size="17">Chrome side panel extension</text>
      </g>

      <g transform="translate(72 118)">
        <text x="0" y="58" fill="#f8fafc" font-size="56" font-weight="880">Format code,</text>
        <text x="0" y="124" fill="#f8fafc" font-size="56" font-weight="880">explore JSON,</text>
        <text x="0" y="190" fill="#f8fafc" font-size="56" font-weight="880">and keep snippets close.</text>
        ${description.map((line, index) => `<text x="0" y="${256 + index * 34}" fill="#b8c3d6" font-size="22">${escapeXml(line)}</text>`).join("")}
      </g>

      <g transform="translate(72 460)">
        ${promoPillsSvg(pills)}
      </g>

      <g filter="url(#shadow)">
        <rect x="990" y="20" width="345" height="520" rx="28" fill="#0f172a" fill-opacity="0.96"/>
      </g>
    </svg>
  `
}

// Promo small tile: three labeled pillars (Code / JSON / Notes) with lucide icons.
const PROMO_SANS = "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
const PILLAR_ICONS = {
  code: '<path d="M16 18 L22 12 L16 6"/><path d="M8 6 L2 12 L8 18"/>',
  braces:
    '<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1 .9 2 2 2h1"/><path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1 .9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/>',
  note: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
}
function strokeIcon(name, x, y, size, color) {
  const s = size / 24
  return `<g transform="translate(${x},${y}) scale(${s})" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${PILLAR_ICONS[name]}</g>`
}
function pillarChip(x, y, w, h, name, label, color) {
  const cx = x + w / 2
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="#161a28"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="${color}" fill-opacity="0.08"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="none" stroke="${color}" stroke-opacity="0.35"/>
    ${strokeIcon(name, cx - 18, y + 26, 36, color)}
    <text x="${cx}" y="${y + h - 20}" fill="#f8fafc" font-family="${PROMO_SANS}" font-size="15" font-weight="700" text-anchor="middle">${label}</text>
  </g>`
}
async function measureTextWidth(text, size, weight) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="140"><text x="20" y="100" font-family="${PROMO_SANS}" font-size="${size}" font-weight="${weight}" fill="#fff">${escapeXml(text)}</text></svg>`
  const { info } = await sharp(Buffer.from(svg)).trim().png().toBuffer({ resolveWithObject: true })
  return info.width
}
async function smallPromoSvg() {
  const NAME = "StructFlow", FS = 27, FW = 800
  const nameW = await measureTextWidth(NAME, FS, FW)
  const logoSize = 30, gap = 11
  const startX = Math.round((440 - (logoSize + gap + nameW)) / 2)
  const cy = 42
  const nameX = startX + logoSize + gap
  const baseline = cy + Math.round(FS * 0.34)
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="440" height="280" viewBox="0 0 440 280">
      <defs>
        <radialGradient id="pg1" cx="12%" cy="92%" r="70%"><stop offset="0" stop-color="#4f9cff" stop-opacity="0.16"/><stop offset="1" stop-color="#4f9cff" stop-opacity="0"/></radialGradient>
        <radialGradient id="pg2" cx="92%" cy="8%" r="60%"><stop offset="0" stop-color="#14b8a6" stop-opacity="0.14"/><stop offset="1" stop-color="#14b8a6" stop-opacity="0"/></radialGradient>
      </defs>
      <rect width="440" height="280" fill="#0b1020"/>
      <rect width="440" height="280" fill="url(#pg1)"/>
      <rect width="440" height="280" fill="url(#pg2)"/>
      ${brandMark(startX, cy - logoSize / 2, logoSize)}
      <text x="${nameX}" y="${baseline}" fill="#f8fafc" font-family="${PROMO_SANS}" font-size="${FS}" font-weight="${FW}">StructFlow</text>
      ${pillarChip(42, 86, 104, 106, "code", "Code", "#6ea8fe")}
      ${pillarChip(168, 86, 104, 106, "braces", "JSON", "#69D2AE")}
      ${pillarChip(294, 86, 104, 106, "note", "Notes", "#E5A98A")}
      <text x="220" y="232" fill="#9fb0c8" font-family="${PROMO_SANS}" font-size="14" text-anchor="middle">Runs locally in your browser side panel.</text>
    </svg>
  `
}

function marqueePanelFrameSvg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1400" height="560" viewBox="0 0 1400 560">
      <defs>
        <linearGradient id="panel-border" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#f8fafc" stop-opacity="0.24"/>
          <stop offset="1" stop-color="#f8fafc" stop-opacity="0.08"/>
        </linearGradient>
      </defs>
      <rect x="990.5" y="20.5" width="344" height="519" rx="28" fill="none" stroke="url(#panel-border)" stroke-width="1"/>
      <rect x="1000.5" y="30.5" width="324" height="499" rx="22" fill="none" stroke="#f8fafc" stroke-opacity="0.08" stroke-width="1"/>
    </svg>
  `
}

async function createPage() {
  const tab = await fetchJson(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })
  const client = await CdpClient.connect(tab.webSocketDebuggerUrl)
  await client.send("Page.enable")
  await client.send("Runtime.enable")
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  })

  return {
    wait: delay,
    async prepare(language, input, seedLibrary) {
      await navigate(client, baseUrl)
      await evaluate(client, stateScript(language, input, seedLibrary), true)
      await navigate(client, baseUrl)
      await evaluate(client, captureStyleScript(), true)
      await delay(900)
    },
    async clickLabel(label) {
      await evaluate(client, clickScript(`[aria-label="${cssEscape(label)}"]`), true)
      await delay(250)
    },
    async clickText(text) {
      await evaluate(client, clickTextScript(text), true)
      await delay(350)
    },
    async type(text) {
      for (const char of text) {
        await client.send("Input.dispatchKeyEvent", { type: "char", text: char })
      }
      await delay(250)
    },
    async evaluate(expression) {
      await evaluate(client, expression, true)
    },
    async screenshot(path) {
      const result = await client.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
        clip: { x: 0, y: 0, width: 1280, height: 800, scale: 1 },
      })
      writeFileSync(path, Buffer.from(result.data, "base64"))
    },
  }
}

function stateScript(language, input, seedLibrary) {
  return `
    (async () => {
      localStorage.setItem("structflow_theme", "dark");
      localStorage.setItem("structflow_syntax_theme", "aura-noir-modern");
      localStorage.setItem("structflow_options", ${JSON.stringify(JSON.stringify(defaults))});
      localStorage.setItem("structflow_formatter_draft", ${JSON.stringify(JSON.stringify({ language, input }))});
      if (${seedLibrary ? "true" : "false"}) {
        await new Promise((resolve, reject) => {
          const req = indexedDB.open("structflow", 3);
          req.onupgradeneeded = () => {
            const db = req.result;
            for (const name of Array.from(db.objectStoreNames)) db.deleteObjectStore(name);
            const entries = db.createObjectStore("entries", { keyPath: "id" });
            entries.createIndex("by-project", "projectId");
            entries.createIndex("by-updated", "updatedAt");
            const projects = db.createObjectStore("projects", { keyPath: "id" });
            projects.createIndex("by-created", "createdAt");
          };
          req.onerror = () => reject(req.error);
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction(["entries", "projects"], "readwrite");
            const entries = tx.objectStore("entries");
            const projects = tx.objectStore("projects");
            entries.clear();
            projects.clear();
            const now = Date.now();
            const api = { id: "project-api", name: "API Responses", color: "oklch(0.65 0.16 256)", createdAt: now - 5000 };
            const notes = { id: "project-notes", name: "Launch Notes", color: "oklch(0.7 0.16 60)", createdAt: now - 4000 };
            projects.put(api);
            projects.put(notes);
            const base = {
              formatterVersion: "2",
              formatOptions: ${JSON.stringify(defaults)},
              source: "manual",
              createdAt: now - 3000,
              updatedAt: now - 1000,
              lastOpenedAt: now - 500,
            };
            entries.put({ ...base, id: "entry-json", title: "Stripe customer payload", language: "json", rawInput: ${JSON.stringify(jsonSample)}, formattedOutput: ${JSON.stringify(jsonSample)}, projectId: api.id, pinned: true, tags: ["api", "billing"] });
            entries.put({ ...base, id: "entry-ts", title: "Auth middleware snippet", language: "typescript", rawInput: ${JSON.stringify(tsSample)}, formattedOutput: ${JSON.stringify(tsSample)}, projectId: api.id, pinned: false, tags: ["auth"] });
            entries.put({ ...base, id: "entry-md", title: "Launch checklist", language: "markdown", rawInput: ${JSON.stringify(markdownSample)}, formattedOutput: ${JSON.stringify(markdownSample)}, projectId: notes.id, pinned: true, tags: ["release"] });
            entries.put({ ...base, id: "entry-js", title: "Snapshot demo", language: "javascript", rawInput: ${JSON.stringify(jsSample)}, formattedOutput: ${JSON.stringify(jsSample)}, projectId: notes.id, pinned: false, tags: ["docs"] });
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = () => reject(tx.error);
          };
        });
      }
    })()
  `
}

function captureStyleScript() {
  return `
    (() => {
      document.querySelector("[data-store-capture-style]")?.remove();
      const style = document.createElement("style");
      style.dataset.storeCaptureStyle = "true";
      style.textContent = \`
        html, body {
          width: 1280px !important;
          height: 800px !important;
          overflow: hidden !important;
          background:
            radial-gradient(circle at 18% 88%, rgba(79, 156, 255, 0.14), transparent 28%),
            radial-gradient(circle at 88% 6%, rgba(20, 184, 166, 0.12), transparent 26%),
            #0b1020 !important;
        }
        #root {
          width: 520px !important;
          height: 800px !important;
          margin: 0 auto !important;
          background: var(--background) !important;
          box-shadow: 0 28px 80px rgba(0,0,0,.42) !important;
        }
      \`;
      document.head.appendChild(style);
    })()
  `
}

// Radix triggers/menu-items open & select on pointer events, not a bare .click().
// Dispatch a full mouse pointer sequence so dropdown/context triggers actually open.
const pressHelper = `
  const __press = (el) => {
    const o = { bubbles: true, cancelable: true, view: window, button: 0, pointerId: 1, pointerType: "mouse", isPrimary: true };
    el.dispatchEvent(new PointerEvent("pointerdown", { ...o, buttons: 1 }));
    el.dispatchEvent(new PointerEvent("pointerup", { ...o, buttons: 0 }));
    el.click();
  };
`

function clickScript(selector) {
  return `
    (() => {
      ${pressHelper}
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error("Missing element: " + ${JSON.stringify(selector)});
      __press(el);
    })()
  `
}

function clickTextScript(text) {
  return `
    (() => {
      ${pressHelper}
      const target = ${JSON.stringify(text)};
      // Include Radix menu/option roles, not just <button> — shadcn dropdown/context
      // menu items render as <div role="menuitem">.
      const nodes = Array.from(document.querySelectorAll('button, [role="menuitem"], [role="option"]'));
      const el = nodes.find((node) => node.textContent && node.textContent.includes(target));
      if (!el) throw new Error("Missing clickable text: " + target);
      __press(el);
    })()
  `
}

async function navigate(client, url) {
  await client.send("Page.navigate", { url })
  for (let i = 0; i < 80; i++) {
    const result = await client.send("Runtime.evaluate", {
      expression: "document.readyState",
      returnByValue: true,
    })
    if (result.result.value === "complete") return
    await delay(100)
  }
  throw new Error(`Timed out navigating to ${url}`)
}

async function evaluate(client, expression, awaitPromise) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue: true,
  })
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Runtime.evaluate failed")
  }
  return result.result.value
}

class CdpClient {
  static async connect(url) {
    const ws = new WebSocket(url)
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true })
      ws.addEventListener("error", reject, { once: true })
    })
    return new CdpClient(ws)
  }

  constructor(ws) {
    this.ws = ws
    this.nextId = 1
    this.pending = new Map()
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data)
      if (!message.id) return
      const pending = this.pending.get(message.id)
      if (!pending) return
      this.pending.delete(message.id)
      if (message.error) {
        pending.reject(new Error(message.error.message))
      } else {
        pending.resolve(message.result ?? {})
      }
    })
  }

  send(method, params = {}) {
    const id = this.nextId++
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
    })
  }
}

async function waitForHttp(url) {
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
    }
    await delay(250)
  }
  throw new Error(`Timed out waiting for ${url}`)
}

async function fetchJson(url, init) {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.json()
}

function cssEscape(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

function brandMark(x, y, size) {
  if (iconBase64) {
    return `<image href="data:image/png;base64,${iconBase64}" x="${x}" y="${y}" width="${size}" height="${size}"/>`
  }
  return `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="#4f9cff"/>`
}

function promoPillsSvg(items) {
  let offsetX = 0
  return items.map((item) => {
    const width = item.length * 9 + 38
    const svg = `
      <g transform="translate(${offsetX} 0)">
        <rect x="0" y="0" width="${width}" height="46" rx="23" fill="#ffffff" opacity="0.1"/>
        <text x="19" y="30" fill="#e5edf8" font-size="16" font-weight="720">${escapeXml(item)}</text>
      </g>
    `
    offsetX += width + 14
    return svg
  }).join("")
}

function wrap(text, max) {
  const words = text.split(" ")
  const lines = []
  let current = ""
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > max && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
