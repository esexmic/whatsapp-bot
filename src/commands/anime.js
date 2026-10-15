import axios from 'axios'

async function fetchJikan(query) {
  try {
    const res = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=1`, {
      timeout: 15000,
      headers: { 'User-Agent': 'CKV-Bot/1.0', 'Accept': 'application/json' }
    })
    return res?.data?.data?.[0] || null
  } catch {}
  return null
}

async function fetchKitsu(query) {
  try {
    const res = await axios.get(`https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(query)}&page[limit]=1`, {
      timeout: 10000,
      headers: { 'Accept': 'application/vnd.api+json' }
    })
    const d = res?.data?.data?.[0]
    if (!d) return null
    const attrs = d.attributes
    return {
      title: attrs.titles?.en || attrs.titles?.en_jp || attrs.canonicalTitle || query,
      title_english: attrs.titles?.en || null,
      score: attrs.averageRating ? (parseFloat(attrs.averageRating) / 10).toFixed(1) : 'N/A',
      episodes: attrs.episodeCount || 'N/A',
      status: attrs.status || 'N/A',
      synopsis: attrs.synopsis || '',
      url: `https://kitsu.io/anime/${d.id}`,
      genres: (attrs.categories || []).map(c => c.name).join(', ') || 'N/A',
      aired: attrs.startDate ? `📅 *Estreno:* ${attrs.startDate}` : ''
    }
  } catch {}
  return null
}

export default async function handler(conn, m, args, db) {
  const chat = m.chat || m.key?.remoteJid
  const query = args.join(' ')
  if (!query) return conn.sendMessage(chat, { text: '⚠️ *Uso:* .anime <nombre>\n\n📌 *Ejemplos:*\n• .anime Naruto\n• .anime Attack on Titan' }, { quoted: m })

  let d = await fetchJikan(query)
  if (!d) d = await fetchKitsu(query)

  if (d) {
    const text = `🎌 *${d.title}*\n${d.title_english ? `📖 ${d.title_english}\n` : ''}📊 *Score:* ${d.score || 'N/A'}\n📺 *Episodios:* ${d.episodes || 'N/A'}\n${d.aired || ''}${d.status ? `\n📖 *Estado:* ${d.status}` : ''}\n📋 *Géneros:* ${d.genres || 'N/A'}\n\n${(d.synopsis || '').slice(0, 1000)}${d.synopsis?.length > 1000 ? '...' : ''}\n\n🔗 ${d.url || ''}\n\n*CKV BOT*`
    conn.sendMessage(chat, { text }, { quoted: m })
  } else {
    conn.sendMessage(chat, { text: '❌ No encontré el anime. Intenta con el nombre en inglés.' }, { quoted: m })
  }
}
