import axios from 'axios'
import fs from 'fs'
import path from 'path'

export default async function handler(conn, m, args, db) {
  const chat = m.chat || m.key?.remoteJid
  let url = args[0]
  if (!url?.includes('mediafire.com')) {
    return conn.sendMessage(chat, { text: '⚠️ *Uso:* .mediafire <link de MediaFire>\n\n📌 *Ejemplo:*\n• .mediafire https://www.mediafire.com/file/xxx/nombre.zip/file' }, { quoted: m })
  }

  await conn.sendMessage(chat, { react: { text: '⏳', key: m.key } })

  try {
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      timeout: 15000
    })

    let dlUrl = ''
    const patterns = [
      /href="(https:\/\/download[^"]+)"/,
      /href="(\/\/download[^"]+)"/,
      /aria-label="Download file".*?href="([^"]+)"/,
      /id="downloadButton".*?href="([^"]+)"/,
      /downloadUrl\s*[:=]\s*['"]([^'"]+)['"]/,
      /kNO\s*=\s*['"]([^'"]+)['"]/,
      /data-url=["']([^"']+)["']/
    ]
    for (const p of patterns) {
      const m2 = data.match(p)
      if (m2) { dlUrl = m2[1].replace(/&amp;/g, '&'); break }
    }

    if (!dlUrl) {
      const quickkey = url.match(/file\/([a-zA-Z0-9]+)/)
      if (quickkey) {
        try {
          const apiRes = await axios.get(`https://www.mediafire.com/api/file/get.php?quickkey=${quickkey}&dlink_dl=1`, { timeout: 10000 })
          dlUrl = apiRes?.data?.url || apiRes?.data?.direct_download || ''
        } catch {}
      }
    }

    if (!dlUrl) throw new Error('No se encontró link de descarga')

    if (!dlUrl.startsWith('http')) dlUrl = 'https:' + dlUrl

    const nameMatch = data.match(/<title>(.*?)<\/title>/)
    const name = nameMatch ? nameMatch[1].replace(/MediaFire/gi, '').replace(/[-|]/g, '').trim() : 'Archivo'

    const tmp = path.join(process.cwd(), 'temp')
    if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true })
    const outPath = path.join(tmp, `mf_${Date.now()}_${name || 'file'}`)

    try {
      const dl = await axios.get(dlUrl, {
        responseType: 'stream',
        timeout: 60000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      })
      const total = parseInt(dl.headers['content-length'] || '0')
      if (total > 0 && total < 50 * 1024 * 1024) {
        const writer = fs.createWriteStream(outPath)
        dl.data.pipe(writer)
        await new Promise((resolve, reject) => { writer.on('finish', resolve); writer.on('error', reject) })
        if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1000) {
          await conn.sendMessage(chat, { document: { url: outPath }, fileName: name, mimetype: 'application/octet-stream' }, { quoted: m })
          try { fs.unlinkSync(outPath) } catch {}
          return
        }
      }
    } catch {}
    try { fs.unlinkSync(outPath) } catch {}

    await conn.sendMessage(chat, { react: { text: '✅', key: m.key } })
    conn.sendMessage(chat, { text: `📁 *${name}*\n🔗 ${dlUrl}\n\n*CKV BOT*` }, { quoted: m })
  } catch (e) {
    await conn.sendMessage(chat, { react: { text: '❌', key: m.key } }).catch(() => {})
    conn.sendMessage(chat, { text: `❌ No pude obtener el enlace\n• ${e.message?.slice(0, 100)}` }, { quoted: m })
  }
}
