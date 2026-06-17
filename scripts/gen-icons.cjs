const sharp = require("sharp")
const path = require("path")

const SRC = path.resolve(__dirname, "../src/assets/logo-source.png")
const ICON_DIR = path.resolve(__dirname, "../public/icons")
const ASSET_DIR = path.resolve(__dirname, "../src/assets")

async function run() {
  // Trim the surrounding transparent area so the mark fills the frame.
  const trimmed = await sharp(SRC).trim({ threshold: 10 }).toBuffer()
  const meta = await sharp(trimmed).metadata()
  const size = Math.max(meta.width, meta.height)
  // Center the trimmed mark on a square transparent canvas with light padding.
  const pad = Math.round(size * 0.08)
  const canvas = size + pad * 2
  const square = await sharp({
    create: {
      width: canvas,
      height: canvas,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: trimmed, gravity: "center" }])
    .png()
    .toBuffer()

  // A clean, trimmed, transparent logo for the in-app header.
  await sharp(square).resize(256, 256).png().toFile(path.join(ASSET_DIR, "logo.png"))

  // Extension icon sizes for the manifest.
  for (const s of [16, 32, 48, 128]) {
    await sharp(square).resize(s, s).png().toFile(path.join(ICON_DIR, `icon-${s}.png`))
  }
  console.log("Generated logo.png and icons 16/32/48/128 from", `${meta.width}x${meta.height}`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
