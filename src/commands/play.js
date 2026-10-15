import { execFile } from 'child_process'
import { promisify } from 'util'
import { tmpdir } from 'os'
import { join } from 'path'
import { writeFileSync, unlinkSync, readFileSync, existsSync, mkdirSync } from 'fs'

const execFileAsync = promisify(execFile)
const YT_DLP = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
const TEMP_DIR = join(tmpdir(), 'bot_play')
const YT_COOKIE_PATH = 'src/youtube_cookies.txt'

if (!existsSync(TEMP_DIR)) mkdirSync(TEMP_DIR, { recursive: true })

if (process.env.YOUTUBE_COOKIES && !existsSync(YT_COOKIE_PATH)) {
  try { writeFileSync(YT_COOKIE_PATH, process.env.YOUTUBE_COOKIES) } catch {}
}

function formatTime(seconds) {
  if (!seconds) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function formatViews(n) {
  if (!n || isNaN(n)) return '?'
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toString()
}

async function searchYT(query) {
  // Antes usaba el paquete `yt-search`, abandonado y con ReDoS + DoS.
  // yt-dlp ya hace la busqueda con el mismo motor de YouTube.
  try {
    const { stdout } = await execFileAsync(
      YT_DLP,
      [
        '--flat-playlist',
        '--dump-json',
        '--no-warnings',
        `--print`, '%(id)s\t%(title)s\t%(duration)s\t%(uploader)s\t%(view_count)s',
        '--playlist-items', '1',
        `ytsearch1:${query}`,
      ],
      { timeout: 30000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }
    )
    const line = stdout.split('\n').find((l) => l.trim())
    if (!line) return null
    const [id, title, duration, uploader, views] = line.split('\t')
    if (!id) return null
    return {
      url: `https://www.youtube.com/watch?v=${id}`,
      title: title || 'Sin título',
      videoId: id,
      duration: Number(duration) || 0,
      author: uploader || '',
      views: Number(views) || 0,
    }
  } catch (e) {
    console.error('[play] busqueda fallida:', e.message)
    return null
  }
}

// -- TRY VARIOUS YOUTUBE DOWNLOAD APIS --
const DOWNLOAD_APIS = [
  // 1) SocialKit (tiene API key en Railway)
  async (videoId) => {
    const key = process.env.SOCIALKIT_KEY
    if (!key) return null
    try {
      const r = await fetch('https://api.socialkit.dev/youtube/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_key: key, url: `https://youtube.com/watch?v=${videoId}`, format: 'mp3' }),
        signal: AbortSignal.timeout(30000)
      })
      if (!r.ok) return null
      const d = await r.json()
      return d?.data?.downloadUrl || null
    } catch (e) { console.log('SocialKit error:', e.message); return null }
  },

  // 2) yt2mp3converter.net (free, unlimited, returns JSON con download URL)
  async (videoId) => {
    try {
      const r = await fetch(`https://www.yt2mp3converter.net/apis/fetch.php?url=https://youtube.com/watch?v=${videoId}&format=mp3`, {
        signal: AbortSignal.timeout(20000)
      })
      if (!r.ok) return null
      const d = await r.json()
      return d?.download || null
    } catch (e) { console.log('yt2mp3 error:', e.message); return null }
  },

  // 3) Vevioz API (free REST, devuelve redirect a descarga)
  async (videoId) => {
    try {
      const r = await fetch(`https://api.vevioz.com/api/single/mp3?url=https://youtube.com/watch?v=${videoId}`, {
        signal: AbortSignal.timeout(30000),
        redirect: 'manual'
      })
      if (r.status >= 300 && r.status < 400) return r.headers.get('location')
      return null
    } catch (e) { console.log('Vevioz error:', e.message); return null }
  },

  // 4) Oceansaver (fallback lejano)
  async (videoId, fullUrl) => {
    try {
      const r = await fetch(
        `https://p.oceansaver.in/ajax/download.php?format=mp3&url=${encodeURIComponent(fullUrl)}&api=dfcb6d76f2f6a9894gjkege8a4ab232222`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) }
      )
      const d = await r.json()
      if (!d?.success || !d?.id) return null
      for (let i = 0; i < 30; i++) {
        const p = await fetch(`https://p.oceansaver.in/ajax/progress.php?id=${d.id}`,
          { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) }
        )
        const pd = await p.json()
        if (pd?.success && pd.progress === 1000) return pd.download_url
        await new Promise(r => setTimeout(r, 2000))
      }
    } catch { return null }
    return null
  },
]

