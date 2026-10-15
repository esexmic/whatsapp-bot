import axios from 'axios'

export default async function handler(conn, m, args, db) {
  const chat = m.chat || m.key?.remoteJid
  const url = args[0]
  if (!url) return conn.sendMessage(chat, { text: '⚠️ Uso: .short <url>' }, { quoted: m })

  try {
    const res = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`, { timeout: 10000 })
    conn.sendMessage(chat, { text: `🔗 *URL acortada*\n${res.data}\n\n*CKV BOT*` }, { quoted: m })
  } catch {
    conn.sendMessage(chat, { text: '❌ No pude acortar la URL' }, { quoted: m })
  }
}
