const { copyFileSync, readFileSync, writeFileSync } = require("node:fs")
const { join, resolve } = require("node:path")

const target = process.argv[2] || "chrome"
const root = resolve(__dirname, "..")
const distManifest = join(root, "dist/manifest.json")

const manifest = JSON.parse(readFileSync(distManifest, "utf8"))

const commonDescription =
  "A side-panel workspace for code & notes: edit with live highlighting, beautify JSON/JS/TS/SQL/YAML/Markdown, and save, tag, and reuse in folders. Also opens raw JSON pages in a built-in viewer."

if (target === "chrome") {
  manifest.description = commonDescription
} else if (target === "edge") {
  manifest.description = commonDescription
  manifest.name = "StructFlow"
  manifest.action.default_title = "Open StructFlow"
} else if (target === "firefox") {
  manifest.description =
    "A sidebar workspace for code & notes: edit with live highlighting, beautify JSON/JS/TS/SQL/YAML/Markdown, and save, tag, and reuse in folders. Also opens raw JSON pages in a built-in viewer."
  manifest.permissions = manifest.permissions.filter((permission) => permission !== "sidePanel")
  if (manifest.background?.service_worker) {
    manifest.background.scripts = [manifest.background.service_worker]
    delete manifest.background.service_worker
    delete manifest.background.type
  }
  delete manifest.side_panel
  delete manifest.web_accessible_resources
  manifest.sidebar_action = {
    default_title: "StructFlow",
    default_panel: "index.html",
    default_icon: {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png",
    },
  }
  manifest.browser_specific_settings = {
    gecko: {
      id: "structflow@jessur2030.github.io",
      strict_min_version: "109.0",
      data_collection_permissions: {
        required: ["none"],
      },
    },
  }
  if (manifest.commands?.["open-structflow-side-panel"]?.suggested_key) {
    manifest.commands["open-structflow-side-panel"].suggested_key = { default: "Alt+Shift+S" }
    manifest.commands["open-structflow-side-panel"].description = "Open StructFlow sidebar"
  }
} else {
  throw new Error(`Unknown browser target: ${target}`)
}

writeFileSync(distManifest, `${JSON.stringify(manifest, null, 2)}\n`)

if (target !== "chrome") {
  copyFileSync(distManifest, join(root, `dist/manifest.${target}.json`))
}

console.log(`Prepared ${target} manifest`)
