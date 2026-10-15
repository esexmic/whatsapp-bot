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

    const lineHeight = 100
    const svgWidth = 500
    const svgHeight = lines.length * lineHeight

    const svgText = lines
      .map((line, index) => {
        const yPos = (index * lineHeight) + 85
        return `<text x="25" y="${yPos}" class="text" textLength="450" lengthAdjust="spacingAndGlyphs">${line}</text>`
      })
      .join('')

    const svgBuffer = Buffer.from(`
      <svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
        <style>
          .text {
            font-family: 'Arial Narrow', 'Arial', sans-serif;
            font-size: 95px;
            font-weight: 900;
            fill: black;
          }
        </style>
        <rect width="100%" height="100%" fill="white"/>
        ${svgText}
      </svg>
    `)

    const buffer = await sharp(svgBuffer)
      .resize(512, 512, {
        fit: 'fill'
      })
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