import sharp from 'sharp'
import { makeSticker } from '../lib/sticker.js'
import { getSenderId } from '../lib/perms.js'

function wrapText(text, maxCharsPerLine = 10) {
  const words = text.split(' ')
  let lines = []
  let currentLine = ''

  words.forEach(word => {
    if ((currentLine + word).length > maxCharsPerLine) {
      if (currentLine) lines.push(currentLine.trim())
      currentLine = word + ' '
    } else {
      currentLine += word + ' '
    }
  })
  if (currentLine) lines.push(currentLine.trim())
  return lines
}

export default async function handler(conn, m, args, db) {
  const jid = m.chat || m.key?.remoteJid || ''
  const sender = getSenderId(m)

  if (!args || args.length === 0) {
    return conn.sendMessage(jid, { text: '✏️ Uso: .brat <texto>\n\nEjemplo: .brat hola' }, { quoted: m })
  }

  try {
    const text = args.join(' ')
    const lines = wrapText(text, 10)

    const svgWidth = 512
    const svgHeight = 512
    const lineHeight = Math.min(100, Math.floor(430 / Math.max(lines.length, 1)))
    const fontSize = Math.max(30, Math.min(95, Math.floor(lineHeight * 0.82)))
    const firstBaseline = Math.round(256 - ((lines.length - 1) * lineHeight) / 2)

    const svgText = lines
      .map((line, index) => {
        const yPos = firstBaseline + index * lineHeight
        // El ancho fijo deja margen para el borde y evita que una letra toque
        // el límite del SVG. El lienzo ya es cuadrado, por lo que no aparecen
        // las franjas de contain de la versión anterior.
        return `<text x="256" y="${yPos}" text-anchor="middle" class="text" textLength="440" lengthAdjust="spacingAndGlyphs">${line}</text>`
      })
      .join('')

    const svgBuffer = Buffer.from(`
      <svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
        <style>
          .text {
            font-family: 'Arial Narrow', 'Arial', sans-serif;
            font-size: ${fontSize}px;
            font-weight: 900;
            fill: black;
          }
        </style>
        <rect width="100%" height="100%" fill="white"/>
        ${svgText}
      </svg>
    `)

    const buffer = await sharp(svgBuffer)
      .webp({ quality: 90 })
      .toBuffer()

    const stickerBuffer = await makeSticker(buffer, {
      packname: m.pushName || sender || 'bot',
      author: 'brat'
    })

    if (stickerBuffer) {
      await conn.sendMessage(jid, { sticker: stickerBuffer }, { quoted: m })
    } else {
      throw new Error('No se pudo generar el sticker')
    }
  } catch (error) {
    console.error(error)
    await conn.sendMessage(jid, { text: `Error: ${error.message}` }, { quoted: m })
  }
}
