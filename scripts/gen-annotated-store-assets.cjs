const { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } = require("node:fs")
const { basename, join, resolve } = require("node:path")
const sharp = require("sharp")

const root = resolve(__dirname, "..")
const assetDir = join(root, "store-assets")
const plainDir = join(assetDir, "plain")
const annotatedDir = join(assetDir, "annotated")
const iconPath = join(root, "public/icons/icon-128.png")
const iconBase64 = existsSync(iconPath) ? readFileSync(iconPath).toString("base64") : ""

const items = [
  {
    source: "screenshot-01-formatter-markdown.png",
    title: "Format and preview Markdown",
    body: "Beautify code and notes in the side panel. Preview rendered Markdown with highlighted fences before you save.",
    pills: ["Markdown preview", "Syntax highlighting", "Local library"],
    accent: "#4f9cff",
  },
  {
    source: "screenshot-02-json-tree.png",
    title: "Explore JSON as a tree",
    body: "Collapse, expand and search any payload. Color-coded keys and values make structure obvious.",
    pills: ["Interactive tree", "Search keys & values", "Copy path"],
    accent: "#14b8a6",
  },
  {
    source: "screenshot-03-library.png",
    title: "Your snippets, organized",
    body: "Save anything into color-coded folders, search across everything, and reopen with one click.",
    pills: ["Projects & folders", "Full-text search", "Bulk zip export"],
    accent: "#f59e0b",
  },
  {
    source: "screenshot-04-snapshot-modal.png",
    title: "Create code snapshots",
    body: "Turn formatted output into polished PNGs for docs, issues, and team updates without leaving Chrome.",
    pills: ["Theme-aware cards", "Copy PNG", "Download image"],
    accent: "#ec4899",
  },
  {
    source: "screenshot-05-editor.png",
    title: "A real code editor",
    body: "Edit in place with live syntax highlighting and line numbers across 20+ languages, then save, tag, and reuse.",
    pills: ["20+ languages", "Save & reuse", "Aura themes"],
    accent: "#8b5cf6",
  },
  {
    source: "screenshot-06-inpage-json.png",
    title: "Read JSON on any page",
    body: "Open a raw JSON page or API response and StructFlow renders it in a clean, themeable viewer right on the page.",
    pills: ["Formatted / Tree / Raw", "Search & copy", "Any JSON page"],
    accent: "#22c55e",
  },
]

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

async function main() {
  resetDir(plainDir)
  resetDir(annotatedDir)

  for (const item of items) {
    const sourcePath = join(assetDir, item.source)
    if (!existsSync(sourcePath)) throw new Error(`Missing source screenshot: ${item.source}`)
    copyFileSync(sourcePath, join(plainDir, item.source))
    await writeAnnotated(item, sourcePath)
  }

  for (const promoName of ["promo-small-440x280.png", "promo-marquee-1400x560.png"]) {
    const promo = join(assetDir, promoName)
    if (existsSync(promo)) copyFileSync(promo, join(plainDir, basename(promo)))
  }

  console.log(`Created ${items.length} annotated screenshots in store-assets/annotated/`)
}

async function writeAnnotated(item, sourcePath) {
  const panel = await sharp(sourcePath)
    .extract({ left: 380, top: 0, width: 520, height: 800 })
    .resize({ width: 520, height: 800, fit: "cover" })
    .png()
    .toBuffer()

  const svg = annotatedSvg(item)
  await sharp(Buffer.from(svg))
    .composite([{ input: panel, left: 684, top: 0 }])
    .flatten({ background: "#0b1020" })
    .removeAlpha()
    .png()
    .toFile(join(annotatedDir, item.source.replace(".png", "-annotated.png")))
}

function annotatedSvg({ title, body, pills, accent }) {
  const bodyLines = wrap(body, 43)
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800" viewBox="0 0 1280 800">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#0b1020"/>
          <stop offset="0.58" stop-color="#101827"/>
          <stop offset="1" stop-color="#071923"/>
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="24" stdDeviation="26" flood-color="#000" flood-opacity="0.45"/>
        </filter>
      </defs>
      <style>
        text { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      </style>
      <rect width="1280" height="800" fill="url(#bg)"/>
      <circle cx="120" cy="718" r="210" fill="#4f9cff" opacity=".11"/>
      <circle cx="1110" cy="92" r="220" fill="${accent}" opacity=".13"/>

      <g transform="translate(72 74)">
        ${brandMark(0, 0, 54)}
        <text x="74" y="23" fill="#f8fafc" font-size="30" font-weight="780">StructFlow</text>
        <text x="74" y="53" fill="#a7b1c2" font-size="18">Local-first code &amp; notes workspace with a built-in JSON viewer</text>
      </g>

      <g transform="translate(72 214)">
        <rect x="0" y="-44" width="${Math.min(520, title.length * 14 + 54)}" height="44" rx="22" fill="${accent}" opacity=".2"/>
        <text x="24" y="-16" fill="#dbeafe" font-size="18" font-weight="760">${escapeXml(title.split(" ")[0])}</text>
        ${headingLines(title).map((line, i) => `<text x="0" y="${72 + i * 58}" fill="#f8fafc" font-size="50" font-weight="850">${escapeXml(line)}</text>`).join("")}
        ${bodyLines.map((line, i) => `<text x="0" y="${226 + i * 32}" fill="#b8c3d6" font-size="22">${escapeXml(line)}</text>`).join("")}
        <g transform="translate(0 360)">
          ${pills.map((pill, i) => pillSvg(pill, i)).join("")}
        </g>
      </g>

      <g filter="url(#shadow)">
        <rect x="684" y="0" width="520" height="800" fill="#111827"/>
      </g>
    </svg>
  `
}

function pillSvg(text, index) {
  const y = index * 56
  return `
    <g transform="translate(0 ${y})">
      <rect x="0" y="0" width="${text.length * 10 + 50}" height="40" rx="20" fill="#ffffff" opacity=".1"/>
      <text x="22" y="26" fill="#e5edf8" font-size="16" font-weight="720">${escapeXml(text)}</text>
    </g>
  `
}

function brandMark(x, y, size) {
  if (iconBase64) {
    return `<image href="data:image/png;base64,${iconBase64}" x="${x}" y="${y}" width="${size}" height="${size}"/>`
  }
  return `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="#4f9cff"/>`
}

function headingLines(text) {
  return wrap(text, 22).slice(0, 2)
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

function resetDir(path) {
  rmSync(path, { recursive: true, force: true })
  mkdirSync(path, { recursive: true })
}
