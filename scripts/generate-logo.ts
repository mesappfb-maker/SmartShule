// SmartShule — Génération du logo temporaire (à remplacer par le vrai logo)
// Crée un PNG 512x512 avec gradient bleu + icône livre + chapeau diplôme
// + génère l'ICO Windows multi-résolution (16, 32, 48, 64, 128, 256)

import sharp from 'sharp'
import { writeFileSync } from 'fs'
import path from 'path'

const PUBLIC_DIR = '/home/z/my-project/public'
const LOGO_PNG = path.join(PUBLIC_DIR, 'icon.png')
const LOGO_ICO = path.join(PUBLIC_DIR, 'icon.ico')
const BUILD_DIR = '/home/z/my-project/build'
const LOGO_BUILD_PNG = path.join(BUILD_DIR, 'icon.png')

// SVG du logo (vectoriel, scalable)
const logoSVG = `
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563EB"/>
      <stop offset="100%" stop-color="#0F766E"/>
    </linearGradient>
    <linearGradient id="bookGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#F3F4F6"/>
    </linearGradient>
  </defs>

  <!-- Fond avec gradient + coins arrondis -->
  <rect width="512" height="512" rx="80" fill="url(#bg)"/>

  <!-- Cercle blanc translucide en arrière-plan -->
  <circle cx="256" cy="256" r="200" fill="white" opacity="0.08"/>

  <!-- Chapeau diplôme (mortarboard) en haut -->
  <g transform="translate(256, 130)">
    <!-- Plateau du chapeau -->
    <polygon points="-90,0 90,0 120,-20 0,-50 -120,-20" fill="#FFFFFF"/>
    <!-- Dessus du chapeau -->
    <polygon points="-90,0 90,0 60,15 -60,15" fill="#E5E7EB"/>
    <!-- Touffe (tassel) -->
    <line x1="0" y1="15" x2="0" y2="50" stroke="#FBBF24" stroke-width="4"/>
    <circle cx="0" cy="55" r="8" fill="#FBBF24"/>
  </g>

  <!-- Livre ouvert en bas -->
  <g transform="translate(256, 320)">
    <!-- Pages du livre -->
    <path d="M -120 0 L -120 -50 Q -120 -60 -110 -60 L -10 -60 L -10 30 L -110 30 Q -120 30 -120 20 Z" fill="url(#bookGrad)" stroke="#E5E7EB" stroke-width="2"/>
    <path d="M 10 -60 L 110 -60 Q 120 -60 120 -50 L 120 20 Q 120 30 110 30 L 10 30 Z" fill="url(#bookGrad)" stroke="#E5E7EB" stroke-width="2"/>
    <!-- Lignes de texte page gauche -->
    <line x1="-100" y1="-40" x2="-30" y2="-40" stroke="#9CA3AF" stroke-width="3"/>
    <line x1="-100" y1="-25" x2="-30" y2="-25" stroke="#9CA3AF" stroke-width="3"/>
    <line x1="-100" y1="-10" x2="-50" y2="-10" stroke="#9CA3AF" stroke-width="3"/>
    <!-- Lignes de texte page droite -->
    <line x1="30" y1="-40" x2="100" y2="-40" stroke="#9CA3AF" stroke-width="3"/>
    <line x1="30" y1="-25" x2="100" y2="-25" stroke="#9CA3AF" stroke-width="3"/>
    <line x1="30" y1="-10" x2="80" y2="-10" stroke="#9CA3AF" stroke-width="3"/>
  </g>

  <!-- Texte "SmartShule" en bas -->
  <text x="256" y="450" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="white" text-anchor="middle" opacity="0.95">SmartShule</text>
</svg>
`

async function generateLogo() {
  console.log('🎨 Génération du logo PNG 512x512...')
  await sharp(Buffer.from(logoSVG))
    .png()
    .toFile(LOGO_PNG)
  console.log(`✅ ${LOGO_PNG} créé`)

  // Crée build/ s'il n'existe pas
  const fs = await import('fs')
  if (!fs.existsSync(BUILD_DIR)) {
    fs.mkdirSync(BUILD_DIR, { recursive: true })
  }

  // Copie dans build/
  await sharp(Buffer.from(logoSVG))
    .png()
    .toFile(LOGO_BUILD_PNG)
  console.log(`✅ ${LOGO_BUILD_PNG} créé`)

  // Génère l'ICO Windows multi-résolution
  console.log('🎨 Génération du fichier ICO Windows...')
  const sizes = [16, 32, 48, 64, 128, 256]
  const pngBuffers = await Promise.all(
    sizes.map(size =>
      sharp(Buffer.from(logoSVG))
        .resize(size, size)
        .png()
        .toBuffer()
    )
  )

  // Construction manuelle du format ICO
  // Header (6 bytes) + directory entries (16 bytes each) + images
  const headerSize = 6
  const dirEntrySize = 16
  const dirSize = dirEntrySize * sizes.length
  const offset = headerSize + dirSize

  // Calcul de la taille totale
  let totalSize = offset
  const imageSizes: number[] = []
  for (const buf of pngBuffers) {
    imageSizes.push(buf.length)
    totalSize += buf.length
  }

  // Buffer final
  const ico = Buffer.alloc(totalSize)
  let pos = 0

  // ICONDIR header
  ico.writeUInt16LE(0, pos)       // reserved
  ico.writeUInt16LE(1, pos + 2)   // type: 1 = icon
  ico.writeUInt16LE(sizes.length, pos + 4) // count
  pos += 6

  // Directory entries
  let imageOffset = offset
  for (let i = 0; i < sizes.length; i++) {
    const size = sizes[i]
    const pngSize = imageSizes[i]

    ico.writeUInt8(size === 256 ? 0 : size, pos)      // width (256 = 0)
    ico.writeUInt8(size === 256 ? 0 : size, pos + 1)   // height
    ico.writeUInt8(0, pos + 2)                          // colors
    ico.writeUInt8(0, pos + 3)                          // reserved
    ico.writeUInt16LE(1, pos + 4)                       // planes
    ico.writeUInt16LE(32, pos + 6)                      // bit count
    ico.writeUInt32LE(pngSize, pos + 8)                 // image size
    ico.writeUInt32LE(imageOffset, pos + 12)           // offset

    pos += 16
    imageOffset += pngSize
  }

  // Images
  for (const buf of pngBuffers) {
    buf.copy(ico, pos)
    pos += buf.length
  }

  writeFileSync(LOGO_ICO, ico)
  console.log(`✅ ${LOGO_ICO} créé (${ico.length} bytes)`)

  // Vérification
  console.log('')
  console.log('=== Vérification ===')
  console.log(`PNG 512x512 : ${LOGO_PNG}`)
  console.log(`ICO multi-size : ${LOGO_ICO}`)
}

generateLogo().catch(console.error)
