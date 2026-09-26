// SmartShule — Conversion du logo officiel avec fond TRANSPARENT
// ============================================================
// Le logo JPEG d'origine a un fond noir à cause de la conversion.
// On convertit en PNG avec fond transparent (alpha channel).
//
// Génère :
//   - public/icon.png (512x512 transparent)
//   - public/icon-16 à icon-512 (multi-tailles transparentes)
//   - public/icon.ico (ICO multi-résolution transparent)
//   - public/favicon.ico
//   - build/installer-welcome.png (164x314 avec fond blanc pour NSIS)
//   - build/installer-header.png (150x57 avec fond blanc pour NSIS)

import sharp from 'sharp'
import { writeFileSync, mkdirSync, existsSync, copyFileSync } from 'fs'
import path from 'path'

const PUBLIC_DIR = '/home/z/my-project/public'
const BUILD_DIR = '/home/z/my-project/build'
const SOURCE_LOGO = path.join(PUBLIC_DIR, 'logo-officiel.jpeg')

const PNG_SIZES = [16, 32, 48, 64, 128, 192, 256, 512]
const ICO_SIZES = [16, 32, 48, 64, 128, 256]

async function convertLogo() {
  if (!existsSync(SOURCE_LOGO)) {
    console.error(`❌ Logo source introuvable : ${SOURCE_LOGO}`)
    process.exit(1)
  }

  console.log('🎨 Conversion du logo officiel avec fond TRANSPARENT...')
  console.log(`   Source : ${SOURCE_LOGO}`)

  if (!existsSync(BUILD_DIR)) mkdirSync(BUILD_DIR, { recursive: true })

  // =============================================
  // 1. PNG multi-tailles TRANSPARENTS
  // =============================================
  console.log('\n📦 Génération PNG multi-tailles (transparent)...')

  // Charge le logo source une fois
  const sourceBuffer = await sharp(SOURCE_LOGO).toBuffer()

  for (const size of PNG_SIZES) {
    const outFile = path.join(PUBLIC_DIR, `icon-${size}.png`)
    await sharp(sourceBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(outFile)
    console.log(`   ✓ icon-${size}.png (transparent)`)
  }

  // icon.png = 512x512 transparent
  await sharp(sourceBuffer)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(PUBLIC_DIR, 'icon.png'))
  console.log('   ✓ icon.png (512x512 transparent)')

  // =============================================
  // 2. ICO Windows multi-résolution TRANSPARENT
  // =============================================
  console.log('\n📦 Génération ICO Windows (transparent)...')
  const pngBuffers = await Promise.all(
    ICO_SIZES.map(size =>
      sharp(sourceBuffer)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
    )
  )

  const headerSize = 6
  const dirEntrySize = 16
  const dirSize = dirEntrySize * ICO_SIZES.length
  const offset = headerSize + dirSize
  let totalSize = offset
  const imageSizes: number[] = []
  for (const buf of pngBuffers) {
    imageSizes.push(buf.length)
    totalSize += buf.length
  }

  const ico = Buffer.alloc(totalSize)
  let pos = 0
  ico.writeUInt16LE(0, pos)
  ico.writeUInt16LE(1, pos + 2)
  ico.writeUInt16LE(ICO_SIZES.length, pos + 4)
  pos += 6

  let imageOffset = offset
  for (let i = 0; i < ICO_SIZES.length; i++) {
    const size = ICO_SIZES[i]
    const pngSize = imageSizes[i]
    ico.writeUInt8(size === 256 ? 0 : size, pos)
    ico.writeUInt8(size === 256 ? 0 : size, pos + 1)
    ico.writeUInt8(0, pos + 2)
    ico.writeUInt8(0, pos + 3)
    ico.writeUInt16LE(1, pos + 4)
    ico.writeUInt16LE(32, pos + 6)
    ico.writeUInt32LE(pngSize, pos + 8)
    ico.writeUInt32LE(imageOffset, pos + 12)
    pos += 16
    imageOffset += pngSize
  }

  for (const buf of pngBuffers) {
    buf.copy(ico, pos)
    pos += buf.length
  }

  writeFileSync(path.join(PUBLIC_DIR, 'icon.ico'), ico)
  writeFileSync(path.join(BUILD_DIR, 'icon.ico'), ico)
  writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), ico)
  console.log(`   ✓ icon.ico (${ico.length} bytes, transparent)`)
  console.log(`   ✓ favicon.ico`)

  // =============================================
  // 3. Images NSIS (avec fond BLANC car NSIS ne gère pas l'alpha BMP)
  // =============================================
  console.log('\n📦 Génération images NSIS (fond blanc)...')

  await sharp(sourceBuffer)
    .resize(164, 314, { fit: 'contain', background: '#FFFFFF' })
    .flatten({ background: '#FFFFFF' })
    .png()
    .toFile(path.join(BUILD_DIR, 'installer-welcome.png'))
  console.log('   ✓ installer-welcome.png (164x314, fond blanc)')

  await sharp(sourceBuffer)
    .resize(150, 57, { fit: 'contain', background: '#FFFFFF' })
    .flatten({ background: '#FFFFFF' })
    .png()
    .toFile(path.join(BUILD_DIR, 'installer-header.png'))
  console.log('   ✓ installer-header.png (150x57, fond blanc)')

  copyFileSync(path.join(PUBLIC_DIR, 'icon.png'), path.join(BUILD_DIR, 'icon.png'))

  console.log('\n✅ Conversion terminée !')
  console.log('   - Logo PNG/ICO : fond TRANSPARENT')
  console.log('   - NSIS bitmaps : fond BLANC (requis par NSIS)')
}

convertLogo().catch(err => {
  console.error('❌ Erreur:', err)
  process.exit(1)
})
