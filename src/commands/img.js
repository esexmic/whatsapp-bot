import { downloadContentFromMessage } from '@whiskeysockets/baileys'
import { FFMPEG } from '../lib/ytdlp.js'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { tmpdir } from 'os'
import { writeFileSync, readFileSync, existsSync, rmSync, mkdtempSync } from 'fs'
import { join } from 'path'

const execFileAsync = promisify(execFile)

export default async function handler(conn, m) {
  const jid = m.chat || m.key?.remoteJid || ''

  const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage
  if (!quoted?.stickerMessage) {
    return conn.sendMessage(jid, { text: '🖼️ Responde a un sticker con .img' }, { quoted: m })
  }

  const dir = mkdtempSync(join(tmpdir(), 'img_'))

  try {
    const buffer = await downloadContentFromMessage(quoted.stickerMessage, 'buffer', {})
    const tmpInput = join(dir, 'in.webp')
    const tmpOutput = join(dir, 'out.png')
    writeFileSync(tmpInput, buffer)

    await execFileAsync(FFMPEG, ['-y', '-i', tmpInput, tmpOutput], { timeout: 20000 })

    if (!existsSync(tmpOutput)) throw new Error('ffmpeg no generó la imagen')
    await conn.sendMessage(jid, { image: readFileSync(tmpOutput) }, { quoted: m })
  } catch (e) {
    console.error('[img]', e.message)
    await conn
      .sendMessage(jid, { text: `❌ No pude convertir el sticker\n${String(e.message).slice(0, 150)}` }, { quoted: m })
      .catch(() => {})
  } finally {
    try { rmSync(dir, { recursive: true, force: true }) } catch {}
  }
}