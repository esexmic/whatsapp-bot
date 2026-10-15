import axios from 'axios'

export default async function handler(conn, m, args, db) {
  const chat = m.chat || m.key?.remoteJid
  const query = args.join(' ')
  if (!query) return conn.sendMessage(chat, { text: '⚠️ *Uso:* .wiki <búsqueda>\n\n📌 *Ejemplos:*\n• .wiki Albert Einstein\n• .wiki Programación' }, { quoted: m })

  try {
    const res = await axios.get(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`, {
      timeout: 10000,
      headers: { 'User-Agent': 'CKV-Bot/1.0 (WhatsApp Bot)' }
    })
    const data = res.data
    if (data?.title && data?.extract) {
      const text = `📚 *${data.title}*\n\n${data.extract.slice(0, 3000)}${data.extract.length > 3000 ? '...' : ''}\n\n🔗 ${data.content_urls?.desktop?.page || ''}\n\n*CKV BOT*`
      conn.sendMessage(chat, { text }, { quoted: m })
    } else {
      throw new Error('No encontrado')
    }
  } catch {
    try {
      const res2 = await axios.get(`https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=1`, {
        timeout: 10000,
        headers: { 'User-Agent': 'CKV-Bot/1.0' }
      })
      const page = res2?.data?.query?.search?.[0]
      if (page) {
        const title = page.title
        const res3 = await axios.get(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
          timeout: 10000,
          headers: { 'User-Agent': 'CKV-Bot/1.0' }
        })
        const d = res3.data
        if (d?.extract) {
          const text = `📚 *${d.title}*\n\n${d.extract.slice(0, 3000)}${d.extract.length > 3000 ? '...' : ''}\n\n🔗 ${d.content_urls?.desktop?.page || ''}\n\n*CKV BOT*`
          return conn.sendMessage(chat, { text }, { quoted: m })
        }
      }
    } catch {}
    conn.sendMessage(chat, { text: '❌ No encontré resultados para esa búsqueda' }, { quoted: m })
  }
}
