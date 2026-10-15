import axios from 'axios'

export default async function handler(conn, m, args, db) {
  const chat = m.chat || m.key?.remoteJid
  const url = args[0]
  if (!url?.includes('twitter.com') && !url?.includes('x.com') && !url?.includes('t.co')) {
    return conn.sendMessage(chat, { text: '⚠️ Uso: .twitter <link de Twitter/X>' }, { quoted: m })
  }

  await conn.sendMessage(chat, { react: { text: '⏳', key: m.key } })

  try {
    const res = await axios.get(`https://api.download-twitter.com/v1/twitter?url=${encodeURIComponent(url)}`, { timeout: 15000 })
    const videoUrl = res?.data?.url || res?.data?.download || res?.data?.video
    if (videoUrl) {
      await conn.sendMessage(chat, { react: { text: '✅', key: m.key } })
      await conn.sendMessage(chat, { video: { url: videoUrl }, caption: '✅ Twitter/X\n\n*CKV BOT*' }, { quoted: m })
    } else {
      throw new Error('No se encontró video')
    }
  } catch {
    await conn.sendMessage(chat, { react: { text: '❌', key: m.key } }).catch(() => {})
    conn.sendMessage(chat, { text: '❌ No pude descargar el video' }, { quoted: m })
  }
}
