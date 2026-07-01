const sharp = require("sharp")
const fs = require("fs")
const path = require("path")

// Vector source of truth. Rasterized directly at each target size (not downscaled
// from one big raster), so the mark stays crisp all the way down to 16px.
const SRC = path.resolve(__dirname, "../src/assets/logo.svg")
const ICON_DIR = path.resolve(__dirname, "../public/icons")
const ASSET_DIR = path.resolve(__dirname, "../src/assets")

async function render(svg, size, out) {
  // High render density then resize down = crisp, well-anti-aliased edges at any size.
  await sharp(Buffer.from(svg), { density: 384 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(out)
}

async function run() {
  const svg = fs.readFileSync(SRC, "utf8")

  // Header logo (transparent PNG).
  await render(svg, 256, path.join(ASSET_DIR, "logo.png"))

  // Extension icon sizes for the manifest / toolbar / favicon.
  for (const s of [16, 32, 48, 128]) {
    await render(svg, s, path.join(ICON_DIR, `icon-${s}.png`))
  }
  console.log("Generated logo.png + icons 16/32/48/128 from logo.svg")
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
