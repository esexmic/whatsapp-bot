import axios from 'axios'

export default async function handler(conn, m, args, db) {
  const chat = m.chat || m.key?.remoteJid
  const query = args.join(' ')
  if (!query) return conn.sendMessage(chat, { text: '⚠️ *Uso:* .letra <artista> - <canción>\n\n📌 *Ejemplos:*\n• .letra Queen - Bohemian Rhapsody\n• .letra Bad Bunny - Monaco' }, { quoted: m })

  const sep = query.includes(' - ') ? ' - ' : query.includes('–') ? ' – ' : null
  let artist, song
  if (sep) {
    const parts = query.split(sep)
    artist = parts[0].trim()
    song = parts.slice(1).join(sep).trim()
  } else {
    artist = query
    song = query
  }

  try {
    const res = await axios.get(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(song)}`, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    const lyrics = res?.data?.lyrics
    if (lyrics) {
      const text = lyrics.length > 4000 ? lyrics.slice(0, 4000) + '\n\n...' : lyrics
      conn.sendMessage(chat, { text: `🎵 *${artist} - ${song}*\n\n${text}\n\n*CKV BOT*` }, { quoted: m })
    } else {
      throw new Error('No encontrada')
    }
  } catch {
    try {
      const res2 = await axios.get(`https://api.lyrics.ovh/v1/${encodeURIComponent(query)}/${encodeURIComponent(query)}`, {
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      })
      const lyrics = res2?.data?.lyrics
      if (lyrics) {
        const text = lyrics.length > 4000 ? lyrics.slice(0, 4000) + '\n\n...' : lyrics
        return conn.sendMessage(chat, { text: `🎵 *${query}*\n\n${text}\n\n*CKV BOT*` }, { quoted: m })
      }
    } catch {}
    conn.sendMessage(chat, { text: '❌ No encontré la letra\n💡 Usa: .letra Artista - Canción' }, { quoted: m })
  }
}
