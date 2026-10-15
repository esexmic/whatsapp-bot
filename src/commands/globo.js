import sharp from 'sharp'
import { downloadContentFromMessage } from '@whiskeysockets/baileys'
import fs from 'fs'
import path from 'path'

const globeFile = path.join(process.cwd(), 'assets', 'globo.png')
const SZ = 512
// globo.png = 825x154 → aspect ~5.36
// Queremos ~23% del sticker ≈ 118px de alto, llenando el ancho
const GH = Math.round(SZ * 154 / 825 * 1.25) // ~119px (~23%)

export default async function handler(conn, m, args, db) {
  const chat = m.chat || m.key?.remoteJid

  const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage
  let mediaContent, mediaType
  if (quoted?.imageMessage) { mediaContent = quoted.imageMessage; mediaType = 'image' }
  else if (quoted?.stickerMessage) { mediaContent = quoted.stickerMessage; mediaType = 'sticker' }

  if (!mediaContent) {
    return conn.sendMessage(chat, { text: '⚠️ Responde a una imagen o sticker con .globo' }, { quoted: m })
  }

  await conn.sendMessage(chat, { react: { text: '⏳', key: m.key } })

  try {
    const stream = await downloadContentFromMessage(mediaContent, mediaType)
    const chunks = []
    for await (const chunk of stream) chunks.push(chunk)
    const user = Buffer.concat(chunks)

    const globe = fs.readFileSync(globeFile)
    const userH = SZ - GH

    // Globe: fill ancho, cover mantiene proporcion
    const gBuf = await sharp(globe).resize(SZ, GH, { fit: 'cover', position: 'centre' }).png().toBuffer()
    // User: fill el resto debajo
    const uBuf = await sharp(user).resize(SZ, userH, { fit: 'cover', position: 'centre' }).png().toBuffer()

    const tmp = path.join(process.cwd(), 'temp')
    if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true })
    const out = path.join(tmp, `globo_${Date.now()}.webp`)

    await sharp({ create: { width: SZ, height: SZ, channels: 3, background: { r: 255, g: 255, b: 255 } } })
      .composite([
        { input: gBuf, top: 0, left: 0 },
        { input: uBuf, top: GH, left: 0 }
      ])
      .webp({ quality: 90 })
      .toFile(out)

    await conn.sendMessage(chat, { sticker: { url: out } }, { quoted: m })
    try { fs.unlinkSync(out) } catch {}
  } catch (e) {
    await conn.sendMessage(chat, { text: `❌ Error: ${e.message?.slice(0, 150)}` }, { quoted: m })
  }
}