// -- YT-DLP FALLBACK --
async function downloadWithYtDlp(url) {
  const ts = Date.now()
  const hasCookies = existsSync(YT_COOKIE_PATH)

  // Try with cookies + JS runtime
  if (hasCookies) {
    try {
      const out = join(TEMP_DIR, `play_${ts}_c.%(ext)s`)
      await execFileAsync(YT_DLP, [
        '--no-playlist', '--js-runtimes', `node:${process.execPath}`,
        '--cookies', YT_COOKIE_PATH,
        '-f', 'bestaudio/best', '--extract-audio', '--audio-format', 'mp3',
        '-o', out, url
      ], { timeout: 120000 })
      const file = join(TEMP_DIR, `play_${ts}_c.mp3`)
      if (existsSync(file) && readFileSync(file).length > 1000) return file
    } catch {}
  }

  // Try android client
  try {
    const out = join(TEMP_DIR, `play_${ts}_a.%(ext)s`)
    await execFileAsync(YT_DLP, [
      '--no-playlist', '--extractor-args', 'youtube:player_client=android',
      '-f', 'bestaudio/best', '--extract-audio', '--audio-format', 'mp3',
      '-o', out, url
    ], { timeout: 120000 })
    const file = join(TEMP_DIR, `play_${ts}_a.mp3`)
    if (existsSync(file) && readFileSync(file).length > 1000) return file
  } catch {}

  throw new Error('YouTube bloqueó el servidor')
}

export default async function handler(conn, m, args, db) {
  const jid = m.chat || m.key?.remoteJid || ''
  const text = args.join(' ')

  if (!text) {
    return conn.sendMessage(jid, {
      text: '🎵 *Uso:* .play nombre de la canción\n🎬 *Video:* .play -v nombre\n\nEjemplo: .play despacito'
    }, { quoted: m })
  }

  const wantVideo = args[0] === '-v'
  const query = wantVideo ? args.slice(1).join(' ') : text

  await conn.sendMessage(jid, { text: '🔎 Buscando...' }, { quoted: m })

  try {
    const video = await searchYT(query)
    if (!video) {
      return conn.sendMessage(jid, { text: '❌ No encontré nada con ese nombre' }, { quoted: m })
    }

    const videoId = video.videoId || video.id
    const infoText = `🎵 *${video.title}*\n📺 ${video.author?.name || '?'}\n⏱ ${formatTime(video.duration?.seconds || 0)} | 👀 ${formatViews(video.views)}\n🔗 ${video.url}`

    if (wantVideo) {
      await conn.sendMessage(jid, { text: `${infoText}\n\n⬇️ Descargando video...` }, { quoted: m })
      try {
        const filePath = await downloadWithYtDlp(video.url)
        const buf = readFileSync(filePath)
        await conn.sendMessage(jid, { video: buf, caption: `✅ *${video.title}*\n\n*CKV BOT*` }, { quoted: m })
        try { unlinkSync(filePath) } catch {}
      } catch (e) {
        await conn.sendMessage(jid, { text: `❌ ${e.message}` }, { quoted: m })
      }
      return
    }

    await conn.sendMessage(jid, { text: `${infoText}\n\n⬇️ Descargando audio...` }, { quoted: m })

    // Try each download API in order
    let sent = false
    let lastApiError = ''
    const apiNames = ['SocialKit', 'yt2mp3converter', 'Vevioz', 'Oceansaver']
    for (let i = 0; i < DOWNLOAD_APIS.length; i++) {
      try {
        const dlUrl = await DOWNLOAD_APIS[i](videoId, video.url)
        if (!dlUrl) { lastApiError += `${apiNames[i] || i}: no URL, `; continue }
        // Download the file ourselves and send as buffer (more reliable)
        const fileResp = await fetch(dlUrl, { signal: AbortSignal.timeout(60000) })
        if (!fileResp.ok) { lastApiError += `${apiNames[i] || i}: HTTP ${fileResp.status}, `; continue }
        const audioBuf = Buffer.from(await fileResp.arrayBuffer())
        if (audioBuf.length < 1000) { lastApiError += `${apiNames[i] || i}: empty (${audioBuf.length}b), `; continue }
        await conn.sendMessage(jid, {
          audio: audioBuf,
          mimetype: 'audio/mpeg',
          fileName: `${video.title}.mp3`
        }, { quoted: m })
        sent = true
        break
      } catch (e) { lastApiError += `${apiNames[i] || i}: ${e.message}, ` }
    }
    if (!sent) console.log('API errors:', lastApiError)

    // Fallback: download via yt-dlp and send as buffer
    if (!sent) {
      try {
        const filePath = await downloadWithYtDlp(video.url)
        const buf = readFileSync(filePath)
        await conn.sendMessage(jid, {
          audio: buf,
          mimetype: 'audio/mpeg',
          fileName: `${video.title}.mp3`
        }, { quoted: m })
        try { unlinkSync(filePath) } catch {}
        sent = true
      } catch {}
    }

    if (!sent) {
      await conn.sendMessage(jid, {
        text: '❌ No se pudo descargar. Prueba más tarde o configura cookies de YouTube con .ytcookies'
      }, { quoted: m })
    }
  } catch (e) {
    console.error(e)
    await conn.sendMessage(jid, { text: `❌ Error: ${e.message}` }, { quoted: m })
  }
}
