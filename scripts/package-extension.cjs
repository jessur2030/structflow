const { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } = require("node:fs")
const { join, relative, resolve, sep } = require("node:path")
const { zipSync } = require("fflate")

const root = resolve(__dirname, "..")
const distDir = join(root, "dist")
const manifestPath = join(distDir, "manifest.json")
const packagePath = join(root, "package.json")

if (!existsSync(manifestPath)) {
  throw new Error("dist/manifest.json not found. Run pnpm build first.")
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
if (!manifest.version || typeof manifest.version !== "string") {
  throw new Error("dist/manifest.json is missing a string version.")
}

const packageJson = JSON.parse(readFileSync(packagePath, "utf8"))
if (packageJson.version !== manifest.version) {
  throw new Error(`Version mismatch: package.json=${packageJson.version}, manifest.json=${manifest.version}.`)
}

const files = {}
for (const filePath of listFiles(distDir)) {
  const zipPath = relative(distDir, filePath).split(sep).join("/")
  files[zipPath] = new Uint8Array(readFileSync(filePath))
}

const outputDir = join(root, "releases")
mkdirSync(outputDir, { recursive: true })

const outputPath = join(outputDir, `structflow-v${manifest.version}.zip`)
writeFileSync(outputPath, zipSync(files, { level: 9 }))

console.log(`Packaged ${Object.keys(files).length} files -> ${relative(root, outputPath)}`)

function listFiles(dir) {
  const results = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      results.push(...listFiles(path))
    } else if (stat.isFile()) {
      results.push(path)
    }
  }
  return results
}
