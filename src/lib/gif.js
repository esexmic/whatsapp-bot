import { FFMPEG } from './ytdlp.js'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { tmpdir } from 'os'
import { writeFileSync, unlinkSync, readFileSync, existsSync, mkdtempSync, rmSync } from 'fs'
import { join } from 'path'

const execFileAsync = promisify(execFile)

// nekos.life suele caerse mucho: estos espejos responden mejor.
const NEKOS_ENDPOINTS = {
  kiss: ['https://nekos.life/api/v2/img/kiss', 'https://nekos.best/api/v2/img/kiss'],
  hug: ['https://nekos.life/api/v2/img/hug', 'https://nekos.best/api/v2/img/hug'],
  slap: ['https://nekos.life/api/v2/img/slap', 'https://nekos.best/api/v2/img/slap'],
  pat: ['https://nekos.life/api/v2/img/pat', 'https://nekos.best/api/v2/img/pat'],
  tickle: ['https://nekos.life/api/v2/img/tickle', 'https://nekos.best/api/v2/img/tickle'],
}

export async function fetchGifUrl(action) {
  const endpoints = NEKOS_ENDPOINTS[action]
  if (!endpoints) throw new Error(`Acción no soportada: ${action}`)

  let lastError = 'sin respuesta'
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
      if (!res.ok) {
        lastError = `HTTP ${res.status}`
        continue
      }
      const json = await res.json()
      if (json?.url) return json.url
      lastError = 'respuesta sin URL'
    } catch (e) {
      lastError = e.message
    }
  }
  throw new Error(`No se pudo obtener el gif (${lastError})`)
}

export async function gifToMp4(gifUrl) {
  const res = await fetch(gifUrl, { signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`No se pudo descargar el gif (${res.status})`)

  const buf = Buffer.from(await res.arrayBuffer())
  const dir = mkdtempSync(join(tmpdir(), 'gif_'))
  const tmpGif = join(dir, 'in.gif')
  const tmpMp4 = join(dir, 'out.mp4')

  try {
    writeFileSync(tmpGif, buf)
    // execFile con array: sin shell, sin comillas que inyección.
    await execFileAsync(
      FFMPEG,
      [
        '-y',
        '-i', tmpGif,
        '-movflags', 'faststart',
        '-pix_fmt', 'yuv420p',
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        '-f', 'mp4',
        tmpMp4,
      ],
      { timeout: 30000 }
    )
    if (!existsSync(tmpMp4)) throw new Error('ffmpeg no generó el video')
    return readFileSync(tmpMp4)
  } finally {
    try { rmSync(dir, { recursive: true, force: true }) } catch {}
  }
}

export async function sendAnimeGif(conn, jid, action, caption, quoted) {
  const gifUrl = await fetchGifUrl(action)
  const mp4 = await gifToMp4(gifUrl)
  await conn.sendMessage(jid, { video: mp4, gifPlayback: true, caption }, { quoted })
}