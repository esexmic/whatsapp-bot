import axios from 'axios'

export default async function handler(conn, m, args, db) {
  const chat = m.chat || m.key?.remoteJid
  const url = args[0]
  if (!url?.includes('facebook.com') && !url?.includes('fb.watch')) {
    return conn.sendMessage(chat, { text: '⚠️ Uso: .facebook <link de Facebook>' }, { quoted: m })
  }

  await conn.sendMessage(chat, { react: { text: '⏳', key: m.key } })

  try {
    const res = await axios.get(`https://api.download-facebook.com/v1/facebook?url=${encodeURIComponent(url)}`, { timeout: 15000 })
    const videoUrl = res?.data?.url || res?.data?.download || res?.data?.video
    if (videoUrl) {
      await conn.sendMessage(chat, { react: { text: '✅', key: m.key } })
      await conn.sendMessage(chat, { video: { url: videoUrl }, caption: '✅ Facebook\n\n*CKV BOT*' }, { quoted: m })
    } else {
      throw new Error('No se encontró video')
    }
  } catch {
    await conn.sendMessage(chat, { react: { text: '❌', key: m.key } }).catch(() => {})
    conn.sendMessage(chat, { text: '❌ No pude descargar el video' }, { quoted: m })
  }
}
