import { downloadMediaBuffer } from '../lib/media.js'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { tmpdir } from 'os'
import { writeFileSync, unlinkSync, readFileSync, existsSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import webpmux from 'node-webpmux'
import { FFMPEG } from '../lib/ytdlp.js'

const execFileAsync = promisify(execFile)
const { Image } = webpmux

function makeMinimalWebP(chunkName, chunkData) {
  const header = Buffer.alloc(12)
  header.write('RIFF', 0)
  header.writeUInt32LE(4 + 8 + chunkData.length, 4)
  header.write('WEBP', 8)
  const chunkHeader = Buffer.alloc(8)
  chunkHeader.write(chunkName, 0)
  chunkHeader.writeUInt32LE(chunkData.length, 4)
  return Buffer.concat([header, chunkHeader, chunkData])
}

function cleanup(files, dirs) {
  for (const f of files) { try { unlinkSync(f) } catch {} }
  for (const d of dirs) { try { rmSync(d, { recursive: true }) } catch {} }
}

export default async function handler(conn, m) {
  const jid = m.chat || m.key?.remoteJid || ''

  const quotedMsg = m.message?.extendedTextMessage?.contextInfo?.quotedMessage
  if (!quotedMsg?.stickerMessage) {
    return conn.sendMessage(jid, { text: 'Responde a un sticker con .mp4' }, { quoted: m })
  }

  const tmpFiles = []
  const tmpDirs = []

  try {
    const buffer = await downloadMediaBuffer(quotedMsg.stickerMessage, 'sticker')
    if (!buffer || buffer.length < 50) throw new Error('Sticker vacio o corrupto')

    const img = new Image()
    await img.load(buffer)

    const ts = Date.now()
    const tmpDir = join(tmpdir(), `mp4_${ts}`)
    mkdirSync(tmpDir, { recursive: true })
    tmpDirs.push(tmpDir)

    const isAnim = img.hasAnim

    if (isAnim) {
      for (let i = 0; i < img.frames.length; i++) {
        const frame = img.frames[i]
        let webpBuf

        if (frame.vp8) {
          webpBuf = makeMinimalWebP('VP8 ', frame.vp8.raw)
        } else if (frame.vp8l) {
          webpBuf = makeMinimalWebP('VP8L', frame.vp8l.raw)
        } else {
          continue
        }

        const webpPath = join(tmpDir, `f_${String(i).padStart(3, '0')}.webp`)
        const pngPath = join(tmpDir, `f_${String(i).padStart(3, '0')}.png`)
        writeFileSync(webpPath, webpBuf)
        tmpFiles.push(webpPath)

        execFileAsync(FFMPEG, ['-y', '-i', webpPath, pngPath], { timeout: 15000 })
        tmpFiles.push(pngPath)
      }

      const pngCount = tmpFiles.filter(f => f.endsWith('.png')).length
      if (pngCount === 0) throw new Error('No se pudieron extraer frames')

      const avgDelay = img.frames.reduce((a, f) => a + (f.delay || 100), 0) / img.frames.length
      const fps = Math.max(1, Math.min(30, Math.round(1000 / avgDelay)))

      const tmpOutput = join(tmpdir(), `${ts}.mp4`)
      tmpFiles.push(tmpOutput)
      const inputPattern = join(tmpDir, 'f_%03d.png')
      execFileAsync(FFMPEG, ['-y', '-framerate', String(fps), '-i', inputPattern, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', tmpOutput], { timeout: 60000 })

      if (!existsSync(tmpOutput) || readFileSync(tmpOutput).length < 200) {
        throw new Error('MP4 generado vacio')
      }

      const mp4Buffer = readFileSync(tmpOutput)
      await conn.sendMessage(jid, { video: mp4Buffer, caption: 'Sticker animado convertido' }, { quoted: m })

    } else {
      let webpBuf
      if (img.data?.vp8) {
        webpBuf = makeMinimalWebP('VP8 ', img.data.vp8.raw)
      } else if (img.data?.vp8l) {
        webpBuf = makeMinimalWebP('VP8L', img.data.vp8l.raw)
      } else {
        throw new Error('No se pudo extraer imagen del sticker')
      }

      const webpPath = join(tmpDir, 'frame.webp')
      const pngPath = join(tmpDir, 'frame.png')
      writeFileSync(webpPath, webpBuf)
      tmpFiles.push(webpPath, pngPath)

      execFileAsync(FFMPEG, ['-y', '-i', webpPath, pngPath], { timeout: 15000 })

      const tmpOutput = join(tmpdir(), `${ts}.mp4`)
      tmpFiles.push(tmpOutput)
      execFileAsync(FFMPEG, ['-y', '-loop', '1', '-i', pngPath, '-t', '2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', tmpOutput], { timeout: 30000 })

      if (!existsSync(tmpOutput) || readFileSync(tmpOutput).length < 200) {
        throw new Error('MP4 generado vacio')
      }

      const mp4Buffer = readFileSync(tmpOutput)
      await conn.sendMessage(jid, { video: mp4Buffer, caption: 'Sticker convertido' }, { quoted: m })
    }

  } catch (e) {
    console.error(e)
    await conn.sendMessage(jid, { text: `No pude convertir el sticker: ${e.message}` }, { quoted: m })
  } finally {
    cleanup(tmpFiles, tmpDirs)
  }
}