import axios from 'axios'

export default async function handler(conn, m, args, db) {
  const chat = m.chat || m.key?.remoteJid

  let text = args.join(' ')

  if (!text) {
    const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage
    if (quoted?.conversation) text = quoted.conversation
    else if (quoted?.extendedTextMessage?.text) text = quoted.extendedTextMessage.text
  }

  if (!text) {
    return conn.sendMessage(chat, { text: '⚠️ *Uso:* .translate <texto>\n📌 *Ejemplo:* .translate Hello world\n💡 O responde a un mensaje con .translate' }, { quoted: m })
  }

  try {
    const res = await axios.get(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=${encodeURIComponent(text)}`, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    const translated = res?.data?.[0]?.[0]?.[0]
    if (translated && translated !== text) {
      conn.sendMessage(chat, { text: `🌐 *Traducción*\n\n📝 ${translated}\n\n*CKV BOT*` }, { quoted: m })
    } else {
      throw new Error('No traducido')
    }
  } catch {
    conn.sendMessage(chat, { text: '❌ No pude traducir ese texto' }, { quoted: m })
  }
}
