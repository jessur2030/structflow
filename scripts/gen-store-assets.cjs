const { spawn } = require("node:child_process")
const { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } = require("node:fs")
const { join, resolve } = require("node:path")
const sharp = require("sharp")

const root = resolve(__dirname, "..")
const outDir = join(root, "store-assets")
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
| Formatter | Ready |
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

const tsSample = `type Plan="free"|"pro"

const canExport=(p:Plan)=>{
return p==="pro"
}
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
      await page.clickLabel("Rendered preview")
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
      await page.clickLabel("Code snapshot")
    },
  },
  {
    file: "screenshot-05-compare-view.png",
    language: "typescript",
    input: tsSample,
    setup: async (page) => {
      await page.clickLabel("Compare input and output")
    },
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

    await sharp(join(outDir, screenshots[0].file))
      .extract({ left: 380, top: 0, width: 520, height: 330 })
      .resize(440, 280, { fit: "cover", position: "top" })
      .png()
      .toFile(join(outDir, "promo-small-440x280.png"))

    console.log(`Captured ${screenshots.length} real app screenshots and one promo crop in store-assets/`)
  } finally {
    vite.kill()
    chrome.kill()
  }
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
      localStorage.setItem("structflow_syntax_theme", "vscode-dark");
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

function clickScript(selector) {
  return `
    (() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error("Missing element: " + ${JSON.stringify(selector)});
      el.click();
    })()
  `
}

function clickTextScript(text) {
  return `
    (() => {
      const target = ${JSON.stringify(text)};
      const buttons = Array.from(document.querySelectorAll("button"));
      const el = buttons.find((button) => button.textContent && button.textContent.includes(target));
      if (!el) throw new Error("Missing button text: " + target);
      el.click();
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
