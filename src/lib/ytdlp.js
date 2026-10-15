import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export const YT_DLP = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
export const FFMPEG = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'

const YTDLP_BASE = [
  '--no-warnings',
  '--no-playlist',
  '--extractor-retries',
  '5',
  '--retries',
  '3',
  '--socket-timeout',
  '20',
]

/**
 * Ejecuta yt-dlp con argumentos de array (nunca string con shell),
 * así una URL con comillas no puede inyectar comandos.
 */
export async function ytDlp(extraArgs, { timeout = 180000, input, cookies } = {}) {
  const args = [...YTDLP_BASE]
  if (cookies) args.push('--cookies', cookies)
  args.push(...extraArgs)

  const opts = { timeout, maxBuffer: 1024 * 1024 * 20, windowsHide: true }
  if (input) opts.input = input

  return execFileAsync(YT_DLP, args, opts)
}

export async function ytdlpVersion() {
  const { stdout } = await execFileAsync(YT_DLP, ['--version'], { timeout: 10000, windowsHide: true })
  return String(stdout).trim()
}

export function hasFfmpeg() {
  try {
    execFileAsync(FFMPEG, ['-version'], { timeout: 5000, windowsHide: true }).catch(() => {})
    return true
  } catch {
    return false
  }
}

/** Valida que la URL tenga el host esperado (evita SSRF y comillas maliciosas). */
export function validateUrl(raw, allowedHosts) {
  if (!raw || typeof raw !== 'string') return null
  let parsed
  try {
    parsed = new URL(raw)
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
  const hosts = (Array.isArray(allowedHosts) ? allowedHosts : [allowedHosts]).map((h) =>
    h.toLowerCase().replace(/^www\./, '')
  )
  const ok = hosts.some((h) => host === h || host.endsWith('.' + h))
  return ok ? parsed : null
}

export const YT_HOSTS = ['youtube.com', 'youtu.be', 'music.youtube.com', 'm.youtube.com']