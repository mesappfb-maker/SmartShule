// SmartShule — Conversion du logo officiel en icônes multi-format
// ============================================================
// Convertit logo-officiel.jpeg (1280x1280) en :
//   - public/icon.png (512x512)
//   - public/icon-16/32/48/64/128/192/256/512.png (multi-tailles pour PWA)
//   - public/icon.ico (ICO multi-résolution pour Windows)
//   - public/favicon.ico (favicon web)
//   - public/favicon.svg (version vectorielle si applicable)
//   - build/icon.ico (copie pour electron-builder)
//   - build/installer-welcome.bmp (164x314 pour NSIS welcome page)
//   - build/installer-header.bmp (150x57 pour NSIS header)

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

  console.log('🎨 Conversion du logo officiel...')
  console.log(`   Source : ${SOURCE_LOGO}`)

  // Crée build/ s'il n'existe pas
  if (!existsSync(BUILD_DIR)) mkdirSync(BUILD_DIR, { recursive: true })

  // =============================================
  // 1. PNG multi-tailles (pour PWA + Electron)
  // =============================================
  console.log('\n📦 Génération PNG multi-tailles...')
  for (const size of PNG_SIZES) {
    const outFile = path.join(PUBLIC_DIR, `icon-${size}.png`)
    await sharp(SOURCE_LOGO)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(outFile)
    console.log(`   ✓ icon-${size}.png`)
  }

  // icon.png = 512x512 (référence)
  await sharp(SOURCE_LOGO)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(PUBLIC_DIR, 'icon.png'))
  console.log('   ✓ icon.png (512x512)')

  // =============================================
  // 2. ICO Windows multi-résolution (pour .exe + raccourcis)
  // =============================================
  console.log('\n📦 Génération ICO Windows multi-résolution...')
  const pngBuffers = await Promise.all(
    ICO_SIZES.map(size =>
      sharp(SOURCE_LOGO)
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
  console.log(`   ✓ icon.ico (${ico.length} bytes)`)
  console.log(`   ✓ favicon.ico`)

  // =============================================
  // 3. Bitmaps NSIS (PNG — MUI2 le supporte via le plugin Image)
  // =============================================
  console.log('\n📦 Génération images NSIS (PNG)...')

  // Welcome bitmap — 164x314 (standard NSIS welcome page)
  await sharp(SOURCE_LOGO)
    .resize(164, 314, { fit: 'contain', background: '#FFFFFF' })
    .flatten({ background: '#FFFFFF' })
    .png()
    .toFile(path.join(BUILD_DIR, 'installer-welcome.png'))
  console.log('   ✓ installer-welcome.png (164x314)')

  // Header bitmap — 150x57 (standard NSIS header)
  await sharp(SOURCE_LOGO)
    .resize(150, 57, { fit: 'contain', background: '#FFFFFF' })
    .flatten({ background: '#FFFFFF' })
    .png()
    .toFile(path.join(BUILD_DIR, 'installer-header.png'))
  console.log('   ✓ installer-header.png (150x57)')

  // Copie icon.png dans build/ pour electron-builder
  copyFileSync(path.join(PUBLIC_DIR, 'icon.png'), path.join(BUILD_DIR, 'icon.png'))

  console.log('\n✅ Conversion terminée !')
  console.log('   Le logo officiel est maintenant utilisé pour :')
  console.log('   - Icône app Electron (icon.png/icon.ico)')
  console.log('   - Favicon web (favicon.ico)')
  console.log('   - PWA icons (icon-16 à icon-512)')
  console.log('   - NSIS installer welcome bitmap (164x314)')
  console.log('   - NSIS installer header bitmap (150x57)')
}

convertLogo().catch(err => {
  console.error('❌ Erreur:', err)
  process.exit(1)
})
